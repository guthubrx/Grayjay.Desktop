namespace Grayjay.ClientServer.Models.Highlights;

public class VideoHighlightEditorialProfile
{
    public int Version { get; set; } = 1;
    public string Genre { get; set; } = "other";
    public double Substance { get; set; }
    public double Rigor { get; set; }
    public double Clarity { get; set; }
    public double Distinctiveness { get; set; }
    public double AudienceValue { get; set; }
    public double TemporalSensitivity { get; set; }
    public double Confidence { get; set; }
    public string? Rationale { get; set; }
}
