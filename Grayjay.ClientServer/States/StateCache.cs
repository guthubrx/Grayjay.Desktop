using Grayjay.ClientServer.Database;
using Grayjay.ClientServer.Database.Indexes;
using Grayjay.ClientServer.Store;
using Grayjay.Desktop.POC;
using Grayjay.Desktop.POC.Port.States;
using Grayjay.Engine.Models.Feed;
using Grayjay.Engine.Pagers;
using Microsoft.Extensions.Logging;
using System.Diagnostics;
using System.Text.RegularExpressions;

namespace Grayjay.ClientServer.States
{
    public class StateCache
    {
        private static readonly string TAG = "StateCache";

        private static readonly ManagedDBStore<DBSubscriptionCacheIndex, PlatformContent> _subscriptionCache =
            new ManagedDBStore<DBSubscriptionCacheIndex, PlatformContent>(DBSubscriptionCacheIndex.TABLE_NAME)
            .Load();

        public static void Clear()
        {
            _subscriptionCache.DeleteAll();
        }

        public static void ClearToday()
        {
            var today = _subscriptionCache.QueryGreater(nameof(DBSubscriptionCacheIndex.DateTime), DateTime.Now.Subtract(DateTime.Now.TimeOfDay));
            foreach (var content in today)
            {
                _subscriptionCache.Delete(content);
            }
        }

        public static IPager<PlatformContent> GetChannelCachePager(string channelUrl)
        {
            return _subscriptionCache.QueryPager(nameof(DBSubscriptionCacheIndex.ChannelUrl), channelUrl, 20, it => it.Object);
        }

        public static IPager<PlatformContent> GetAllChannelCachePager(IEnumerable<string> channelUrls)
        {
            return _subscriptionCache.QueryInPager(nameof(DBSubscriptionCacheIndex.ChannelUrl), channelUrls, 20, it => it.Object);
        }

        public static IPager<PlatformContent> GetChannelCachePager(IEnumerable<string> channelUrls, int pageSize = 20)
        {
            var pagers = new MultiChronoContentPager(
                channelUrls.Select(url => _subscriptionCache.QueryPager(nameof(DBSubscriptionCacheIndex.ChannelUrl), url, pageSize, it => it.Object)),
                false, pageSize);

            return new DedupContentPager(pagers, StatePlatform.GetEnabledClients().Select(client => client.ID));
        }

        public static DedupContentPager GetSubscriptionCachePager()
        {
            Logger.i(TAG, "Subscriptions CachePager get subscriptions");
            var subs = StateSubscriptions.GetSubscriptions();
            Logger.i(TAG, "Subscriptions CachePager polycentric urls");
            var allUrls = subs
                .Select(sub =>
                {
                    var otherUrls = new List<string>();//PolycentricCache.Instance.GetCachedProfile(sub.Channel.Url)?.Profile?.OwnedClaims?.Select(c => c.Claim.ResolveChannelUrl()).Where(url => url != null).Select(url => url!).ToList() ?? new List<string>();
                    return otherUrls.Contains(sub.Channel.Url) ? otherUrls : new List<string> { sub.Channel.Url };
                })
                .SelectMany(urls => urls)
                .Distinct()
                .Where(url => StatePlatform.HasChannelClientFor(url))
                .ToList();

            Logger.i(TAG, "Subscriptions CachePager get pagers");
            List<IPager<PlatformContent>> pagers;

            var timeCacheRetrieving = Stopwatch.StartNew();
            try
            {
                pagers = new List<IPager<PlatformContent>>
            {
                GetAllChannelCachePager(allUrls)
            };
            }
            finally
            {
                timeCacheRetrieving.Stop();
                Logger.i(TAG, $"Subscriptions CachePager compiling (retrieved in {timeCacheRetrieving.ElapsedMilliseconds}ms)");
            }

            var pager = new MultiChronoContentPager(pagers, false, 20);
            pager.Initialize();
            Logger.i(TAG, "Subscriptions CachePager compiled");
            return new DedupContentPager(pager, StatePlatform.GetEnabledClients().Select(client => client.ID));
        }

        public static DBSubscriptionCacheIndex? GetCachedContent(string url)
        {
            return _subscriptionCache.Query(nameof(DBSubscriptionCacheIndex.Url), url).FirstOrDefault();
        }

        public static PlatformVideo? GetCachedVideo(string url)
        {
            foreach (var candidate in GetLookupUrls(url))
            {
                try
                {
                    if (GetCachedContent(candidate)?.Object is PlatformVideo video)
                        return video;
                }
                catch (Exception ex)
                {
                    Logger.w(TAG, $"Failed to read cached video [{candidate}]: {ex.Message}");
                }
            }

            return null;
        }

