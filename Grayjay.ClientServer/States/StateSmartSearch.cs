using System.Text.Json;
using Grayjay.ClientServer.Models.SmartSearch;
using Grayjay.ClientServer.Store;
using Grayjay.Desktop.POC.Port.States;
using Grayjay.Engine.Models;
using Grayjay.Engine.Models.Feed;
using Grayjay.Engine.Pagers;

namespace Grayjay.ClientServer.States;

public static class StateSmartSearch
{
    private const int MaxLanguages = 6;
    private const int MaxDisplayTranslationsPerRequest = 6;
    private const long CachePruneIntervalSeconds = 6 * 60 * 60;
    private static readonly HashSet<string> SupportedLanguages = ["ar", "bn", "cs", "da", "de", "el", "en", "es", "fa", "fi", "he", "hi", "hu", "id", "it", "ja", "ko", "ms", "nb", "nl", "pl", "pt", "ro", "ru", "sv", "th", "tr", "uk", "vi", "zh-Hans", "zh-Hant"];
    private static readonly object Lock = new();
    private static readonly object CachePruneLock = new();
    private static readonly Dictionary<string, ActiveSession> Sessions = [];
    private sealed class TranslationCacheEntry
    {
        public required string Key { get; init; }
        public required string Text { get; set; }
        public required long ExpiresAt { get; set; }
    }
    private static readonly ManagedStore<TranslationCacheEntry> TranslationCache = new ManagedStore<TranslationCacheEntry>("smartSearchTranslations_0")
        .WithUnique(x => x.Key)
        .Load();
    private static long _nextCachePruneAt;

    private sealed class DisplayTranslation
    {
        public required string Key { get; init; }
        public required string Kind { get; init; }
        public required string CacheKey { get; init; }
        public required string Text { get; init; }
    }

    private sealed class ActiveSession
    {
        public required SmartSearchSession Session { get; init; }
        public required Dictionary<string, IPager<PlatformContent>> Pagers { get; init; }
        public Dictionary<string, string> TranslatedTitles { get; } = new(StringComparer.OrdinalIgnoreCase);
        public Dictionary<string, string> TranslatedCreatorNames { get; } = new(StringComparer.OrdinalIgnoreCase);
    }

    public static async Task<SmartSearchSession> Load(SmartSearchRequest request, CancellationToken cancellationToken)
    {
        Validate(request);
        var translated = await TranslateQueries(request, cancellationToken);
        var session = new SmartSearchSession { SessionId = request.SessionId };
        var pagers = new Dictionary<string, IPager<PlatformContent>>();
        foreach (var item in translated)
        {
            var variant = new SmartSearchVariant { Language = item.Language, Query = item.Query };
            try
            {
                var pager = request.Type switch
                {
                    ContentType.CHANNEL => StatePlatform.SearchChannelsLazy(item.Query, request.ExcludePlugins),
                    ContentType.PLAYLIST => StatePlatform.SearchPlaylistsLazy(item.Query, request.ExcludePlugins),
                    _ => StatePlatform.SearchLazy(item.Query, null, request.Order, request.Filters, request.ExcludePlugins)
                };
                pager.NextPage();
                pagers[item.Language] = pager;
                variant.Status = "ready";
            }
            catch (Exception ex)
            {
                variant.Status = "error";
                variant.Error = CleanError(ex.Message);
            }
            session.Variants.Add(variant);
        }
        lock (Lock)
            Sessions[session.SessionId] = new ActiveSession { Session = session, Pagers = pagers };
        return Snapshot(session.SessionId);
    }

