using Grayjay.ClientServer.Models.Subscriptions;
using Grayjay.ClientServer.Serializers;
using Grayjay.Engine.Models.Feed;

namespace Grayjay.ClientServer.States
{
    public class SubscriptionFeedSnapshotStore
    {
        public const int DefaultMaxVideos = 120;

        private readonly string _path;
        private readonly int _maxVideos;

        public SubscriptionFeedSnapshotStore(string path, int maxVideos = DefaultMaxVideos)
        {
            _path = path;
            _maxVideos = maxVideos;
        }

        public void Write(IEnumerable<PlatformVideo> videos)
        {
            var snapshot = new SubscriptionFeedSnapshot
            {
                CreatedAt = DateTime.UtcNow,
                Videos = videos
                    .Where(IsUsable)
                    .GroupBy(video => video.Url, StringComparer.Ordinal)
                    .Select(group => group.First())
                    .OrderByDescending(video => video.DateTime)
                    .Take(_maxVideos)
                    .ToList()
            };

            string? directory = Path.GetDirectoryName(_path);
            if (!string.IsNullOrEmpty(directory))
                Directory.CreateDirectory(directory);

            string temporaryPath = _path + "." + Guid.NewGuid().ToString("N") + ".tmp";
            try
            {
                File.WriteAllText(temporaryPath, GJsonSerializer.Serialize(snapshot));
                File.Move(temporaryPath, _path, true);
            }
            finally
            {
                if (File.Exists(temporaryPath))
                    File.Delete(temporaryPath);
            }
        }

        public List<PlatformVideo> Read(IEnumerable<string> activeChannelUrls)
        {
            if (!File.Exists(_path))
                return new List<PlatformVideo>();

            try
            {
                var snapshot = GJsonSerializer.Deserialize<SubscriptionFeedSnapshot>(File.ReadAllText(_path));
                if (snapshot == null || snapshot.FormatVersion != SubscriptionFeedSnapshot.CurrentFormatVersion)
                    return new List<PlatformVideo>();

                var activeChannels = new HashSet<string>(activeChannelUrls, StringComparer.OrdinalIgnoreCase);
                return snapshot.Videos
                    .Where(video => IsUsable(video) && activeChannels.Contains(video.Author.Url))
                    .GroupBy(video => video.Url, StringComparer.Ordinal)
                    .Select(group => group.First())
                    .OrderByDescending(video => video.DateTime)
                    .Take(_maxVideos)
                    .ToList();
            }
            catch
            {
                return new List<PlatformVideo>();
            }
        }

        public void Clear()
        {
            try
            {
                if (File.Exists(_path))
                    File.Delete(_path);
            }
            catch
            {
                // A derived snapshot must not prevent the cache from being cleared.
            }
        }

        private static bool IsUsable(PlatformVideo video)
        {
            return !string.IsNullOrWhiteSpace(video.Url)
                && video.Author != null
                && !string.IsNullOrWhiteSpace(video.Author.Url);
        }
    }
}
