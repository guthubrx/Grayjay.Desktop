using System.Diagnostics;

namespace Grayjay.ClientServer.States;

public static class StateSmartSearchCommand
{
    public static async Task<string> Run(string command, string input, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(command) || !Path.IsPathFullyQualified(command) || !File.Exists(command))
            throw new InvalidOperationException("Configure an absolute path to the Smart Search translator executable.");

        var startInfo = new ProcessStartInfo
        {
            FileName = command,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        using var process = new Process { StartInfo = startInfo };
        process.Start();
        await process.StandardInput.WriteAsync(input);
        process.StandardInput.Close();
        var stdoutTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
        var stderrTask = process.StandardError.ReadToEndAsync(cancellationToken);
        await process.WaitForExitAsync(cancellationToken);
        var stdout = await stdoutTask;
        var stderr = await stderrTask;
        if (process.ExitCode != 0)
            throw new InvalidOperationException(string.IsNullOrWhiteSpace(stderr) ? "Smart Search translator failed." : stderr.Trim());
        if (string.IsNullOrWhiteSpace(stdout))
            throw new InvalidOperationException("Smart Search translator returned no JSON.");
        return stdout;
    }
}
