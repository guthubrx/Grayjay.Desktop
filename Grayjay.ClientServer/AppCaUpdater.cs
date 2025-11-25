namespace Grayjay.ClientServer;

public static class AppCaUpdater
{
    private const string CaUrl = "https://curl.se/ca/cacert.pem";
    private const string CacheFilename = "curl-ca-bundle.pem";
    private const int MaxAgeDays = 30;

    private static readonly HttpClient Http = new HttpClient
    {
        Timeout = TimeSpan.FromSeconds(15)
    };

    public static async Task<FileInfo> EnsureCaBundleAsync(string appDataPath)
    {
        var file = new FileInfo(Path.Combine(appDataPath, CacheFilename));

        bool needsUpdate = !file.Exists || IsOlderThanDays(file, MaxAgeDays);
        if (needsUpdate)
        {
            await DownloadToFileAsync(CaUrl, file).ConfigureAwait(false);
        }

        return file;
    }

    private static bool IsOlderThanDays(FileInfo file, int days)
    {
        var age = DateTime.UtcNow - file.LastWriteTimeUtc;
        return age.TotalDays > days;
    }

    private static async Task DownloadToFileAsync(string url, FileInfo dest)
    {
        Directory.CreateDirectory(dest.DirectoryName!);

        using var response = await Http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();

        await using var input = await response.Content.ReadAsStreamAsync().ConfigureAwait(false);
        await using var output = File.Open(dest.FullName, FileMode.Create, FileAccess.Write, FileShare.None);

        await input.CopyToAsync(output).ConfigureAwait(false);
    }
}
