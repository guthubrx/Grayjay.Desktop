using System.Diagnostics;
using System.Text.RegularExpressions;
using Grayjay.ClientServer.Constants;
using Grayjay.ClientServer.Models.Highlights;
using Grayjay.ClientServer.Settings;
using Grayjay.Desktop.POC;
using Grayjay.Desktop.POC.Port.States;
using Grayjay.Engine.Models.Detail;
using Grayjay.Engine.Models.Subtitles;

namespace Grayjay.ClientServer.States;

/// <summary>
/// Lance une commande externe (configurée par l'utilisateur) qui génère les
/// Smart Highlights d'une vidéo. La commande écrit elle-même le fichier dans le
/// store highlights ; ce moteur se contente de l'ordonnancer, l'exécuter et
/// notifier le frontend. Désactivé tant qu'aucune commande n'est fournie.
/// </summary>
public static class StateHighlightsIndexer
{
    public class IndexJob
    {
        public required string Url { get; set; }
        public required string Status { get; set; } // queued | running | done | error | skipped
        public string? Error { get; set; }
        public string? Priority { get; set; }
        public string? Source { get; set; }
        public DateTime? NextAttemptAt { get; set; }
    }

    public class SubtitleAvailability
    {
        public required string Url { get; set; }
        public required bool Available { get; set; }
    }

    private enum HighlightJobPriority
    {
        Manual,
        CurrentVideo,
        NextInQueue,
        SmartMix,
        SmartTv,
        WatchNow,
        PriorityGroup,
        Catalog,
    }

    private sealed class QueuedIndexJob
    {
        public required string Url { get; init; }
        public required string Command { get; init; }
        public required string[] TranslationSourceLanguages { get; init; }
        public required HighlightJobPriority Priority { get; set; }
        public required string Source { get; set; }
        public required bool Automatic { get; set; }
        public required bool RequirePlatformSubtitles { get; init; }
        public required long Sequence { get; init; }
    }

    private sealed class SubtitleAvailabilityEntry
    {
        public required bool Available { get; init; }
        public required DateTime ExpiresAt { get; init; }
    }

    private sealed class SubtitleUnavailableException : Exception
    {
        public SubtitleUnavailableException(string message) : base(message) { }
    }

    private static readonly object _lock = new();
    private static readonly Dictionary<string, IndexJob> _jobs = new();
    private static readonly List<QueuedIndexJob> _queue = new();
    private static readonly Dictionary<string, DateTime> _automaticRetryAt = new();
    private static readonly Dictionary<string, SubtitleAvailabilityEntry> _subtitleAvailability = new(StringComparer.Ordinal);
    private static int _activeWorkers = 0;
    private static int? _configuredParallelism;
    private static int? _configuredMaxQueuedJobs;
    private static long _nextSequence;
    private const int DefaultParallelism = 1;
    private const int MaxParallelism = 32;
    private const int DefaultMaxQueuedJobs = 24;
    private const int MaxQueuedJobs = 500;
    private const string ParallelismFileName = "smart-chapters-parallelism";
    private static readonly TimeSpan AutomaticRetryDelay = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan SubtitleAvailableCacheDuration = TimeSpan.FromHours(6);
    private static readonly TimeSpan SubtitleUnavailableCacheDuration = TimeSpan.FromHours(1);

