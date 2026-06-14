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
}
