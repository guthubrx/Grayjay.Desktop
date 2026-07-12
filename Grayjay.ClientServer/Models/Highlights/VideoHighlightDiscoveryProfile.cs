namespace Grayjay.ClientServer.Models.Highlights;

public class VideoHighlightDiscoveryProfile
{
    public int Version { get; set; } = 1;
    public List<VideoHighlightDiscoveryAxis> Axes { get; set; } = new();
}
