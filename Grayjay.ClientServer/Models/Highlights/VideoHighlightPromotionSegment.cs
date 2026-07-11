namespace Grayjay.ClientServer.Models.Highlights;

public class VideoHighlightPromotionSegment
{
    public double Start { get; set; }
    public double End { get; set; }
    public required string Category { get; set; }
    public required string Source { get; set; }
    public double? Confidence { get; set; }
    public string? Summary { get; set; }
}
