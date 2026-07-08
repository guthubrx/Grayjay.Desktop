using Grayjay.ClientServer.States;
using Grayjay.Desktop.POC.Port.States;
using Grayjay.Engine.Models.Feed;
using Microsoft.AspNetCore.Mvc;

namespace Grayjay.ClientServer.Controllers
{
    [Route("[controller]/[action]")]
    public class LocalRecommendationsController : ControllerBase
    {
        [HttpGet]
        public List<PlatformContent> ForVideo(string channelUrl, int limit = 20)
        {
            if (string.IsNullOrWhiteSpace(channelUrl))
                return new List<PlatformContent>();
            if (limit <= 0 || limit > 100) limit = 20;

            var neighborUrls = StateSubscriptions.GetGroups()
                .Where(g => g.Urls != null && g.Urls.Contains(channelUrl))
                .SelectMany(g => g.Urls)
                .Where(u => u != channelUrl)
                .Distinct()
                .ToHashSet();

            if (neighborUrls.Count == 0)
            {
                neighborUrls = StateSubscriptions.GetSubscriptions()
                    .Select(s => s.Channel.Url)
                    .Where(u => u != channelUrl)
                    .ToHashSet();
            }

            if (neighborUrls.Count == 0)
                return new List<PlatformContent>();

            var globalFeed = StateSubscriptions.GetGlobalFeed();
            if (globalFeed?.Feed == null)
                return new List<PlatformContent>();

            List<PlatformContent> cached;
            lock (globalFeed.LockObject)
            {
                cached = new List<PlatformContent>(globalFeed.Feed.PreviousResults);
            }

            return cached
                .Where(c => c is PlatformVideo)
                .Where(c => c.Author?.Url != null && neighborUrls.Contains(c.Author.Url))
                .Where(c => StateHistory.GetHistoryIndex(c.Url) == null)
                .OrderByDescending(c => c.DateTime)
                .Take(limit)
                .ToList();
        }
    }
}
