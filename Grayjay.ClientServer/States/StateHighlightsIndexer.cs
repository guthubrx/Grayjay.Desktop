using System.Diagnostics;
using System.Text.RegularExpressions;
using Grayjay.ClientServer.Constants;
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
        public required string Status { get; set; } // queued | running | done | error
        public string? Error { get; set; }
    }

    private static readonly object _lock = new();
    private static readonly Dictionary<string, IndexJob> _jobs = new();
    private static readonly Queue<(string Url, string Command)> _queue = new();
    private static int _activeWorkers = 0;
    private const int DefaultParallelism = 1;
    private const int MaxParallelism = 24;
    private const string ParallelismFileName = "smart-chapters-parallelism";

    // Garde-fou anti-injection : l'URL est interpolée dans une ligne shell,
    // on refuse tout métacaractère shell.
    private static readonly Regex _safeUrl = new(@"^https?://[^\s'""`;|&$<>(){}\\]+$", RegexOptions.Compiled);

    public static List<IndexJob> GetJobs()
    {
        lock (_lock)
            return _jobs.Values.ToList();
    }

    public static IndexJob Enqueue(string url, string command)
    {
        if (string.IsNullOrWhiteSpace(url))
            throw new ArgumentException("Missing url");
        if (string.IsNullOrWhiteSpace(command))
            throw new ArgumentException("No generator command configured");

        url = url.Trim();
        if (!_safeUrl.IsMatch(url))
            throw new ArgumentException("Unsafe or invalid url");

        lock (_lock)
        {
            if (_jobs.TryGetValue(url, out var existing) &&
                (existing.Status == "queued" || existing.Status == "running"))
                return existing;

            var job = new IndexJob { Url = url, Status = "queued" };
            _jobs[url] = job;
            _queue.Enqueue((url, command));
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
            (string Url, string Command) item;
            IndexJob job;
            lock (_lock)
            {
                if (_queue.Count == 0 || _activeWorkers > DesiredParallelism())
                {
                    _activeWorkers = Math.Max(0, _activeWorkers - 1);
                    return;
                }
                item = _queue.Dequeue();
                job = _jobs[item.Url];
                job.Status = "running";
                job.Error = null;
            }
            StateWebsocket.HighlightsIndexChanged(job);

            try
            {
                await RunCommand(item.Command, item.Url);
                lock (_lock)
                {
                    job.Status = "done";
                    EnsureWorkersLocked();
                }
                StateWebsocket.HighlightsChanged(item.Url);
            }
            catch (Exception ex)
            {
                Logger.w(nameof(StateHighlightsIndexer), $"Indexing failed for {item.Url}: {ex.Message}");
                lock (_lock)
                {
                    job.Status = "error";
                    job.Error = UserFacingError(ex.Message);
                    EnsureWorkersLocked();
                }
            }
            StateWebsocket.HighlightsIndexChanged(job);
        }
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
        if (command.Contains("{language}"))
        {
            var lang = GrayjaySettings.Instance.XrayPanel.GenerationLanguageName();
            commandLine = commandLine.Replace("{language}",
                lang != null ? $"--output-language \"{lang}\"" : "");
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
