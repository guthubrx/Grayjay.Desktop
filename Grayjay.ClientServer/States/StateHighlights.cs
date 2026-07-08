using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Grayjay.ClientServer.Models.Highlights;
using Grayjay.ClientServer.Serializers;
using Grayjay.Desktop.POC;
using Grayjay.Engine.Models.Feed;

namespace Grayjay.ClientServer.States;

public static class StateHighlights
{
    private const string StoreName = "highlights";
    private const double InterestMinScore = 0.55;
    private const double InterestStrongScore = 0.88;
    private const double InterestExcellentScore = 0.93;

    private static DirectoryInfo StoreDirectory
    {
        get
        {
            var dir = new DirectoryInfo(Path.Combine(StateApp.GetAppDirectory().FullName, StoreName));
            if (!dir.Exists)
                dir.Create();
            return dir;
        }
    }

    private static FileSystemWatcher? _watcher;
    private static System.Threading.Timer? _debounce;

    // Surveille le dossier highlights : toute creation/modif/suppression de
    // fichier (par l'app, le script de batch, ou a la main) notifie le frontend
    // pour qu'il rafraichisse le panneau et les marqueurs sans redemarrer.
    static StateHighlights()
    {
        try
        {
            var dir = StoreDirectory;
            _watcher = new FileSystemWatcher(dir.FullName, "*.json")
            {
                NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.Size,
                EnableRaisingEvents = true
            };
            FileSystemEventHandler onChange = (_, _) => NotifyDebounced();
            _watcher.Created += onChange;
            _watcher.Changed += onChange;
            _watcher.Deleted += onChange;
            _watcher.Renamed += (_, _) => NotifyDebounced();
        }
        catch (Exception ex)
        {
            Logger.w(nameof(StateHighlights), $"Failed to start highlights watcher: {ex.Message}");
        }
    }

    // Regroupe les rafales d'evenements (une ecriture = plusieurs events) en une
    // seule notification.
    private static void NotifyDebounced()
    {
        _debounce?.Dispose();
        _debounce = new System.Threading.Timer(_ => StateWebsocket.HighlightsChanged(""), null, 500, Timeout.Infinite);
    }

    public static VideoHighlightSet? Get(string videoUrl)
    {
        if (string.IsNullOrWhiteSpace(videoUrl))
            return null;

        var file = GetFile(videoUrl);
        if (!file.Exists)
            return FindByUrl(videoUrl);

        return Read(file);
    }

    public static List<VideoHighlightSet> GetAll()
    {
        return StoreDirectory
            .GetFiles("*.json")
            .Select(Read)
            .Where(x => x != null)
            .Select(x => x!)
            .OrderByDescending(x => x.UpdatedAt)
            .ToList();
    }

    public static List<VideoHighlightSummary> GetSummaries()
    {
        var sets = GetAll();
        var cachedVideos = StateCache.GetCachedVideos(sets
            .Where(set => set.Video == null)
            .Select(set => set.VideoUrl));

        return sets
            .Select(set => CreateSummary(set, cachedVideos.GetValueOrDefault(set.VideoUrl)))
            .ToList();
    }

    private static VideoHighlightSummary CreateSummary(VideoHighlightSet set, PlatformVideo? cachedVideo)
    {
        var segments = set.Segments ?? new List<VideoHighlightSegment>();
        var scored = segments.Where(s => s.Score.HasValue).ToList();
        var useful = segments.Where(s => (s.Score ?? InterestMinScore) >= InterestMinScore).ToList();
        var video = set.Video ?? cachedVideo;

        return new VideoHighlightSummary
        {
            VideoUrl = set.VideoUrl,
            Source = set.Source ?? "external",
            UpdatedAt = set.UpdatedAt,
            SegmentCount = scored.Count > 0 ? useful.Count : segments.Count,
            TotalDuration = segments.Sum(s => Math.Max(0, s.End - s.Start)),
            InterestingDuration = scored.Count > 0
                ? useful.Sum(s => Math.Max(0, s.End - s.Start))
                : segments.Sum(s => Math.Max(0, s.End - s.Start)),
            AverageScore = scored.Count > 0 ? scored.Average(s => ClampScore(s.Score!.Value)) : null,
            TopScore = scored.Count > 0 ? scored.Max(s => ClampScore(s.Score!.Value)) : null,
            StrongSegmentCount = scored.Count(s => ClampScore(s.Score!.Value) >= InterestStrongScore),
            ExcellentSegmentCount = scored.Count(s => ClampScore(s.Score!.Value) >= InterestExcellentScore),
            GlobalSummary = set.GlobalSummary,
            Video = video
        };
    }

