using System.Diagnostics;
using System.Text.RegularExpressions;
using Grayjay.Desktop.POC;

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
    private static bool _running = false;

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

            if (!_running)
            {
                _running = true;
                _ = Task.Run(WorkerLoop);
            }
            return job;
        }
    }

    private static async Task WorkerLoop()
    {
        while (true)
        {
            (string Url, string Command) item;
            IndexJob job;
            lock (_lock)
            {
                if (_queue.Count == 0)
                {
                    _running = false;
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
                lock (_lock) job.Status = "done";
                StateWebsocket.HighlightsChanged(item.Url);
            }
            catch (Exception ex)
            {
                Logger.w(nameof(StateHighlightsIndexer), $"Indexing failed for {item.Url}: {ex.Message}");
                lock (_lock)
                {
                    job.Status = "error";
                    job.Error = ex.Message;
                }
            }
            StateWebsocket.HighlightsIndexChanged(job);
        }
    }

    private static async Task RunCommand(string command, string url)
    {
        // {url} est substitué si présent, sinon l'URL est ajoutée en dernier argument.
        var commandLine = command.Contains("{url}") ? command.Replace("{url}", url) : $"{command} {url}";

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
}