    // Garde-fou anti-injection : l'URL est interpolée dans une ligne shell,
    // on refuse tout métacaractère shell.
    private static readonly Regex _safeUrl = new(@"^https?://[^\s'""`;|&$<>(){}\\]+$", RegexOptions.Compiled);
    private static readonly Regex _safeLanguageCode = new(@"^[a-z]{2,3}(?:-[a-z]{4})?$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static List<IndexJob> GetJobs()
    {
        lock (_lock)
            return _jobs.Values
                .OrderBy(job => ParsePriority(job.Priority))
                .ThenBy(job => job.Url, StringComparer.Ordinal)
                .ToList();
    }

    public static IndexJob Enqueue(string url, string command, IEnumerable<string>? translationSourceLanguages = null)
    {
        ValidateRequest(ref url, command);
        return EnqueueValidated(
            url,
            command,
            NormalizeLanguageCodes(translationSourceLanguages),
            HighlightJobPriority.Manual,
            "manual",
            automatic: false,
            requirePlatformSubtitles: true);
    }

    public static IndexJob EnqueueIfNeeded(string url, string command, IEnumerable<string>? translationSourceLanguages = null)
    {
        ValidateRequest(ref url, command);
        var normalizedLanguages = NormalizeLanguageCodes(translationSourceLanguages);
        if (!GrayjaySettings.Instance.XrayPanel.AutoGenerateOnVideoOpen || HasRequiredOutput(StateHighlights.Get(url), normalizedLanguages))
            return new IndexJob { Url = url, Status = "skipped", Priority = PriorityName(HighlightJobPriority.CurrentVideo), Source = "auto-open" };

        return EnqueueValidated(
            url,
            command,
            normalizedLanguages,
            HighlightJobPriority.CurrentVideo,
            "auto-open",
            automatic: true,
            requirePlatformSubtitles: true);
    }

    public static IndexJob EnqueuePrefill(string url, string command, string? priority, string? source, IEnumerable<string>? translationSourceLanguages = null)
    {
        ValidateRequest(ref url, command);
        var parsedPriority = ParsePriority(priority);
        if (parsedPriority == HighlightJobPriority.Manual)
            throw new ArgumentException("Invalid prefill priority");

        var normalizedLanguages = NormalizeLanguageCodes(translationSourceLanguages);
        var normalizedSource = string.IsNullOrWhiteSpace(source) ? PriorityName(parsedPriority) : source.Trim();
        if (HasRequiredOutput(StateHighlights.Get(url), normalizedLanguages))
        {
            return new IndexJob
            {
                Url = url,
                Status = "skipped",
                Priority = PriorityName(parsedPriority),
                Source = normalizedSource,
            };
        }

        return EnqueueValidated(
            url,
            command,
            normalizedLanguages,
            parsedPriority,
            normalizedSource,
            automatic: true,
            requirePlatformSubtitles: true);
    }

    public static (int Parallelism, int MaxQueuedJobs) ConfigurePrefill(int parallelism, int? maxQueuedJobs = null)
    {
        lock (_lock)
        {
            _configuredParallelism = ClampParallelism(parallelism);
            if (maxQueuedJobs.HasValue)
                _configuredMaxQueuedJobs = ClampMaxQueuedJobs(maxQueuedJobs.Value);
            EnsureWorkersLocked();
            return (_configuredParallelism.Value, DesiredMaxQueuedJobs());
        }
    }

    public static List<SubtitleAvailability> ProbeSubtitles(IEnumerable<string>? urls)
    {
        return (urls ?? [])
            .Where(url => !string.IsNullOrWhiteSpace(url))
            .Select(url => url.Trim())
            .Distinct(StringComparer.Ordinal)
            .Take(100)
            .Select(ProbeSubtitle)
            .ToList();
    }

    public static SubtitleAvailability ProbeSubtitle(string url)
    {
        lock (_lock)
        {
            if (_subtitleAvailability.TryGetValue(url, out var cached) && cached.ExpiresAt > DateTime.UtcNow)
                return new SubtitleAvailability { Url = url, Available = cached.Available };
        }

        var available = false;
        try
        {
            available = StatePlatform.GetContentDetails(url) is PlatformVideoDetails details && SelectUsableSubtitle(details) != null;
        }
        catch (Exception ex)
        {
            Logger.w(nameof(StateHighlightsIndexer), $"Could not probe subtitles for {url}: {ex.Message}");
        }
        CacheSubtitleAvailability(url, available);
        return new SubtitleAvailability { Url = url, Available = available };
    }

    private static void ValidateRequest(ref string url, string command)
    {
        if (string.IsNullOrWhiteSpace(url))
            throw new ArgumentException("Missing url");
        if (string.IsNullOrWhiteSpace(command))
            throw new ArgumentException("No generator command configured");

        url = url.Trim();
        if (!_safeUrl.IsMatch(url))
            throw new ArgumentException("Unsafe or invalid url");
    }

    private static IndexJob EnqueueValidated(
        string url,
        string command,
        string[] translationSourceLanguages,
        HighlightJobPriority priority,
        string source,
        bool automatic,
        bool requirePlatformSubtitles)
    {
        IndexJob job;
        IndexJob? evicted = null;
        lock (_lock)
        {
            if (_jobs.TryGetValue(url, out var existing) &&
                (existing.Status == "queued" || existing.Status == "running"))
            {
                if (existing.Status == "queued" && priority < ParsePriority(existing.Priority))
                {
                    existing.Priority = PriorityName(priority);
                    existing.Source = source;
                    var queued = _queue.FirstOrDefault(item => item.Url == url);
                    if (queued != null)
                    {
                        queued.Priority = priority;
                        queued.Source = source;
                        queued.Automatic = automatic;
                    }
                }
                job = existing;
            }
            else if (automatic && _automaticRetryAt.TryGetValue(url, out var retryAt) && retryAt > DateTime.UtcNow)
            {
                if (existing != null)
                {
                    existing.NextAttemptAt = retryAt;
                    job = existing;
                }
                else
                {
                    job = new IndexJob
                    {
                        Url = url,
                        Status = "skipped",
                        Error = "Automatic retry is temporarily delayed.",
                        Priority = PriorityName(priority),
                        Source = source,
                        NextAttemptAt = retryAt,
                    };
                }
            }
            else
            {
                if (!automatic)
                    _automaticRetryAt.Remove(url);

                if (automatic && !ReserveAutomaticQueueSlotLocked(priority, out evicted))
                {
                    job = new IndexJob
                    {
                        Url = url,
                        Status = "skipped",
                        Error = "Smart Prefill queue is full.",
                        Priority = PriorityName(priority),
                        Source = source,
                    };
                    _jobs[url] = job;
                }
                else
                {
                    job = new IndexJob
                    {
                        Url = url,
                        Status = "queued",
                        Priority = PriorityName(priority),
                        Source = source,
                    };
                    _jobs[url] = job;
                    _queue.Add(new QueuedIndexJob
                    {
                        Url = url,
                        Command = command,
                        TranslationSourceLanguages = translationSourceLanguages,
                        Priority = priority,
                        Source = source,
                        Automatic = automatic,
                        RequirePlatformSubtitles = requirePlatformSubtitles,
                        Sequence = _nextSequence++,
                    });
                    EnsureWorkersLocked();
                }
            }

        }
        StateWebsocket.HighlightsIndexChanged(job);
        if (evicted != null)
            StateWebsocket.HighlightsIndexChanged(evicted);
        return job;
    }

    private static bool ReserveAutomaticQueueSlotLocked(HighlightJobPriority incomingPriority, out IndexJob? evicted)
    {
        evicted = null;
        if (_queue.Count(item => item.Automatic) < DesiredMaxQueuedJobs())
            return true;

        var replacementIndex = -1;
        for (var index = 0; index < _queue.Count; index++)
        {
            var candidate = _queue[index];
            if (!candidate.Automatic || candidate.Priority <= incomingPriority)
                continue;
            if (replacementIndex < 0 || candidate.Priority > _queue[replacementIndex].Priority ||
                (candidate.Priority == _queue[replacementIndex].Priority && candidate.Sequence > _queue[replacementIndex].Sequence))
                replacementIndex = index;
        }
        if (replacementIndex < 0)
            return false;

        var replacement = _queue[replacementIndex];
        _queue.RemoveAt(replacementIndex);
        if (_jobs.TryGetValue(replacement.Url, out var replacedJob))
        {
            replacedJob.Status = "skipped";
            replacedJob.Error = "Superseded by a higher-priority prefill.";
            evicted = replacedJob;
        }
        return true;
    }

    private static void EnsureWorkersLocked()
    {
        var desired = DesiredParallelism();
        while (_queue.Count > 0 && _activeWorkers < desired)
        {
            _activeWorkers++;
            _ = Task.Run(WorkerLoop);
        }
    }

    private static int DesiredParallelism()
    {
        if (_configuredParallelism.HasValue)
            return _configuredParallelism.Value;

        var fromFile = ReadParallelismFile();
        if (fromFile.HasValue)
            return ClampParallelism(fromFile.Value);

        if (int.TryParse(Environment.GetEnvironmentVariable("BLUEJAY_SMART_CHAPTERS_PARALLELISM"), out var fromEnv))
            return ClampParallelism(fromEnv);

        return DefaultParallelism;
    }

    private static int? ReadParallelismFile()
    {
        try
        {
            var path = Path.Combine(Directories.Base, ParallelismFileName);
            if (!File.Exists(path))
                return null;

            var text = File.ReadAllText(path).Trim();
            return int.TryParse(text, out var value) ? value : null;
        }
        catch (Exception ex)
        {
            Logger.w(nameof(StateHighlightsIndexer), $"Could not read smart chapters parallelism: {ex.Message}");
            return null;
        }
    }

    private static int ClampParallelism(int value)
    {
        return Math.Clamp(value, 1, MaxParallelism);
    }

    private static int DesiredMaxQueuedJobs()
    {
        return _configuredMaxQueuedJobs ?? DefaultMaxQueuedJobs;
    }

    private static int ClampMaxQueuedJobs(int value)
    {
        return Math.Clamp(value, 1, MaxQueuedJobs);
    }

    private static async Task WorkerLoop()
    {
        while (true)
        {
            QueuedIndexJob item;
            IndexJob job;
            lock (_lock)
            {
                if (_queue.Count == 0 || _activeWorkers > DesiredParallelism())
                {
                    _activeWorkers = Math.Max(0, _activeWorkers - 1);
                    return;
                }
                item = DequeueNextLocked();
                job = _jobs[item.Url];
                job.Status = "running";
                job.Error = null;
                job.NextAttemptAt = null;
            }
            StateWebsocket.HighlightsIndexChanged(job);

            try
            {
                await RunCommand(item.Command, item.Url, item.TranslationSourceLanguages, item.RequirePlatformSubtitles);
                lock (_lock)
                {
                    job.Status = "done";
                    _automaticRetryAt.Remove(item.Url);
                    EnsureWorkersLocked();
                }
                StateWebsocket.HighlightsChanged(item.Url);
            }
            catch (SubtitleUnavailableException ex)
            {
                lock (_lock)
                {
                    job.Status = "skipped";
                    job.Error = ex.Message;
                    _automaticRetryAt.Remove(item.Url);
                    EnsureWorkersLocked();
                }
            }
            catch (Exception ex)
            {
                Logger.w(nameof(StateHighlightsIndexer), $"Indexing failed for {item.Url}: {ex.Message}");
                lock (_lock)
                {
                    job.Status = "error";
                    job.Error = UserFacingError(ex.Message);
                    if (item.Automatic)
                    {
                        var retryAt = DateTime.UtcNow.Add(AutomaticRetryDelay);
                        _automaticRetryAt[item.Url] = retryAt;
                        job.NextAttemptAt = retryAt;
                    }
                    EnsureWorkersLocked();
                }
            }
            StateWebsocket.HighlightsIndexChanged(job);
        }
    }

    private static QueuedIndexJob DequeueNextLocked()
    {
        var index = 0;
        for (var i = 1; i < _queue.Count; i++)
        {
            var candidate = _queue[i];
            var best = _queue[index];
            if (candidate.Priority < best.Priority ||
                (candidate.Priority == best.Priority && candidate.Sequence < best.Sequence))
                index = i;
        }

        var item = _queue[index];
        _queue.RemoveAt(index);
        return item;
    }

    private static HighlightJobPriority ParsePriority(string? value)
    {
        return value?.Trim().ToLowerInvariant().Replace('_', '-') switch
        {
            "current-video" => HighlightJobPriority.CurrentVideo,
            "next-in-queue" => HighlightJobPriority.NextInQueue,
            "smart-mix" => HighlightJobPriority.SmartMix,
            "smart-tv" => HighlightJobPriority.SmartTv,
            "watch-now" => HighlightJobPriority.WatchNow,
            "priority-group" => HighlightJobPriority.PriorityGroup,
            "catalog" => HighlightJobPriority.Catalog,
            "manual" => HighlightJobPriority.Manual,
            _ => HighlightJobPriority.Manual,
        };
    }

    private static string PriorityName(HighlightJobPriority priority)
    {
        return priority switch
        {
            HighlightJobPriority.CurrentVideo => "current-video",
            HighlightJobPriority.NextInQueue => "next-in-queue",
            HighlightJobPriority.SmartMix => "smart-mix",
            HighlightJobPriority.SmartTv => "smart-tv",
            HighlightJobPriority.WatchNow => "watch-now",
            HighlightJobPriority.PriorityGroup => "priority-group",
            HighlightJobPriority.Catalog => "catalog",
            _ => "manual",
        };
    }

    private static bool HasRequiredOutput(VideoHighlightSet? highlights, IReadOnlyCollection<string> translationSourceLanguages)
    {
        if ((highlights?.Segments.Count ?? 0) == 0)
            return false;

        var outputLanguage = GrayjaySettings.Instance.XrayPanel.GenerationLanguageName();
        if (outputLanguage == null || translationSourceLanguages.Count == 0)
            return true;

        var transcriptLanguage = NormalizeLanguageCode(highlights?.TranscriptLanguage);
        if (transcriptLanguage == null)
            return false;
        if (transcriptLanguage == "und" || !translationSourceLanguages.Contains(transcriptLanguage, StringComparer.OrdinalIgnoreCase))
            return true;

        var outputLanguageCode = OutputLanguageCode(outputLanguage);
        if (outputLanguageCode == transcriptLanguage)
            return true;

        return string.Equals(highlights?.TranslatedSubtitles?.Language, outputLanguage, StringComparison.OrdinalIgnoreCase);
    }

    private static string[] NormalizeLanguageCodes(IEnumerable<string>? languages)
    {
        return (languages ?? [])
            .Select(NormalizeLanguageCode)
            .Where(language => language != null && language != "und")
            .Cast<string>()
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static string? NormalizeLanguageCode(string? language)
    {
        if (string.IsNullOrWhiteSpace(language))
            return null;

        var value = language.Trim().Replace('_', '-');
        if (!_safeLanguageCode.IsMatch(value) && !string.Equals(value, "und", StringComparison.OrdinalIgnoreCase))
            return null;

        var lower = value.ToLowerInvariant();
        return lower switch
        {
            "zh-hans" => "zh-Hans",
            "zh-hant" => "zh-Hant",
            _ => lower
        };
    }

    private static string? OutputLanguageCode(string? language)
    {
        return language?.ToLowerInvariant() switch
        {
            "french" => "fr",
            "english" => "en",
            "spanish" => "es",
            "german" => "de",
            "italian" => "it",
            "portuguese" => "pt",
            "dutch" => "nl",
            _ => NormalizeLanguageCode(language)
        };
    }

    private static string UserFacingError(string message)
    {
        if (string.IsNullOrWhiteSpace(message))
            return "Unknown generator error.";

        if (message.Contains("quota_exhausted", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("Insufficient Balance", StringComparison.OrdinalIgnoreCase))
            return "Provider quota exhausted / insufficient balance.";

        var providerStatus = Regex.Match(message, @"OpenAI-compatible request failed \((\d+)\)", RegexOptions.IgnoreCase);
        if (providerStatus.Success)
            return $"Provider request failed ({providerStatus.Groups[1].Value}).";

        var clean = Regex.Replace(message, @"\s+", " ").Trim();
        return clean.Length > 240 ? clean[..237] + "..." : clean;
    }

    private static SubtitleSource? SelectUsableSubtitle(PlatformVideoDetails details)
    {
        var subtitles = details.Subtitles;
        if (subtitles == null || subtitles.Length == 0)
            return null;

        bool IsVtt(string? value) => value != null && value.Contains("vtt", StringComparison.OrdinalIgnoreCase);
        bool NameHas(string? name, string language) => name != null && name.Contains(language, StringComparison.OrdinalIgnoreCase);
        return subtitles.FirstOrDefault(subtitle => IsVtt(subtitle.Format) && NameHas(subtitle.Name, "fr"))
            ?? subtitles.FirstOrDefault(subtitle => IsVtt(subtitle.Format) && NameHas(subtitle.Name, "en"))
            ?? subtitles.FirstOrDefault(subtitle => IsVtt(subtitle.Format))
            ?? subtitles.FirstOrDefault(subtitle => IsVtt(subtitle.Url));
    }

    private static void CacheSubtitleAvailability(string url, bool available)
    {
        lock (_lock)
        {
            _subtitleAvailability[url] = new SubtitleAvailabilityEntry
            {
                Available = available,
                ExpiresAt = DateTime.UtcNow.Add(available ? SubtitleAvailableCacheDuration : SubtitleUnavailableCacheDuration),
            };
        }
    }

    // Récupère les sous-titres de la vidéo via le moteur Grayjay (plugin) et les
    // écrit dans un VTT temporaire. Les jobs BlueJay exigent ce fichier afin de
    // garantir qu'ils ne retombent jamais sur yt-dlp ou Whisper.
    private static string? MaterializeSubtitle(string url)
    {
        try
        {
            if (StatePlatform.GetContentDetails(url) is not PlatformVideoDetails details)
            {
                CacheSubtitleAvailability(url, false);
                return null;
            }
            var chosen = SelectUsableSubtitle(details);
            if (chosen == null)
            {
                CacheSubtitleAvailability(url, false);
                return null;
            }

            var content = chosen.ToRaw().GetSubtitles();
            if (string.IsNullOrWhiteSpace(content))
            {
                CacheSubtitleAvailability(url, false);
                return null;
            }

            var path = Path.Combine(Path.GetTempPath(), $"grayjay_smartchapters_{Guid.NewGuid():N}.vtt");
            File.WriteAllText(path, content);
            CacheSubtitleAvailability(url, true);
            Logger.i(nameof(StateHighlightsIndexer), $"Provided subtitles for {url}: {chosen.Name} ({content.Length} chars)");
            return path;
        }
        catch (Exception ex)
        {
            CacheSubtitleAvailability(url, false);
            Logger.w(nameof(StateHighlightsIndexer), $"Could not fetch Grayjay subtitles for {url}: {ex.Message}");
            return null;
        }
    }

    private static async Task RunCommand(string command, string url, IReadOnlyCollection<string> translationSourceLanguages, bool requirePlatformSubtitles)
    {
        // {url} est substitué si présent, sinon l'URL est ajoutée en dernier argument.
        var commandLine = command.Contains("{url}") ? command.Replace("{url}", url) : $"{command} {url}";

        if (requirePlatformSubtitles && !command.Contains("{subtitles}", StringComparison.Ordinal))
            throw new SubtitleUnavailableException("Smart analysis requires a generator command with {subtitles}.");

        // {subtitles} : remplacé par "--subtitle-file <vtt>" quand Grayjay a les
        // sous-titres. Aucun job BlueJay ne laisse le générateur choisir Whisper.
        string? subtitleFile = null;
        if (command.Contains("{subtitles}"))
        {
            subtitleFile = MaterializeSubtitle(url);
            if (requirePlatformSubtitles && subtitleFile == null)
                throw new SubtitleUnavailableException("No usable platform subtitles were found.");
            commandLine = commandLine.Replace("{subtitles}",
                subtitleFile != null ? $"--subtitle-file \"{subtitleFile}\"" : "");
        }

        // {language} : langue de sortie choisie dans les réglages (Smart Analysis).
        // Vide en mode "Auto" -> le générateur garde la langue de la vidéo.
        if (command.Contains("{language}"))
        {
            var lang = GrayjaySettings.Instance.XrayPanel.GenerationLanguageName();
            commandLine = commandLine.Replace("{language}",
                lang != null ? $"--output-language \"{lang}\"" : "");
        }

        if (translationSourceLanguages.Count > 0 && GrayjaySettings.Instance.XrayPanel.GenerationLanguageName() != null)
        {
            commandLine += $" --translate-subtitles --translate-subtitles-from \"{string.Join(',', translationSourceLanguages)}\"";
        }

        var psi = new ProcessStartInfo
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        if (OperatingSystem.IsWindows())
        {
            psi.FileName = "cmd.exe";
            psi.ArgumentList.Add("/c");
            psi.ArgumentList.Add(commandLine);
        }
        else
        {
            psi.FileName = "/bin/sh";
            psi.ArgumentList.Add("-c");
            psi.ArgumentList.Add(commandLine);
        }

        try
        {
            using var process = new Process { StartInfo = psi };
            process.Start();
            var stdoutTask = process.StandardOutput.ReadToEndAsync();
            var stderrTask = process.StandardError.ReadToEndAsync();
            await process.WaitForExitAsync();
            var stdout = await stdoutTask;
            var stderr = await stderrTask;

            if (process.ExitCode != 0)
            {
                var detail = string.IsNullOrWhiteSpace(stderr) ? stdout : stderr;
                throw new Exception($"Generator exited with code {process.ExitCode}: {detail.Trim()}");
            }
        }
        finally
        {
            if (subtitleFile != null)
            {
                try { File.Delete(subtitleFile); } catch { /* best-effort cleanup */ }
            }
        }
    }
}