    private static double ClampScore(double value)
    {
        if (double.IsNaN(value) || double.IsInfinity(value))
            return 0;
        return Math.Max(0, Math.Min(1, value));
    }

    public static VideoHighlightSet CreateOrUpdate(VideoHighlightSet set, PlatformVideo? fallbackVideo = null)
    {
        Validate(set);

        var existing = Get(set.VideoUrl);
        set.SchemaVersion = set.SchemaVersion <= 0 ? 1 : set.SchemaVersion;
        set.Source = string.IsNullOrWhiteSpace(set.Source) ? "external" : set.Source;
        set.CreatedAt = existing?.CreatedAt ?? (set.CreatedAt == default ? DateTime.UtcNow : set.CreatedAt.ToUniversalTime());
        set.UpdatedAt = DateTime.UtcNow;
        set.Video ??= fallbackVideo ?? existing?.Video;
        set.Segments = set.Segments
            .Where(s => s.End > s.Start)
            .OrderBy(s => s.Start)
            .ToList();

        var file = GetFile(set.VideoUrl);
        var json = GJsonSerializer.AndroidCompatible.SerializeObj(set);
        File.WriteAllText(file.FullName, json, Encoding.UTF8);
        return set;
    }

    public static bool Delete(string videoUrl)
    {
        var file = GetFile(videoUrl);
        if (!file.Exists)
            file = FindFileByUrl(videoUrl);

        if (file == null || !file.Exists)
            return false;

        file.Delete();
        return true;
    }

    private static VideoHighlightSet? FindByUrl(string videoUrl)
    {
        return GetAll().FirstOrDefault(x => UrlsMatch(x.VideoUrl, videoUrl));
    }

    private static FileInfo? FindFileByUrl(string videoUrl)
    {
        foreach (var file in StoreDirectory.GetFiles("*.json"))
        {
            var set = Read(file);
            if (set != null && UrlsMatch(set.VideoUrl, videoUrl))
                return file;
        }

        return null;
    }

    private static VideoHighlightSet? Read(FileInfo file)
    {
        try
        {
            var json = File.ReadAllText(file.FullName, Encoding.UTF8);
            return GJsonSerializer.AndroidCompatible.DeserializeObj<VideoHighlightSet>(json);
        }
        catch (Exception ex)
        {
            Logger.w(nameof(StateHighlights), $"Failed to read highlight set [{file.Name}]: {ex.Message}");
            return null;
        }
    }

    private static void Validate(VideoHighlightSet set)
    {
        if (string.IsNullOrWhiteSpace(set.VideoUrl))
            throw new ArgumentException("Missing videoUrl");
        if (set.Segments.Count == 0)
            throw new ArgumentException("Missing segments");

        foreach (var segment in set.Segments)
        {
            if (string.IsNullOrWhiteSpace(segment.Title))
                throw new ArgumentException("Each segment needs a title");
            if (segment.Start < 0 || segment.End <= segment.Start)
                throw new ArgumentException($"Invalid segment range for [{segment.Title}]");
        }
    }

    private static FileInfo GetFile(string videoUrl)
    {
        return new FileInfo(Path.Combine(StoreDirectory.FullName, Hash(videoUrl) + ".json"));
    }

    private static bool UrlsMatch(string? storedUrl, string? requestedUrl)
    {
        if (string.IsNullOrWhiteSpace(storedUrl) || string.IsNullOrWhiteSpace(requestedUrl))
            return false;

        if (string.Equals(storedUrl.Trim(), requestedUrl.Trim(), StringComparison.Ordinal))
            return true;

        var storedYoutubeId = ExtractYouTubeVideoId(storedUrl);
        var requestedYoutubeId = ExtractYouTubeVideoId(requestedUrl);
        return storedYoutubeId != null &&
            requestedYoutubeId != null &&
            string.Equals(storedYoutubeId, requestedYoutubeId, StringComparison.Ordinal);
    }

    private static string? ExtractYouTubeVideoId(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var match = Regex.Match(
            value,
            @"(?:youtube(?:-nocookie)?\.com/(?:watch\?[^#\s]*v=|embed/|shorts/|live/)|youtu\.be/)([A-Za-z0-9_-]{11})",
            RegexOptions.IgnoreCase);
        if (match.Success)
            return match.Groups[1].Value;

        match = Regex.Match(value, @"(?:[?&]v=)([A-Za-z0-9_-]{11})", RegexOptions.IgnoreCase);
        return match.Success ? match.Groups[1].Value : null;
    }

    private static string Hash(string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value.Trim()));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
