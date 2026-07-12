using Grayjay.Engine.Models.Feed;

namespace Grayjay.ClientServer.Models.Highlights;

public class VideoHighlightMixCandidate
{
    public required string VideoUrl { get; set; }
    public DateTime UpdatedAt { get; set; }
    public PlatformVideo? Video { get; set; }
    public VideoHighlightMixProfile? MixProfile { get; set; }
    public string? GlobalSummary { get; set; }
    public List<VideoHighlightThesis>? Theses { get; set; }
    public double? AverageScore { get; set; }
    public double? TopScore { get; set; }
    public double InterestingDuration { get; set; }
    public List<VideoHighlightSegment> Segments { get; set; } = new();
}
