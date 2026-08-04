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
    private const int MaxDiscoveryLanguages = MaxLanguages + 2;
    private const int MaxDiscoveryAxes = 4;
    private const int MaxDiscoveryVariants = MaxDiscoveryLanguages * MaxDiscoveryAxes;
    private const int DefaultDiscoveryParallelism = 3;
    private const int MaxDiscoveryParallelism = 32;
    private const int MaxDisplayTranslationsPerRequest = 6;
    private const int MaxActiveSessions = 8;
    private const long CachePruneIntervalSeconds = 6 * 60 * 60;
    private static readonly TimeSpan SessionLifetime = TimeSpan.FromMinutes(20);
    private static readonly TimeSpan SessionPruneInterval = TimeSpan.FromMinutes(1);
    private static readonly HashSet<string> SupportedLanguages = ["ar", "bn", "cs", "da", "de", "el", "en", "es", "fa", "fi", "fr", "he", "hi", "hu", "id", "it", "ja", "ko", "ms", "nb", "nl", "pl", "pt", "ro", "ru", "sv", "th", "tr", "uk", "vi", "zh-Hans", "zh-Hant"];
    private static readonly HashSet<string> DiscoveryAxisIds = ["core", "context", "impact", "debate"];
    private static readonly object Lock = new();
    private static readonly object CachePruneLock = new();
    private static readonly Dictionary<string, ActiveSession> Sessions = [];
    private static readonly System.Threading.Timer SessionPruneTimer = new(_ => PruneSessions(), null, SessionPruneInterval, SessionPruneInterval);
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
        public required SmartSearchRequest Request { get; init; }
        public SemaphoreSlim? SearchLimiter { get; init; }
        public DateTimeOffset LastAccessedAt { get; set; } = DateTimeOffset.UtcNow;
        public Dictionary<string, string> TranslatedTitles { get; } = new(StringComparer.OrdinalIgnoreCase);
        public Dictionary<string, string> TranslatedCreatorNames { get; } = new(StringComparer.OrdinalIgnoreCase);
    }

    public static async Task<SmartSearchSession> Load(SmartSearchRequest request, CancellationToken cancellationToken)
    {
        Validate(request);
        var session = new SmartSearchSession { SessionId = request.SessionId };
        var variants = request.Discovery == null
            ? (await TranslateQueries(request, cancellationToken))
                .Select((item, index) => new SmartSearchVariant { Id = $"standard:{index}:{item.Language}", Language = item.Language, Query = item.Query })
                .ToList()
            : await PrepareDiscoveryVariants(request, cancellationToken);
        session.Variants.AddRange(variants);
        var active = new ActiveSession
        {
            Session = session,
            Pagers = [],
            Request = request,
            SearchLimiter = request.Discovery == null ? null : new SemaphoreSlim(request.MaxParallelism ?? DefaultDiscoveryParallelism, request.MaxParallelism ?? DefaultDiscoveryParallelism)
        };
        lock (Lock)
        {
            PruneSessionsLocked(DateTimeOffset.UtcNow);
            RemoveSessionLocked(session.SessionId);
            Sessions[session.SessionId] = active;
            TrimSessionsLocked();
        }

        if (request.Discovery == null)
            StartVariants(active, session.Variants, request);
        else
            StartNextDiscoveryStage(active);
        return Snapshot(session.SessionId);
    }

    public static SmartSearchSession StartNextDiscoveryStage(string sessionId)
    {
        lock (Lock)
        {
            var active = GetSessionLocked(sessionId);
            StartNextDiscoveryStage(active);
        }
        return Snapshot(sessionId);
    }

    public static void Close(string sessionId)
    {
        if (string.IsNullOrWhiteSpace(sessionId))
            return;

        lock (Lock)
            RemoveSessionLocked(sessionId);
    }

    private static void StartNextDiscoveryStage(ActiveSession active)
    {
        var stage = active.Session.Variants
            .Where(variant => variant.Status == "pending")
            .Select(variant => (int?)variant.Stage)
            .Min();
        if (!stage.HasValue)
            return;
        StartVariants(active, active.Session.Variants.Where(variant => variant.Status == "pending" && variant.Stage == stage.Value), active.Request);
    }

    private static void StartVariants(ActiveSession active, IEnumerable<SmartSearchVariant> variants, SmartSearchRequest request)
    {
        foreach (var variant in variants)
        {
            variant.Status = "loading";
            try
            {
                var pager = request.Type switch
                {
                    ContentType.CHANNEL => StatePlatform.SearchChannelsLazy(variant.Query, request.ExcludePlugins),
                    ContentType.PLAYLIST => StatePlatform.SearchPlaylistsLazy(variant.Query, request.ExcludePlugins),
                    _ => StatePlatform.SearchLazy(variant.Query, null, request.Order, request.Filters, request.ExcludePlugins, active.SearchLimiter)
                };
                pager.NextPage();
                active.Pagers[variant.Id] = pager;
                variant.Status = "ready";
            }
            catch (Exception ex)
            {
                variant.Status = "error";
                variant.Error = CleanError(ex.Message);
            }
        }
    }

    private static ActiveSession GetSessionLocked(string sessionId)
    {
        if (!TryGetSessionLocked(sessionId, out var active))
            throw new KeyNotFoundException("Smart Search session not found.");
        return active;
    }

    private static bool TryGetSessionLocked(string sessionId, out ActiveSession active)
    {
        PruneSessionsLocked(DateTimeOffset.UtcNow);
        if (!Sessions.TryGetValue(sessionId, out active!))
            return false;
        active.LastAccessedAt = DateTimeOffset.UtcNow;
        return true;
    }

    private static void PruneSessions()
    {
        lock (Lock)
            PruneSessionsLocked(DateTimeOffset.UtcNow);
    }

    private static void PruneSessionsLocked(DateTimeOffset now)
    {
        foreach (var sessionId in Sessions
            .Where(entry => now - entry.Value.LastAccessedAt >= SessionLifetime)
            .Select(entry => entry.Key)
            .ToArray())
        {
            RemoveSessionLocked(sessionId);
        }
    }

    private static void TrimSessionsLocked()
    {
        foreach (var sessionId in Sessions
            .OrderBy(entry => entry.Value.LastAccessedAt)
            .SkipLast(MaxActiveSessions)
            .Select(entry => entry.Key)
            .ToArray())
        {
            RemoveSessionLocked(sessionId);
        }
    }

    private static void RemoveSessionLocked(string sessionId)
    {
        Sessions.Remove(sessionId);
    }

    public static SmartSearchSession Snapshot(string sessionId)
    {
        ActiveSession active;
        lock (Lock)
            active = GetSessionLocked(sessionId);

        var clone = new SmartSearchSession { SessionId = active.Session.SessionId, Error = active.Session.Error };
        var contents = new Dictionary<string, PlatformContent>(StringComparer.OrdinalIgnoreCase);
        var languages = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
        var firstLanguage = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var source in active.Session.Variants)
        {
            if (active.Pagers.TryGetValue(source.Id, out var pager))
            {
                foreach (var content in pager.GetResults().Where(x => x is not PlatformContentPlaceholder))
                {
                    var key = ContentKey(content);
                    if (!contents.ContainsKey(key))
                    {
                        contents[key] = content;
                        languages[key] = [];
                        firstLanguage[key] = source.Id;
                    }
                    if (!languages[key].Contains(source.Language))
                        languages[key].Add(source.Language);
                }
            }
        }
        foreach (var source in active.Session.Variants)
        {
            var variant = new SmartSearchVariant { Id = source.Id, Language = source.Language, Query = source.Query, Axis = source.Axis, Stage = source.Stage, Status = source.Status, Error = source.Error };
            foreach (var key in firstLanguage.Where(x => x.Value == source.Id).Select(x => x.Key))
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
            if (!TryGetSessionLocked(request.SessionId, out var active))
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
            if (!TryGetSessionLocked(request.SessionId, out var active))
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

    private static async Task<List<SmartSearchVariant>> PrepareDiscoveryVariants(SmartSearchRequest request, CancellationToken cancellationToken)
    {
        var discovery = request.Discovery!;
        var languages = DiscoveryLanguages(discovery.UserLanguage, request.Languages);
        var queries = discovery.Axes.ToDictionary(axis => axis.Id, _ => new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase), StringComparer.OrdinalIgnoreCase);
        var pending = new List<(SmartSearchDiscoveryAxis Axis, string Language, string SourceQuery)>();

        foreach (var axis in discovery.Axes)
        {
            var sourceQuery = QueryForLanguage(axis, "en")!;
            foreach (var language in languages)
            {
                var query = QueryForLanguage(axis, language) ?? GetCached("discovery-query", language, sourceQuery);
                if (query != null)
                    queries[axis.Id][language] = query;
                else
                    pending.Add((axis, language, sourceQuery));
            }
        }

        if (pending.Count > 0 && CanRunTranslator(request.TranslatorCommand))
        {
            var targetLanguages = pending.Select(item => item.Language).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            var payload = JsonSerializer.Serialize(new
            {
                version = 1,
                operation = "translate-query-variants",
                sourceLanguage = "en",
                targetLanguages,
                variants = discovery.Axes.Select(axis => new { key = axis.Id, text = QueryForLanguage(axis, "en") })
            });
            var output = await StateSmartSearchCommand.Run(request.TranslatorCommand, payload, cancellationToken);
            var translated = ParseDiscoveryTranslations(output);
            foreach (var item in pending)
            {
                if (!translated.TryGetValue((item.Axis.Id, item.Language), out var query))
                    continue;
                queries[item.Axis.Id][item.Language] = query;
                Cache("discovery-query", item.Language, item.SourceQuery, query, TimeSpan.FromDays(1));
            }
        }

        var variants = new List<SmartSearchVariant>();
        foreach (var language in languages)
        {
            var stage = DiscoveryStage(language, discovery.UserLanguage);
            foreach (var axis in discovery.Axes)
            {
                if (!queries[axis.Id].TryGetValue(language, out var query))
                    continue;
                variants.Add(new SmartSearchVariant
                {
                    Id = $"{stage}:{language}:{axis.Id}",
                    Language = language,
                    Query = query,
                    Axis = axis.Id,
                    Stage = stage
                });
            }
        }
        return variants;
    }

    private static List<string> DiscoveryLanguages(string userLanguage, IEnumerable<string> configuredLanguages)
    {
        return new[] { userLanguage, "en" }
            .Concat(configuredLanguages)
            .Where(language => !string.IsNullOrWhiteSpace(language))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static int DiscoveryStage(string language, string userLanguage)
    {
        if (language.Equals(userLanguage, StringComparison.OrdinalIgnoreCase))
            return 0;
        return language.Equals("en", StringComparison.OrdinalIgnoreCase) ? 1 : 2;
    }

    private static string? QueryForLanguage(SmartSearchDiscoveryAxis axis, string language)
    {
        return axis.Queries?.FirstOrDefault(entry => entry.Key.Equals(language, StringComparison.OrdinalIgnoreCase)).Value?.Trim();
    }

    private static bool CanRunTranslator(string command)
    {
        return !string.IsNullOrWhiteSpace(command) && Path.IsPathFullyQualified(command) && File.Exists(command);
    }

    private static Dictionary<(string Axis, string Language), string> ParseDiscoveryTranslations(string output)
    {
        using var document = JsonDocument.Parse(output);
        if (!document.RootElement.TryGetProperty("translations", out var values) || values.ValueKind != JsonValueKind.Array)
            throw new InvalidOperationException("Smart Search translator returned an invalid discovery translations array.");
        var result = new Dictionary<(string Axis, string Language), string>();
        foreach (var value in values.EnumerateArray())
        {
            if (!value.TryGetProperty("key", out var key) || !value.TryGetProperty("language", out var language) || !value.TryGetProperty("text", out var text))
                continue;
            var normalizedKey = key.GetString()?.Trim();
            var normalizedLanguage = language.GetString()?.Trim();
            var normalizedText = text.GetString()?.Trim();
            if (!string.IsNullOrWhiteSpace(normalizedKey) && !string.IsNullOrWhiteSpace(normalizedLanguage) && !string.IsNullOrWhiteSpace(normalizedText))
                result[(normalizedKey, normalizedLanguage)] = normalizedText;
        }
        return result;
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
        if (string.IsNullOrWhiteSpace(request.SessionId) || (request.Discovery == null && (string.IsNullOrWhiteSpace(request.Query) || request.Query.Length > 500)))
            throw new ArgumentException("Invalid Smart Search query.");
        if (request.Languages.Count == 0 || request.Languages.Count > MaxLanguages || request.Languages.Distinct(StringComparer.OrdinalIgnoreCase).Count() != request.Languages.Count || request.Languages.Any(x => !SupportedLanguages.Contains(x)))
            throw new ArgumentException("Select between one and six supported Smart Search languages.");
        if (request.Discovery == null)
            return;
        if (request.MaxParallelism is < 1 or > MaxDiscoveryParallelism)
            throw new ArgumentException($"Select a Smart Mix parallelism between 1 and {MaxDiscoveryParallelism}.");
        if (!SupportedLanguages.Contains(request.Discovery.UserLanguage) || request.Discovery.Axes.Count != MaxDiscoveryAxes || !request.Discovery.Axes.Select(axis => axis.Id).ToHashSet(StringComparer.OrdinalIgnoreCase).SetEquals(DiscoveryAxisIds))
            throw new ArgumentException("Smart Mix requires four distinct discovery axes in a supported user language.");
        var discoveryLanguages = DiscoveryLanguages(request.Discovery.UserLanguage, request.Languages);
        if (discoveryLanguages.Count > MaxDiscoveryLanguages || request.Discovery.Axes.Count * discoveryLanguages.Count > MaxDiscoveryVariants || request.Discovery.Axes.Any(axis => string.IsNullOrWhiteSpace(axis.Label) || axis.Label.Length > 100 || axis.Queries == null || string.IsNullOrWhiteSpace(QueryForLanguage(axis, "en")) || axis.Queries.Values.Any(query => string.IsNullOrWhiteSpace(query) || query.Length > 500)))
            throw new ArgumentException("Smart Mix discovery axes must include concise English queries.");
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
