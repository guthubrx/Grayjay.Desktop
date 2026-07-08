using Grayjay.Engine.Models.Feed;

namespace Grayjay.ClientServer.Models.Highlights;

public class VideoHighlightSummary
{
    public required string VideoUrl { get; set; }
    public required string Source { get; set; }
    public DateTime UpdatedAt { get; set; }
    public int SegmentCount { get; set; }
    public double TotalDuration { get; set; }
    public string? GlobalSummary { get; set; }
    public PlatformVideo? Video { get; set; }
}
