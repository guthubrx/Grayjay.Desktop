using Grayjay.Engine.Models.Feed;

namespace Grayjay.ClientServer.Models.Highlights;

public class VideoHighlightSet
{
    public int SchemaVersion { get; set; } = 1;
    public required string VideoUrl { get; set; }
    public string? Source { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public string? GlobalSummary { get; set; }
    public List<VideoHighlightThesis>? Theses { get; set; }
    public PlatformVideo? Video { get; set; }
    public List<VideoHighlightSegment> Segments { get; set; } = new();
    public List<VideoHighlightPromotionSegment>? PromotionSegments { get; set; }
}
