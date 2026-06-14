namespace Grayjay.ClientServer.Models.Highlights;

public class VideoHighlightSegment
{
    public required string Title { get; set; }
    public double Start { get; set; }
    public double End { get; set; }
    public string? Summary { get; set; }
    public double? Score { get; set; }
    public int? ThesisId { get; set; }
}
