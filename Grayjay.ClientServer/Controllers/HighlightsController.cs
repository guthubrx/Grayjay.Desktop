using Grayjay.ClientServer.Models.Highlights;
using Grayjay.ClientServer.States;
using Grayjay.Engine.Models.Feed;
using Microsoft.AspNetCore.Mvc;

namespace Grayjay.ClientServer.Controllers;

[Route("[controller]/[action]")]
public class HighlightsController : ControllerBase
{
    [HttpGet]
    public ActionResult<VideoHighlightSet?> Get(string url)
    {
        return Ok(StateHighlights.Get(url));
    }

    [HttpGet]
    public ActionResult<List<VideoHighlightSummary>> GetAll()
    {
        return Ok(StateHighlights.GetSummaries());
    }

    [HttpGet]
    public ActionResult<List<VideoHighlightMixCandidate>> MixCandidates()
    {
        return Ok(StateHighlights.GetMixCandidates());
    }

    [HttpPost]
    public ActionResult<VideoHighlightSet> Import([FromBody] VideoHighlightSet highlightSet)
    {
        return Ok(StateHighlights.CreateOrUpdate(highlightSet));
    }

    public class CreateOrUpdateRequest
    {
        public required VideoHighlightSet HighlightSet { get; set; }
        public PlatformVideo? Video { get; set; }
    }

    [HttpPost]
    public ActionResult<VideoHighlightSet> CreateOrUpdate([FromBody] CreateOrUpdateRequest request)
    {
        return Ok(StateHighlights.CreateOrUpdate(request.HighlightSet, request.Video));
    }

    [HttpDelete]
    public ActionResult Delete(string url)
    {
        return StateHighlights.Delete(url) ? Ok() : NotFound();
    }

    public class GenerateRequest
    {
        public required string Url { get; set; }
        public required string Command { get; set; }
        public List<string>? TranslationSourceLanguages { get; set; }
    }

    public class GeneratePrefillRequest : GenerateRequest
    {
        public required string Priority { get; set; }
        public string? Source { get; set; }
    }

    public class ConfigurePrefillRequest
    {
        public int Parallelism { get; set; }
        public int? MaxQueuedJobs { get; set; }
    }

    public class SubtitleProbeRequest
    {
        public List<string> Urls { get; set; } = [];
    }

    [HttpPost]
    public ActionResult<StateHighlightsIndexer.IndexJob> Generate([FromBody] GenerateRequest request)
    {
        return Ok(StateHighlightsIndexer.Enqueue(request.Url, request.Command, request.TranslationSourceLanguages));
    }

    [HttpPost]
    public ActionResult<StateHighlightsIndexer.IndexJob> GenerateIfNeeded([FromBody] GenerateRequest request)
    {
        return Ok(StateHighlightsIndexer.EnqueueIfNeeded(request.Url, request.Command, request.TranslationSourceLanguages));
    }

    [HttpPost]
    public ActionResult<StateHighlightsIndexer.IndexJob> GeneratePrefill([FromBody] GeneratePrefillRequest request)
    {
        return Ok(StateHighlightsIndexer.EnqueuePrefill(
            request.Url,
            request.Command,
            request.Priority,
            request.Source,
            request.TranslationSourceLanguages));
    }

    [HttpPost]
    public ActionResult<object> ConfigurePrefill([FromBody] ConfigurePrefillRequest request)
    {
        var configuration = StateHighlightsIndexer.ConfigurePrefill(request.Parallelism, request.MaxQueuedJobs);
        return Ok(new { configuration.Parallelism, configuration.MaxQueuedJobs });
    }

    [HttpPost]
    public async Task<ActionResult<List<StateHighlightsIndexer.SubtitleAvailability>>> ProbeSubtitles([FromBody] SubtitleProbeRequest request, CancellationToken cancellationToken)
    {
        var urls = request.Urls
            .Where(url => !string.IsNullOrWhiteSpace(url))
            .Select(url => url.Trim())
            .Distinct(StringComparer.Ordinal)
            .Take(100)
            .ToList();
        using var limiter = new SemaphoreSlim(Math.Min(8, Math.Max(1, urls.Count)));
        var tasks = urls.Select(async url =>
        {
            await limiter.WaitAsync(cancellationToken);
            try
            {
                return await Task.Run(() => StateHighlightsIndexer.ProbeSubtitle(url), cancellationToken);
            }
            finally
            {
                limiter.Release();
            }
        });
        return Ok((await Task.WhenAll(tasks)).ToList());
    }

    [HttpGet]
    public ActionResult<List<StateHighlightsIndexer.IndexJob>> QueueStatus()
    {
        return Ok(StateHighlightsIndexer.GetJobs());
    }
}
