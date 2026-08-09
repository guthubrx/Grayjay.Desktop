using System.Diagnostics;
using System.Text.RegularExpressions;
using Grayjay.ClientServer.Constants;
using Grayjay.ClientServer.Models.Highlights;
using Grayjay.ClientServer.Serializers;
using Grayjay.ClientServer.Settings;
using Grayjay.Desktop.POC;
using Grayjay.Desktop.POC.Port.States;
using Grayjay.Engine.Models.Detail;

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
        public string? Title { get; set; }
        public string? Author { get; set; }
        public string? Thumbnail { get; set; }
        public string? Source { get; set; }
        public int Priority { get; set; }
        public int Position { get; set; }
        public DateTime QueuedAt { get; set; }
        public DateTime? StartedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
    }

    public class IndexJobMetadata
    {
        public string? Title { get; set; }
        public string? Author { get; set; }
        public string? Thumbnail { get; set; }
    }

    private class QueueEntry
    {
        public required IndexJob Job { get; init; }
        public required string Command { get; init; }
        public long Order { get; set; }
    }

    private class PersistedQueueEntry
    {
        public required IndexJob Job { get; set; }
        public required string Command { get; set; }
        public long Order { get; set; }
    }

    private class IndexQueueSnapshot
    {
        public const int CurrentFormatVersion = 1;

        public int FormatVersion { get; set; } = CurrentFormatVersion;
        public long NextQueueOrder { get; set; }
        public long NextPromotedOrder { get; set; }
        public List<PersistedQueueEntry> Entries { get; set; } = new();
    }

    private static readonly object _lock = new();
    private static readonly Dictionary<string, IndexJob> _jobs = new();
    private static readonly List<QueueEntry> _queue = new();
    private static readonly Dictionary<string, QueueEntry> _running = new();
    private static int _activeWorkers = 0;
    private static long _nextQueueOrder = 0;
    private static long _nextPromotedOrder = 0;
    private static bool _queueLoaded = false;
    private const int DefaultParallelism = 1;
    private const int MaxParallelism = 24;
    private const int MaxCompletedJobs = 100;
    private const string ParallelismFileName = "smart-chapters-parallelism";
    private const string QueueFileName = "smart-chapters-queue.json";
    private const int ManualPriority = 2;
    private const int PlaybackPriority = 1;

    // Garde-fou anti-injection : l'URL est interpolée dans une ligne shell,
    // on refuse tout métacaractère shell.
    private static readonly Regex _safeUrl = new(@"^https?://[^\s'""`;|&$<>(){}\\]+$", RegexOptions.Compiled);
    private static readonly Regex _safeLanguageCode = new(@"^[a-z]{2,3}(?:-[a-z]{4})?$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static List<IndexJob> GetJobs()
    {
        lock (_lock)
        {
            LoadQueueLocked();
            return SnapshotJobsLocked();
        }
    }

    public static IndexJob Enqueue(string url, string command, IndexJobMetadata? metadata = null, string? source = null)
    {
        ValidateRequest(ref url, command);
        return EnqueueValidated(url, command, metadata, NormalizeSource(source, "manual"), ManualPriority);
    }

    public static IndexJob EnqueueIfNeeded(string url, string command, IndexJobMetadata? metadata = null)
    {
        ValidateRequest(ref url, command);
        if (!GrayjaySettings.Instance.XrayPanel.AutoGenerateOnVideoOpen || HasRequiredOutput(StateHighlights.Get(url)))
            return new IndexJob { Url = url, Status = "skipped" };

        return EnqueueValidated(url, command, metadata, "playback", PlaybackPriority);
    }

    public static IndexJob? Prioritize(string url)
    {
        if (string.IsNullOrWhiteSpace(url))
            return null;

        lock (_lock)
        {
            LoadQueueLocked();
            var entry = _queue.FirstOrDefault(x => x.Job.Url == url);
            if (entry == null)
                return null;

            entry.Job.Priority = ManualPriority;
            entry.Order = --_nextPromotedOrder;
            PersistQueueLocked();
            StateWebsocket.HighlightsIndexChanged(entry.Job);
            return SnapshotJob(entry.Job, 1);
        }
    }

    public static IndexJob? Remove(string url)
    {
        if (string.IsNullOrWhiteSpace(url))
            return null;

        lock (_lock)
        {
            LoadQueueLocked();
            var entry = _queue.FirstOrDefault(x => x.Job.Url == url);
            if (entry == null)
                return null;

            _queue.Remove(entry);
            entry.Job.Status = "skipped";
            entry.Job.Error = "Removed from queue.";
            entry.Job.CompletedAt = DateTime.UtcNow;
            TrimCompletedJobsLocked();
            PersistQueueLocked();
            StateWebsocket.HighlightsIndexChanged(entry.Job);
            return SnapshotJob(entry.Job);
        }
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

    private static IndexJob EnqueueValidated(string url, string command, IndexJobMetadata? metadata, string source, int priority)
    {
        lock (_lock)
        {
            LoadQueueLocked();
            if (_jobs.TryGetValue(url, out var existing) &&
                (existing.Status == "queued" || existing.Status == "running"))
            {
                ApplyMetadata(existing, metadata);
                if (existing.Status == "queued" && priority > existing.Priority)
                {
                    existing.Priority = priority;
                    var queued = _queue.FirstOrDefault(x => x.Job.Url == url);
                    if (queued != null)
                        queued.Order = --_nextPromotedOrder;
                }
                PersistQueueLocked();
                StateWebsocket.HighlightsIndexChanged(existing);
                return existing;
            }

            var job = new IndexJob
            {
                Url = url,
                Status = "queued",
                Source = source,
                Priority = priority,
                QueuedAt = DateTime.UtcNow
            };
            ApplyMetadata(job, metadata);
            _jobs[url] = job;
            _queue.Add(new QueueEntry { Job = job, Command = command, Order = ++_nextQueueOrder });
            PersistQueueLocked();
            StateWebsocket.HighlightsIndexChanged(job);
            EnsureWorkersLocked();
            return job;
        }
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

    private static async Task WorkerLoop()
    {
        while (true)
        {
            QueueEntry item;
            IndexJob job;
            lock (_lock)
            {
                LoadQueueLocked();
                if (_queue.Count == 0 || _activeWorkers > DesiredParallelism())
                {
                    _activeWorkers = Math.Max(0, _activeWorkers - 1);
                    return;
                }
                item = _queue
                    .OrderByDescending(x => x.Job.Priority)
                    .ThenBy(x => x.Order)
                    .First();
                _queue.Remove(item);
                job = item.Job;
                _running[job.Url] = item;
                job.Status = "running";
                job.Error = null;
                job.StartedAt = DateTime.UtcNow;
                PersistQueueLocked();
            }
            StateWebsocket.HighlightsIndexChanged(job);

            try
            {
                await RunCommand(item.Command, job.Url);
                lock (_lock)
                {
                    job.Status = "done";
                    job.CompletedAt = DateTime.UtcNow;
                    _running.Remove(job.Url);
                    TrimCompletedJobsLocked();
                    PersistQueueLocked();
                    EnsureWorkersLocked();
                }
                StateWebsocket.HighlightsChanged(job.Url);
            }
            catch (Exception ex)
            {
                Logger.w(nameof(StateHighlightsIndexer), $"Indexing failed for {job.Url}: {ex.Message}");
                lock (_lock)
                {
                    job.Status = "error";
                    job.Error = UserFacingError(ex.Message);
                    job.CompletedAt = DateTime.UtcNow;
                    _running.Remove(job.Url);
                    TrimCompletedJobsLocked();
                    PersistQueueLocked();
                    EnsureWorkersLocked();
                }
            }
            StateWebsocket.HighlightsIndexChanged(job);
        }
    }

    private static void ApplyMetadata(IndexJob job, IndexJobMetadata? metadata)
    {
        if (metadata == null)
            return;

        job.Title = SanitizeMetadata(metadata.Title, 300) ?? job.Title;
        job.Author = SanitizeMetadata(metadata.Author, 160) ?? job.Author;
        job.Thumbnail = SanitizeMetadata(metadata.Thumbnail, 2_000) ?? job.Thumbnail;
    }

    private static string? SanitizeMetadata(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var trimmed = value.Trim();
        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }

    private static string NormalizeSource(string? source, string fallback)
    {
        return source?.Trim().ToLowerInvariant() switch
        {
            "precompute" => "precompute",
            "playback" => "playback",
            "manual" => "manual",
            _ => fallback
        };
    }

    private static List<IndexJob> SnapshotJobsLocked()
    {
        var queued = _queue
            .OrderByDescending(x => x.Job.Priority)
            .ThenBy(x => x.Order)
            .ToList();

        var result = _running.Values
            .OrderBy(x => x.Job.StartedAt)
            .Select(x => SnapshotJob(x.Job))
            .ToList();

        for (var i = 0; i < queued.Count; i++)
            result.Add(SnapshotJob(queued[i].Job, i + 1));

        result.AddRange(_jobs.Values
            .Where(x => x.Status is "done" or "error" or "skipped")
            .OrderByDescending(x => x.CompletedAt)
            .Select(x => SnapshotJob(x)));

        return result;
    }

    private static IndexJob SnapshotJob(IndexJob job, int position = 0)
    {
        return new IndexJob
        {
            Url = job.Url,
            Status = job.Status,
            Error = job.Error,
            Title = job.Title,
            Author = job.Author,
            Thumbnail = job.Thumbnail,
            Source = job.Source,
            Priority = job.Priority,
            Position = position,
            QueuedAt = job.QueuedAt,
            StartedAt = job.StartedAt,
            CompletedAt = job.CompletedAt
        };
    }

    private static void TrimCompletedJobsLocked()
    {
        var removable = _jobs.Values
            .Where(x => x.Status is "done" or "error" or "skipped")
            .OrderByDescending(x => x.CompletedAt)
            .Skip(MaxCompletedJobs)
            .Select(x => x.Url)
            .ToList();
        foreach (var url in removable)
            _jobs.Remove(url);
    }

    private static void LoadQueueLocked()
    {
        if (_queueLoaded)
            return;

        _queueLoaded = true;
        var path = Path.Combine(Directories.Base, QueueFileName);
        if (!File.Exists(path))
            return;

        try
        {
            var snapshot = GJsonSerializer.Deserialize<IndexQueueSnapshot>(File.ReadAllText(path));
            if (snapshot?.FormatVersion != IndexQueueSnapshot.CurrentFormatVersion)
                return;

            _nextQueueOrder = snapshot.NextQueueOrder;
            _nextPromotedOrder = snapshot.NextPromotedOrder;
            foreach (var persisted in snapshot.Entries)
            {
                if (string.IsNullOrWhiteSpace(persisted.Job?.Url) || string.IsNullOrWhiteSpace(persisted.Command))
                    continue;

                var job = persisted.Job;
                job.Status = "queued";
                job.Error = null;
                job.StartedAt = null;
                job.Position = 0;
                job.QueuedAt = job.QueuedAt == default ? DateTime.UtcNow : job.QueuedAt;
                job.Source = NormalizeSource(job.Source, "precompute");
                _jobs[job.Url] = job;
                _queue.Add(new QueueEntry { Job = job, Command = persisted.Command, Order = persisted.Order });
                _nextQueueOrder = Math.Max(_nextQueueOrder, persisted.Order);
            }

            EnsureWorkersLocked();
        }
        catch (Exception ex)
        {
            Logger.w(nameof(StateHighlightsIndexer), $"Could not restore smart chapters queue: {ex.Message}");
        }
    }

    private static void PersistQueueLocked()
    {
        var path = Path.Combine(Directories.Base, QueueFileName);
        var snapshot = new IndexQueueSnapshot
        {
            NextQueueOrder = _nextQueueOrder,
            NextPromotedOrder = _nextPromotedOrder,
            Entries = _queue.Concat(_running.Values)
                .Select(x => new PersistedQueueEntry { Job = SnapshotJob(x.Job), Command = x.Command, Order = x.Order })
                .ToList()
        };

        var temporaryPath = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            File.WriteAllText(temporaryPath, GJsonSerializer.Serialize(snapshot));
            File.Move(temporaryPath, path, true);
        }
        catch (Exception ex)
        {
            Logger.w(nameof(StateHighlightsIndexer), $"Could not persist smart chapters queue: {ex.Message}");
        }
        finally
        {
            if (File.Exists(temporaryPath))
                File.Delete(temporaryPath);
        }
    }

    private static bool HasRequiredOutput(VideoHighlightSet? highlights)
    {
        if ((highlights?.Segments.Count ?? 0) == 0)
            return false;

        var outputLanguage = GrayjaySettings.Instance.XrayPanel.GenerationLanguageName();
        if (outputLanguage == null)
            return true;

        var transcriptLanguage = NormalizeLanguageCode(highlights?.TranscriptLanguage);
        if (transcriptLanguage == null || transcriptLanguage == "und")
            return true;

        var outputLanguageCode = OutputLanguageCode(outputLanguage);
        if (outputLanguageCode == transcriptLanguage)
            return true;

        return string.Equals(highlights?.TranslatedSubtitles?.Language, outputLanguage, StringComparison.OrdinalIgnoreCase);
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

    // Récupère les sous-titres de la vidéo via le moteur Grayjay (plugin) et les
    // écrit dans un VTT temporaire. Évite de re-scraper YouTube côté générateur
    // quand Grayjay a déjà les sous-titres. Retourne null si indisponible : le
    // générateur retombe alors sur son propre chemin (yt-dlp / Whisper).
    private static string? MaterializeSubtitle(string url)
    {
        try
        {
            if (StatePlatform.GetContentDetails(url) is not PlatformVideoDetails details)
                return null;
            var subs = details.Subtitles;
            if (subs == null || subs.Length == 0)
                return null;

            // Préférence : VTT, langue fr puis en, sinon n'importe quel VTT.
            bool IsVtt(string? f) => f != null && f.Contains("vtt", StringComparison.OrdinalIgnoreCase);
            bool NameHas(string? n, string lang) => n != null && n.Contains(lang, StringComparison.OrdinalIgnoreCase);
            var chosen = subs.FirstOrDefault(s => IsVtt(s.Format) && NameHas(s.Name, "fr"))
                ?? subs.FirstOrDefault(s => IsVtt(s.Format) && NameHas(s.Name, "en"))
                ?? subs.FirstOrDefault(s => IsVtt(s.Format))
                ?? subs.FirstOrDefault(s => IsVtt(s.Url));
            if (chosen == null)
                return null;

            var content = chosen.ToRaw().GetSubtitles();
            if (string.IsNullOrWhiteSpace(content))
                return null;

            var path = Path.Combine(Path.GetTempPath(), $"grayjay_smartchapters_{Guid.NewGuid():N}.vtt");
            File.WriteAllText(path, content);
            Logger.i(nameof(StateHighlightsIndexer), $"Provided subtitles for {url}: {chosen.Name} ({content.Length} chars)");
            return path;
        }
        catch (Exception ex)
        {
            Logger.w(nameof(StateHighlightsIndexer), $"Could not fetch Grayjay subtitles for {url}: {ex.Message}");
            return null;
        }
    }

    private static async Task RunCommand(string command, string url)
    {
        // {url} est substitué si présent, sinon l'URL est ajoutée en dernier argument.
        var commandLine = command.Contains("{url}") ? command.Replace("{url}", url) : $"{command} {url}";

        // {subtitles} : remplacé par "--subtitle-file <vtt>" quand Grayjay a les
        // sous-titres, par une chaîne vide sinon (le générateur se débrouille).
        string? subtitleFile = null;
        if (command.Contains("{subtitles}"))
        {
            subtitleFile = MaterializeSubtitle(url);
            commandLine = commandLine.Replace("{subtitles}",
                subtitleFile != null ? $"--subtitle-file \"{subtitleFile}\"" : "");
        }

        // {language} : langue de sortie choisie dans les réglages (Smart Analysis).
        // Vide en mode "Auto" -> le générateur garde la langue de la vidéo.
        var outputLanguage = GrayjaySettings.Instance.XrayPanel.GenerationLanguageName();
        if (command.Contains("{language}"))
        {
            commandLine = commandLine.Replace("{language}",
                outputLanguage != null ? $"--output-language \"{outputLanguage}\"" : "");
        }
        else if (outputLanguage != null && !commandLine.Contains("--output-language", StringComparison.Ordinal))
            commandLine += $" --output-language \"{outputLanguage}\"";

        if (outputLanguage != null)
            commandLine += " --translate-subtitles";

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
