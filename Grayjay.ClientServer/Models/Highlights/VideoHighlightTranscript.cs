namespace Grayjay.ClientServer.Models.Highlights;

public class VideoHighlightTranscript
{
    public required string VideoUrl { get; set; }
    public string? Title { get; set; }
    public string? Source { get; set; }
    public List<VideoHighlightSubtitleCue> Cues { get; set; } = new();
}
