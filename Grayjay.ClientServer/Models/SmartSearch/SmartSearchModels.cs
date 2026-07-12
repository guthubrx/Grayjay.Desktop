using Grayjay.Engine.Models;
using Grayjay.Engine.Models.Feed;

namespace Grayjay.ClientServer.Models.SmartSearch;

public class SmartSearchRequest
{
    public required string SessionId { get; set; }
    public required string Query { get; set; }
    public required List<string> Languages { get; set; }
    public required string TranslatorCommand { get; set; }
    public ContentType Type { get; set; }
    public string? Order { get; set; }
    public Dictionary<string, string[]>? Filters { get; set; }
    public List<string>? ExcludePlugins { get; set; }
}

public class SmartSearchVariant
{
    public required string Language { get; set; }
    public required string Query { get; set; }
    public string Status { get; set; } = "pending";
    public string? Error { get; set; }
    public List<SmartSearchResult> Results { get; set; } = [];
}

public class SmartSearchResult
{
    public required string Key { get; set; }
    public required PlatformContent Content { get; set; }
    public required string OriginalTitle { get; set; }
    public List<string> Languages { get; set; } = [];
    public string? TranslatedTitle { get; set; }
}

public class SmartSearchSession
{
    public required string SessionId { get; set; }
    public List<SmartSearchVariant> Variants { get; set; } = [];
    public string? Error { get; set; }
}

public class SmartSearchTitleRequest
{
    public required string SessionId { get; set; }
    public required string TranslatorCommand { get; set; }
    public string TargetLanguage { get; set; } = "fr";
}
