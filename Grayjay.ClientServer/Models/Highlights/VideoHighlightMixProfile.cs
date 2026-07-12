namespace Grayjay.ClientServer.Models.Highlights;

public class VideoHighlightMixProfile
{
    public List<string> Topics { get; set; } = new();
    public List<string> RelatedTopics { get; set; } = new();
    public List<string> AngleLabels { get; set; } = new();
}
