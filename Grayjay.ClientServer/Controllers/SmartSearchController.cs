using Grayjay.ClientServer.Models.SmartSearch;
using Grayjay.ClientServer.States;
using Microsoft.AspNetCore.Mvc;

namespace Grayjay.ClientServer.Controllers;

[Route("[controller]/[action]")]
public class SmartSearchController : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<SmartSearchSession>> Load([FromBody] SmartSearchRequest request, CancellationToken cancellationToken)
    {
        return Ok(await StateSmartSearch.Load(request, cancellationToken));
    }

    [HttpGet]
    public ActionResult<SmartSearchSession> Get(string sessionId)
    {
        return Ok(StateSmartSearch.Snapshot(sessionId));
    }

    [HttpPost]
    public async Task<ActionResult<SmartSearchSession>> TranslateTitles([FromBody] SmartSearchTitleRequest request, CancellationToken cancellationToken)
    {
        return Ok(await StateSmartSearch.TranslateTitles(request, cancellationToken));
    }
}
