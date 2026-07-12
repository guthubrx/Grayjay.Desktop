namespace Grayjay.ClientServer.Models.Highlights;

public class VideoHighlightDiscoveryAxis
{
    public required string Id { get; set; }
    public required string Label { get; set; }
    public Dictionary<string, string> Queries { get; set; } = new();
}
