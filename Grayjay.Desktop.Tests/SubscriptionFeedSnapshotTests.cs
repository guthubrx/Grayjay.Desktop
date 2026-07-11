using System.Text.Json;
using Grayjay.ClientServer.Models.Subscriptions;
using Grayjay.ClientServer.Serializers;
using Grayjay.ClientServer.States;
using Grayjay.Engine.Models.Feed;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace Grayjay.Desktop.Tests
{
    [TestClass]
    public class SubscriptionFeedSnapshotTests
    {
        [TestMethod]
        public void WriteAndRead_RoundTripsBoundedVideos()
        {
            string directory = CreateTemporaryDirectory();
            try
            {
                var store = new SubscriptionFeedSnapshotStore(Path.Combine(directory, "subscription-feed-bootstrap.json"), 2);
                var videos = new[]
                {
                    CreateVideo("old", "channel-a", DateTime.UtcNow.AddHours(-2)),
                    CreateVideo("new", "channel-a", DateTime.UtcNow),
                    CreateVideo("middle", "channel-b", DateTime.UtcNow.AddHours(-1))
                };

                store.Write(videos);

                var result = store.Read(new[] { "channel-a", "channel-b" });

                Assert.AreEqual(2, result.Count);
                CollectionAssert.AreEqual(new[] { "new", "middle" }, result.Select(video => video.Url).ToArray());
            }
            finally
            {
                Directory.Delete(directory, true);
            }
        }

        [TestMethod]
        public void Read_FiltersChannelsNoLongerSubscribed()
        {
            string directory = CreateTemporaryDirectory();
            try
            {
                var store = new SubscriptionFeedSnapshotStore(Path.Combine(directory, "subscription-feed-bootstrap.json"));
                store.Write(new[]
                {
                    CreateVideo("kept", "channel-a", DateTime.UtcNow),
                    CreateVideo("removed", "channel-b", DateTime.UtcNow.AddMinutes(-1))
                });

                var result = store.Read(new[] { "channel-a" });

                Assert.AreEqual(1, result.Count);
                Assert.AreEqual("kept", result[0].Url);
            }
            finally
            {
                Directory.Delete(directory, true);
            }
        }

        [TestMethod]
        public void Read_ReturnsEmptyForInvalidSnapshot()
        {
            string directory = CreateTemporaryDirectory();
            try
            {
                string path = Path.Combine(directory, "subscription-feed-bootstrap.json");
                File.WriteAllText(path, "not-json");
                var store = new SubscriptionFeedSnapshotStore(path);

                var result = store.Read(new[] { "channel-a" });

                Assert.AreEqual(0, result.Count);
            }
            finally
            {
                Directory.Delete(directory, true);
            }
        }

        [TestMethod]
        public void Read_ReturnsEmptyForUnsupportedFormat()
        {
            string directory = CreateTemporaryDirectory();
            try
            {
                string path = Path.Combine(directory, "subscription-feed-bootstrap.json");
                var unsupported = new SubscriptionFeedSnapshot
                {
                    FormatVersion = SubscriptionFeedSnapshot.CurrentFormatVersion + 1,
                    CreatedAt = DateTime.UtcNow,
                    Videos = new List<PlatformVideo> { CreateVideo("old-format", "channel-a", DateTime.UtcNow) }
                };
                File.WriteAllText(path, GJsonSerializer.Serialize(unsupported));
                var store = new SubscriptionFeedSnapshotStore(path);

                var result = store.Read(new[] { "channel-a" });

                Assert.AreEqual(0, result.Count);
            }
            finally
            {
                Directory.Delete(directory, true);
            }
        }

        private static string CreateTemporaryDirectory()
        {
            string path = Path.Combine(Path.GetTempPath(), "grayjay-subscription-bootstrap-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(path);
            return path;
        }

        private static PlatformVideo CreateVideo(string suffix, string channelUrl, DateTime dateTime)
        {
            string json = $$"""
            {
                "ContentType": 1,
                "Name": "Video {{suffix}}",
                "Author": {
                    "Name": "Channel {{channelUrl}}",
                    "Url": "{{channelUrl}}"
                },
                "Url": "{{suffix}}",
                "DateTime": "{{dateTime:O}}",
                "Duration": 120
            }
            """;

            var options = new JsonSerializerOptions();
            options.Converters.Add(new PlatformContentConverter());
            return (PlatformVideo)JsonSerializer.Deserialize<PlatformContent>(json, options)!;
        }
    }
}
