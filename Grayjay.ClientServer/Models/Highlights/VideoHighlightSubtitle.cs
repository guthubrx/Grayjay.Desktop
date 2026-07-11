namespace Grayjay.ClientServer.Models.Highlights;

public class VideoHighlightSubtitle
{
    public required string Language { get; set; }
    public required string SourceTranscriptHash { get; set; }
    public List<VideoHighlightSubtitleCue> Cues { get; set; } = new();
}

public class VideoHighlightSubtitleCue
{
    public double Start { get; set; }
    public double End { get; set; }
    public required string Text { get; set; }
}