        public static Dictionary<string, PlatformVideo> GetCachedVideos(IEnumerable<string> urls)
        {
            var lookupToRequested = new Dictionary<string, string>(StringComparer.Ordinal);

            foreach (var requestedUrl in urls.Where(url => !string.IsNullOrWhiteSpace(url)))
            {
                foreach (var lookupUrl in GetLookupUrls(requestedUrl))
                {
                    if (!lookupToRequested.ContainsKey(lookupUrl))
                        lookupToRequested[lookupUrl] = requestedUrl;
                }
            }

            var videos = new Dictionary<string, PlatformVideo>(StringComparer.Ordinal);
            if (lookupToRequested.Count == 0)
                return videos;

            foreach (var lookupChunk in lookupToRequested.Keys.Chunk(500))
            {
                foreach (var cached in _subscriptionCache.QueryIn(nameof(DBSubscriptionCacheIndex.Url), lookupChunk.ToArray()))
                {
                    try
                    {
                        if (cached.Object is not PlatformVideo video)
                            continue;

                        if (lookupToRequested.TryGetValue(cached.Url, out var requestedUrl) && !videos.ContainsKey(requestedUrl))
                            videos[requestedUrl] = video;
                    }
                    catch (Exception ex)
                    {
                        Logger.w(TAG, $"Failed to read cached video [{cached.Url}]: {ex.Message}");
                    }
                }
            }

            return videos;
        }

        private static IEnumerable<string> GetLookupUrls(string url)
        {
            if (string.IsNullOrWhiteSpace(url))
                yield break;

            var trimmed = url.Trim();
            yield return trimmed;

            var youtubeId = ExtractYouTubeVideoId(trimmed);
            if (youtubeId == null)
                yield break;

            yield return $"https://www.youtube.com/watch?v={youtubeId}";
            yield return $"https://youtube.com/watch?v={youtubeId}";
            yield return $"https://youtu.be/{youtubeId}";
        }

        private static string? ExtractYouTubeVideoId(string value)
        {
            var match = Regex.Match(
                value,
                @"(?:youtube(?:-nocookie)?\.com/(?:watch\?[^#\s]*v=|embed/|shorts/|live/)|youtu\.be/)([A-Za-z0-9_-]{11})",
                RegexOptions.IgnoreCase);
            if (match.Success)
                return match.Groups[1].Value;

            match = Regex.Match(value, @"(?:[?&]v=)([A-Za-z0-9_-]{11})", RegexOptions.IgnoreCase);
            return match.Success ? match.Groups[1].Value : null;
        }


        public static List<PlatformContent> CacheContents(IEnumerable<PlatformContent> contents, bool doUpdate = false)
        {
            return contents.Where(content => CacheContent(content, doUpdate)).ToList();
        }

        public static bool CacheContent(PlatformContent content, bool doUpdate = false)
        {
            if (string.IsNullOrEmpty(content.Author.Url))
            {
                return false;
            }

            var serialized = content;//SerializedPlatformContent.FromContent(content);
            var existing = GetCachedContent(content.Url);

            if (existing != null && doUpdate)
            {
                _subscriptionCache.Update(existing.ID, serialized);
                return false;
            }
            else if (existing == null)
            {
                _subscriptionCache.Insert(serialized);
                return true;
            }

            return false;
        }

        public static IPager<PlatformContent> CachePagerResults(IPager<PlatformContent> pager, Action<PlatformContent>? onNewCacheHit = null)
        {
            var res = new ChannelContentCachePager(pager, onNewCacheHit);
            return res;
        }

        private class ChannelContentCachePager : IPager<PlatformContent>
        {
            private readonly IPager<PlatformContent> _pager;
            private readonly Action<PlatformContent>? _onNewCacheItem;
            public string ID { get; set; } = Guid.NewGuid().ToString();

            public ChannelContentCachePager(IPager<PlatformContent> pager, Action<PlatformContent>? onNewCacheItem = null)
            {
                _pager = pager;
                _onNewCacheItem = onNewCacheItem;

                var results = _pager.GetResults();

                Logger.i(TAG, $"Caching {results.Length} subscription initial results [{_pager.GetHashCode()}]");

                StateApp.ThreadPool.Run(() =>
                {
                    try
                    {
                        var newCacheItems = CacheContents(results, true);

                        foreach (var item in newCacheItems)
                            _onNewCacheItem?.Invoke(item);
                        //_onNewCacheItem?.InvokeRange(newCacheItems);
                    }
                    catch (Exception e)
                    {
                        Logger.e(TAG, "Failed to cache videos.", e);
                    }
                });
            }

            public bool HasMorePages() => _pager.HasMorePages();

            public void NextPage()
            {
                _pager.NextPage();
                var results = _pager.GetResults();

                StateApp.ThreadPool.Run(() =>
                {
                    try
                    {
                        var timeCacheRetrieving = Stopwatch.StartNew();

                        var newCacheItems = CacheContents(results, true);

                        timeCacheRetrieving.Stop();
                        Logger.i(TAG, $"Caching {results.Length} subscription results, updated {newCacheItems.Count} ({timeCacheRetrieving.ElapsedMilliseconds}ms)");
                    }
                    catch (Exception e)
                    {
                        Logger.e(TAG, $"Failed to cache {results.Length} videos.", e);
                    }
                });
            }

            public PlatformContent[] GetResults() => _pager.GetResults();
        }
    }
}
