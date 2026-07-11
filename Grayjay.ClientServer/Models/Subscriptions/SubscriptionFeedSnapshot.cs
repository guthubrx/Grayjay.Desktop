using Grayjay.Engine.Models.Feed;

namespace Grayjay.ClientServer.Models.Subscriptions
{
    public class SubscriptionFeedSnapshot
    {
        public const int CurrentFormatVersion = 1;

        public int FormatVersion { get; set; } = CurrentFormatVersion;
        public DateTime CreatedAt { get; set; }
        public List<PlatformVideo> Videos { get; set; } = new List<PlatformVideo>();
    }
}