    public static SmartSearchSession Snapshot(string sessionId)
    {
        ActiveSession active;
        lock (Lock)
        {
            if (!Sessions.TryGetValue(sessionId, out active!))
                throw new KeyNotFoundException("Smart Search session not found.");
        }

        var clone = new SmartSearchSession { SessionId = active.Session.SessionId, Error = active.Session.Error };
        var contents = new Dictionary<string, PlatformContent>(StringComparer.OrdinalIgnoreCase);
        var languages = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
        var firstLanguage = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var source in active.Session.Variants)
        {
            if (active.Pagers.TryGetValue(source.Language, out var pager))
            {
                foreach (var content in pager.GetResults().Where(x => x is not PlatformContentPlaceholder))
                {
                    var key = ContentKey(content);
                    if (!contents.ContainsKey(key))
                    {
                        contents[key] = content;
                        languages[key] = [];
                        firstLanguage[key] = source.Language;
                    }
                    if (!languages[key].Contains(source.Language))
                        languages[key].Add(source.Language);
                }
            }
        }
        foreach (var source in active.Session.Variants)
        {
            var variant = new SmartSearchVariant { Language = source.Language, Query = source.Query, Status = source.Status, Error = source.Error };
            foreach (var key in firstLanguage.Where(x => x.Value == source.Language).Select(x => x.Key))
                variant.Results.Add(new SmartSearchResult
                {
                    Key = key,
                    Content = contents[key],
                    OriginalTitle = contents[key].Name,
                    Languages = languages[key],
                    TranslatedTitle = active.TranslatedTitles.GetValueOrDefault(key),
                    CreatorKey = CreatorKey(contents[key]),
                    OriginalCreatorName = contents[key].Author?.Name,
                    TranslatedCreatorName = active.TranslatedCreatorNames.GetValueOrDefault(CreatorKey(contents[key]))
                });
            clone.Variants.Add(variant);
        }
        return clone;
    }

    public static async Task<SmartSearchSession> TranslateTitles(SmartSearchTitleRequest request, CancellationToken cancellationToken)
    {
        var snapshot = Snapshot(request.SessionId);
        var requestedKeys = request.Keys?.Count > 0
            ? request.Keys.ToHashSet(StringComparer.OrdinalIgnoreCase)
            : null;
        var translations = snapshot.Variants
            .SelectMany(x => x.Results)
            .GroupBy(x => x.Key)
            .Select(x => x.First())
            .SelectMany(DisplayTranslations)
            .Where(item => requestedKeys == null || requestedKeys.Contains(item.Key))
            .GroupBy(item => item.Key, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .Take(MaxDisplayTranslationsPerRequest)
            .ToList();
        if (translations.Count == 0)
            return snapshot;
        var cached = translations
            .Select(item => (Item: item, Translation: GetCached(item.Kind, request.TargetLanguage, item.CacheKey)))
            .Where(x => x.Translation != null)
            .ToList();
        lock (Lock)
        {
            if (!Sessions.TryGetValue(request.SessionId, out var active))
                return snapshot;
            foreach (var entry in cached)
                ApplyTranslation(active, entry.Item, entry.Translation!);
        }
        var cachedKeys = cached.Select(entry => entry.Item.Key).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var pending = translations.Where(item => !cachedKeys.Contains(item.Key)).ToList();
        if (pending.Count == 0)
            return Snapshot(request.SessionId);
        var payload = JsonSerializer.Serialize(new
        {
            version = 1,
            operation = "translate-titles",
            targetLanguage = request.TargetLanguage,
            titles = pending.Select(x => new { key = x.Key, text = x.Text, kind = x.Kind })
        });
        var output = await StateSmartSearchCommand.Run(request.TranslatorCommand, payload, cancellationToken);
        var translated = ParseTranslations(output, "key");
        var pendingByKey = pending.ToDictionary(item => item.Key, StringComparer.OrdinalIgnoreCase);
        lock (Lock)
        {
            if (!Sessions.TryGetValue(request.SessionId, out var active))
                return snapshot;
            foreach (var translation in translated)
            {
                if (!pendingByKey.TryGetValue(translation.Key, out var item))
                    continue;
                ApplyTranslation(active, item, translation.Value);
                Cache(item.Kind, request.TargetLanguage, item.CacheKey, translation.Value, CacheLifetime(item.Kind));
            }
        }
        return Snapshot(request.SessionId);
    }

    private static async Task<List<(string Language, string Query)>> TranslateQueries(SmartSearchRequest request, CancellationToken cancellationToken)
    {
        var cached = request.Languages
            .Select(language => (Language: language, Query: GetCached("query", language, request.Query)))
            .Where(x => x.Query != null)
            .ToDictionary(x => x.Language, x => x.Query!, StringComparer.OrdinalIgnoreCase);
        var pending = request.Languages.Where(x => !cached.ContainsKey(x)).ToList();
        if (pending.Count == 0)
            return request.Languages.Select(language => (language, cached[language])).ToList();
        var payload = JsonSerializer.Serialize(new { version = 1, operation = "translate-queries", sourceLanguage = "fr", targetLanguages = pending, query = request.Query });
        var output = await StateSmartSearchCommand.Run(request.TranslatorCommand, payload, cancellationToken);
        var translations = ParseTranslations(output, "language");
        foreach (var translation in translations)
        {
            cached[translation.Key] = translation.Value;
            Cache("query", translation.Key, request.Query, translation.Value, TimeSpan.FromDays(1));
        }
        return request.Languages.Where(cached.ContainsKey).Select(language => (language, cached[language])).ToList();
    }

    private static Dictionary<string, string> ParseTranslations(string output, string keyProperty)
    {
        using var document = JsonDocument.Parse(output);
        if (!document.RootElement.TryGetProperty("translations", out var values) || values.ValueKind != JsonValueKind.Array)
            throw new InvalidOperationException("Smart Search translator returned an invalid translations array.");
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var value in values.EnumerateArray())
        {
            if (!value.TryGetProperty(keyProperty, out var key) || !value.TryGetProperty("text", out var text))
                continue;
            var normalizedKey = key.GetString()?.Trim();
            var normalizedText = text.GetString()?.Trim();
            if (!string.IsNullOrWhiteSpace(normalizedKey) && !string.IsNullOrWhiteSpace(normalizedText))
                result[normalizedKey] = normalizedText;
        }
        return result;
    }

    private static void Validate(SmartSearchRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.SessionId) || string.IsNullOrWhiteSpace(request.Query) || request.Query.Length > 500)
            throw new ArgumentException("Invalid Smart Search query.");
        if (request.Languages.Count == 0 || request.Languages.Count > MaxLanguages || request.Languages.Distinct(StringComparer.OrdinalIgnoreCase).Count() != request.Languages.Count || request.Languages.Any(x => !SupportedLanguages.Contains(x)))
            throw new ArgumentException("Select between one and six supported Smart Search languages.");
    }

    private static string ContentKey(PlatformContent content)
    {
        if (!string.IsNullOrWhiteSpace(content.Url))
            return content.Url;
        return $"{content.ID.PluginID}:{content.ID.Value}";
    }

    private static string CreatorKey(PlatformContent content)
    {
        if (!string.IsNullOrWhiteSpace(content.Author?.Url))
            return content.Author.Url;
        if (!string.IsNullOrWhiteSpace(content.Author?.Name))
            return $"{content.ID.PluginID}:{content.Author.Name}";
        return string.Empty;
    }

    private static IEnumerable<DisplayTranslation> DisplayTranslations(SmartSearchResult result)
    {
        if (!string.IsNullOrWhiteSpace(result.OriginalTitle))
        {
            yield return new DisplayTranslation
            {
                Key = $"title:{result.Key}",
                Kind = "title",
                CacheKey = result.Key,
                Text = result.OriginalTitle
            };
        }

        if (!string.IsNullOrWhiteSpace(result.CreatorKey) && !string.IsNullOrWhiteSpace(result.OriginalCreatorName))
        {
            yield return new DisplayTranslation
            {
                Key = $"creator:{result.CreatorKey}",
                Kind = "creator",
                CacheKey = result.CreatorKey,
                Text = result.OriginalCreatorName
            };
        }
    }

    private static void ApplyTranslation(ActiveSession active, DisplayTranslation item, string value)
    {
        if (item.Kind == "creator")
            active.TranslatedCreatorNames[item.CacheKey] = value;
        else
            active.TranslatedTitles[item.CacheKey] = value;
    }

    private static TimeSpan CacheLifetime(string kind) => kind switch
    {
        "query" => TimeSpan.FromDays(1),
        "creator" => TimeSpan.FromDays(7),
        _ => TimeSpan.FromDays(30)
    };

    private static string? GetCached(string kind, string language, string source)
    {
        PruneExpiredCache();
        var key = $"{kind}|{language}|{source}";
        var entry = TranslationCache.GetObjects().FirstOrDefault(x => x.Key == key && x.ExpiresAt > DateTimeOffset.UtcNow.ToUnixTimeSeconds());
        return entry?.Text;
    }

    private static void Cache(string kind, string language, string source, string text, TimeSpan duration)
    {
        PruneExpiredCache();
        var key = $"{kind}|{language}|{source}";
        TranslationCache.CreateOrUpdate(x => x.Key, key,
            () => new TranslationCacheEntry { Key = key, Text = text, ExpiresAt = DateTimeOffset.UtcNow.Add(duration).ToUnixTimeSeconds() },
            entry => { entry.Text = text; entry.ExpiresAt = DateTimeOffset.UtcNow.Add(duration).ToUnixTimeSeconds(); });
    }

    private static void PruneExpiredCache()
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        List<TranslationCacheEntry> expired;
        lock (CachePruneLock)
        {
            if (_nextCachePruneAt > now)
                return;
            _nextCachePruneAt = now + CachePruneIntervalSeconds;
            expired = TranslationCache.FindObjects(x => x.ExpiresAt <= now);
        }
        foreach (var entry in expired)
            TranslationCache.Delete(entry);
    }

    private static string CleanError(string message) => string.IsNullOrWhiteSpace(message) ? "Smart Search failed." : message.Replace('\n', ' ').Trim()[..Math.Min(240, message.Length)];
}
