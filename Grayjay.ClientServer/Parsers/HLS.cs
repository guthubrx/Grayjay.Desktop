namespace Grayjay.ClientServer.Parsers;

using Grayjay.Engine.Models.Video.Additions;
using Grayjay.Engine.Models.Video.Sources;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Text;

public static class HLS
{
    public class DecryptionInfo
    {
        public string Method { get; }
        public string? KeyUrl { get; }
        public string? IV { get; }
        public string? KeyFormat { get; }
        public string? KeyFormatVersions { get; }
        public bool IsEncrypted => !string.Equals(Method, "NONE", StringComparison.OrdinalIgnoreCase);

        public DecryptionInfo(string keyUrl, string? iv)
            : this("AES-128", keyUrl, iv, null, null)
        {
            
        }

        public DecryptionInfo(string method, string? keyUrl, string? iv, string? keyFormat, string? keyFormatVersions)
        {
            Method = method;
            KeyUrl = keyUrl;
            IV = iv;
            KeyFormat = keyFormat;
            KeyFormatVersions = keyFormatVersions;
        }
    }

    public static MasterPlaylist ParseMasterPlaylist(string masterPlaylistContent, string sourceUrl)
    {
        Uri baseUrl = new Uri(new Uri(sourceUrl), "./");
        var variantPlaylists = new List<VariantPlaylistReference>();
        var mediaRenditions = new List<MediaRendition>();
        var sessionDataList = new List<SessionData>();
        var independentSegments = false;
        int? version = null;
        int? mediaSequence = null;

        List<string> unhandled = new List<string>();

        var lines = masterPlaylistContent.Split('\n');
        for (int i = 0; i < lines.Length; i++)
        {
            var line = lines[i];
            if (line.StartsWith("#EXT-X-STREAM-INF"))
            {
                var nextLine = i < lines.Length ? lines[++i] : null;
                if (nextLine == null)
                    throw new Exception("Expected URI following #EXT-X-STREAM-INF, found none");
                var url = nextLine.Trim().EnsureAbsoluteUrl(baseUrl);
                variantPlaylists.Add(new VariantPlaylistReference(url, ParseStreamInfo(line.Trim())));
            }
            else if (line.StartsWith("#EXT-X-VERSION") && int.TryParse(line.Substring("#EXT-X-VERSION:".Length), out var v))
                version = v;
            else if (line.StartsWith("#EXT-X-MEDIA-SEQUENCE") && int.TryParse(line.Substring("#EXT-X-MEDIA-SEQUENCE:".Length), out var ms))
                mediaSequence = ms;
            else if (line.StartsWith("#EXT-X-MEDIA"))
                mediaRenditions.Add(ParseMediaRendition(line.Trim(), baseUrl));
            else if (line == "#EXT-X-INDEPENDENT-SEGMENTS")
                independentSegments = true;
            else if (line.StartsWith("#EXT-X-SESSION-DATA"))
                sessionDataList.Add(ParseSessionData(line.Trim()));
            else
                unhandled.Add(line.Trim());
        }

        return new MasterPlaylist(version, variantPlaylists, mediaRenditions, sessionDataList, independentSegments, mediaSequence, unhandled);
    }

    public static VariantPlaylist ParseVariantPlaylist(string content, string sourceUrl)
    {
        var baseUrl = new Uri(new Uri(sourceUrl), "./");
        var lines = content.Split('\n');
        var version = GetValueInt32(lines, "#EXT-X-VERSION:");
        var targetDuration = GetValueInt32(lines, "#EXT-X-TARGETDURATION:");
        var mediaSequence = GetValueInt64(lines, "#EXT-X-MEDIA-SEQUENCE:");
        var discontinuitySequence = GetValueInt32(lines, "#EXT-X-DISCONTINUITY-SEQUENCE:");
        var programDateTime = GetValueDateTime(lines, "#EXT-X-PROGRAM-DATE-TIME:");
        var playlistType = GetValue(lines, "#EXT-X-PLAYLIST-TYPE:");
        var streamInfo = lines.FirstOrDefault(l => l.StartsWith("#EXT-X-STREAM-INF:"))?.Trim();
        string? mapUrl = null;
        long mapBytesStart = -1;
        long mapBytesLength = -1;
        var mapLine = lines.FirstOrDefault(x => x.StartsWith("#EXT-X-MAP:"));
        if (!string.IsNullOrEmpty(mapLine))
        {
            var mapAttrs = ParseAttributes(mapLine.Trim());

            if (mapAttrs.TryGetValue("URI", out var uriValue))
                mapUrl = uriValue.EnsureAbsoluteUrl(baseUrl);

            if (mapAttrs.TryGetValue("BYTERANGE", out var byterangeValue))
                ParseByteRange(byterangeValue, out mapBytesLength, out mapBytesStart);
        }
                
        DecryptionInfo? decryptionInfo = null;
        var keyLine = lines.LastOrDefault(l => l.StartsWith("#EXT-X-KEY:"));
        if (!string.IsNullOrEmpty(keyLine))
        {
            var keyAttrs = ParseAttributes(keyLine.Trim());
            var method = keyAttrs.TryGetValue("METHOD", out var methodRaw) && !string.IsNullOrWhiteSpace(methodRaw)
                ? methodRaw
                : "AES-128";

            string? keyUrl = null;
            if (keyAttrs.TryGetValue("URI", out var keyUriRaw) && !string.IsNullOrWhiteSpace(keyUriRaw))
                keyUrl = keyUriRaw.EnsureAbsoluteUrl(baseUrl);

            string? iv = null;
            if (keyAttrs.TryGetValue("IV", out var ivRaw) && !string.IsNullOrWhiteSpace(ivRaw))
            {
                iv = ivRaw;
                if (iv.StartsWith("0x", StringComparison.OrdinalIgnoreCase))
                    iv = iv.Substring(2);
            }

            keyAttrs.TryGetValue("KEYFORMAT", out var keyFormat);
            keyAttrs.TryGetValue("KEYFORMATVERSIONS", out var keyFormatVersions);
            decryptionInfo = new DecryptionInfo(method, keyUrl, iv, keyFormat, keyFormatVersions);
        }

        var segments = new List<Segment>();
        MediaSegment? currentSegment = null;

        List<string> unhandled = new List<string>();
        List<string> segmentUnhandled = new List<string>();

        foreach (var line in lines)
        {
            if (line.StartsWith("#EXTINF:"))
            {
                var duration = double.Parse(line.Substring(8, line.IndexOf(',') - 8), CultureInfo.InvariantCulture);
                currentSegment = new MediaSegment(duration);
            }
            else if (line == "#EXT-X-DISCONTINUITY")
                segments.Add(new DiscontinuitySegment());
            else if (line == "#EXT-X-ENDLIST")
                segments.Add(new EndListSegment());
            else if (currentSegment != null && line.StartsWith("#EXT-X-BYTERANGE:"))
            {
                var value = line.Substring("#EXT-X-BYTERANGE:".Length).Trim();
                ParseByteRange(value, out var length, out var start);
                currentSegment.BytesLength = length;
                currentSegment.BytesStart = start;
            }
            else if(currentSegment != null && line.StartsWith("#"))
                currentSegment.Unhandled.Add(line);
            else
            {
                if (currentSegment != null)
                {
                    currentSegment.Uri = line.Trim().EnsureAbsoluteUrl(baseUrl);
                    segments.Add(currentSegment);
                    currentSegment = null;
                }
                else
                    unhandled.Add(line.Trim());
            }
        }

        return new VariantPlaylist(
            version,
            targetDuration,
            mediaSequence,
            discontinuitySequence,
            programDateTime,
            playlistType,
            streamInfo != null ? ParseStreamInfo(streamInfo) : null,
            segments,
            mapUrl,
            unhandled,
            decryptionInfo
        )
        {
            MapBytesStart = mapBytesStart,
            MapBytesLength = mapBytesLength
        };
    }

    public static async Task<IHLSPlaylist> DownloadAndParsePlaylist(string url, IRequestModifier? modifier = null)
    {
        using (HttpClient client = new HttpClient())
        {
            var modified = modifier?.ModifyRequest(url, new Engine.Models.HttpHeaders());
            if (modified != null)
            {
                url = modified.Url ?? url;
                if (modified.Headers != null)
                    foreach (var header in modified.Headers)
                    {
                        client.DefaultRequestHeaders.Add(header.Key, header.Value);
                    }
            }

            var result = await client.GetAsync(url);
            if (result.StatusCode != HttpStatusCode.OK)
                throw new InvalidDataException($"Failed to fetch manifest [" + result.StatusCode + "]");

            var body = await result.Content.ReadAsStringAsync();

            try
            {
                return ParseMasterPlaylist(body, url);
            }
            catch
            {
                return ParseVariantPlaylist(body, url);
            }
        }
    }
    public static List<HLSVariantVideoUrlSource> ParseToVideoSources(object parentSource, string content, string url)
    {
        try
        {
            MasterPlaylist playlist = ParseMasterPlaylist(content, url);
            return playlist.GetVideoSources();
        }
        catch
        {
            if (content.Split('\n').Any(x => x.Trim().StartsWith("#EXTINF:")))
            {
                if (parentSource is HLSManifestSource)
                {
                    throw new NotImplementedException();
                }
                else if (parentSource is HLSManifestAudioSource)
                {
                    throw new NotImplementedException();
                }
                else
                    throw new NotImplementedException();
            }
            else
                throw;
        }
        

    }

    private static void ParseByteRange(string value, out long length, out long start)
    {
        length = -1;
        start = -1;

        if (string.IsNullOrWhiteSpace(value))
            throw new InvalidDataException("Empty BYTERANGE value.");

        var parts = value.Trim().Split('@');

        if (!long.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out length) || length < 0)
            throw new InvalidDataException($"Invalid BYTERANGE length '{value}'.");

        if (parts.Length > 1)
        {
            if (!long.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out start) || start < 0)
                throw new InvalidDataException($"Invalid BYTERANGE offset '{value}'.");
        }
    }

    private static readonly List<string> _quoteList = new List<string> { "GROUP-ID", "NAME", "URI", "CODECS", "AUDIO", "VIDEO" };

    private static bool ShouldQuote(string key, string value)
    {
        if (value == null)
            return false;

        if (value.Contains(','))
            return true;

        return _quoteList.Contains(key);
    }

    private static string AttributesToString(params (string Key, string? Value)[] attributes)
    {
        var stringBuilder = new StringBuilder();
        var filteredAttributes = attributes.Where(a => a.Value != null);
        var attributeStrings = new List<string>();

        foreach (var attribute in filteredAttributes)
        {
            var value = attribute.Value!;
            var attributeString = $"{attribute.Key}={(ShouldQuote(attribute.Key, value) ? $"\"{value}\"" : value)}";
            attributeStrings.Add(attributeString);
        }

        var result = string.Join(",", attributeStrings);
        if (!string.IsNullOrEmpty(result))
            stringBuilder.Append(result);

        return stringBuilder.ToString();
    }

    private static string? GetValue(IEnumerable<string> lines, string prefix)
    {
        return lines.FirstOrDefault(l => l.StartsWith(prefix))?.Substring(prefix.Length).Trim();
    }

    private static int? GetValueInt32(IEnumerable<string> lines, string prefix)
    {
        var val = GetValue(lines, prefix);
        return val != null && int.TryParse(val, out int v) ? v : null;
    }

    private static long? GetValueInt64(IEnumerable<string> lines, string prefix)
    {
        var val = GetValue(lines, prefix);
        return val != null && long.TryParse(val, out long v) ? v : null;
    }

    private static DateTime? GetValueDateTime(IEnumerable<string> lines, string prefix)
    {
        var val = GetValue(lines, prefix);
        return val != null && DateTime.TryParse(val, out DateTime v) ? v : null;
    }

    private static StreamInfo ParseStreamInfo(string content)
    {
        var attributes = ParseAttributes(content);
        return new StreamInfo(
            int.TryParse(attributes.GetValueOrDefault("BANDWIDTH"), out var bandwidth) ? bandwidth : null,
            attributes.GetValueOrDefault("RESOLUTION"),
            attributes.GetValueOrDefault("CODECS"),
            attributes.GetValueOrDefault("FRAME-RATE"),
            attributes.GetValueOrDefault("VIDEO-RANGE"),
            attributes.GetValueOrDefault("AUDIO"),
            attributes.GetValueOrDefault("VIDEO"),
            attributes.GetValueOrDefault("SUBTITLES"),
            attributes.GetValueOrDefault("CLOSED-CAPTIONS")
        );
    }

    private static MediaRendition ParseMediaRendition(string line, Uri baseUri)
    {
        var attributes = ParseAttributes(line);
        var uri = attributes.TryGetValue("URI", out var uriValue) ? uriValue.EnsureAbsoluteUrl(baseUri) : null;
        return new MediaRendition(
            attributes.GetValueOrDefault("TYPE"),
            uri,
            attributes.GetValueOrDefault("GROUP-ID"),
            attributes.GetValueOrDefault("LANGUAGE"),
            attributes.GetValueOrDefault("NAME"),
            attributes.GetValueOrDefault("DEFAULT") == "YES",
            attributes.GetValueOrDefault("AUTOSELECT") == "YES",
            attributes.GetValueOrDefault("FORCED") == "YES"
        );
    }

    private static SessionData ParseSessionData(string line)
    {
        var attributes = ParseAttributes(line);
        return new SessionData(
            attributes["DATA-ID"],
            attributes["VALUE"]
        );
    }

    private static Dictionary<string, string> ParseAttributes(string content)
    {
        var attributes = new Dictionary<string, string>();

        int startIndex = content.IndexOf(":");
        if (startIndex < 0)
            return attributes;

        var attributePairs = content.Substring(startIndex + 1).Split(',');

        var currentPair = new StringBuilder();
        foreach (var pair in attributePairs)
        {
            currentPair.Append(pair);
            if (currentPair.ToString().Count(c => c == '\"') % 2 == 0)
            {
                var pairParts = currentPair.ToString().Split('=');
                if (pairParts.Length < 2)
                    continue;
                attributes[pairParts[0].Trim()] = pairParts[1].Trim().Trim('"');
                currentPair.Clear();
            }
            else
            {
                currentPair.Append(',');
            }
        }

        return attributes;
    }


    public interface IHLSPlaylist
    {
        string GenerateM3U8();
        List<HLSVariantVideoUrlSource> GetVideoSources();
    }

    public class MasterPlaylist : IHLSPlaylist
    {
        public int? Version;
        public int? MediaSequence;
        public List<VariantPlaylistReference> VariantPlaylistsRefs;
        public List<MediaRendition> MediaRenditions;
        public List<SessionData> SessionDataList;
        public bool IndependentSegments;

        public List<string> Unhandled { get; } = new List<string>();

        public MasterPlaylist(int? version, List<VariantPlaylistReference> variantPlaylistsRefs, List<MediaRendition> mediaRenditions, List<SessionData> sessionDataList, bool independentSegments, int? mediaSequence = null, List<string>? unhandled = null)
        {
            Version = version;
            VariantPlaylistsRefs = variantPlaylistsRefs;
            MediaRenditions = mediaRenditions;
            SessionDataList = sessionDataList;
            IndependentSegments = independentSegments;
            MediaSequence = mediaSequence;

            if (unhandled != null)
                Unhandled.AddRange(unhandled);
        }

        public string GenerateM3U8()
        {
            var builder = new StringBuilder();
            builder.AppendLine("#EXTM3U");
            if (Version.HasValue)
                builder.AppendLine("#EXT-X-VERSION:" + Version.Value);

            if (MediaSequence.HasValue)
                builder.AppendLine("#EXT-X-MEDIA-SEQUENCE:" + MediaSequence.Value);

            if (IndependentSegments)
                builder.AppendLine("#EXT-X-INDEPENDENT-SEGMENTS");

            foreach (var rendition in MediaRenditions)
                builder.Append(rendition.ToM3U8Line());

            foreach (var variant in VariantPlaylistsRefs)
                builder.Append(variant.ToM3U8Line());

            foreach (var data in SessionDataList)
                builder.Append(data.ToM3U8Line());

            return builder.ToString();
        }

        public List<HLSVariantVideoUrlSource> GetVideoSources()
        {
            return VariantPlaylistsRefs.Select(x =>
            {
                int width = 0;
                int height = 0;
                var resolutionTokens = x.StreamInfo?.Resolution?.Split("x");
                if(resolutionTokens != null && resolutionTokens.Length >= 2)
                {
                    int.TryParse(resolutionTokens[0], out width);
                    int.TryParse(resolutionTokens[1], out height);
                }

                var suffix = string.Join(", ", new string[]
                {
                    x.StreamInfo?.Video ?? "",
                    x.StreamInfo?.Codecs ?? ""
                }.Where(x => x != null));

                return new HLSVariantVideoUrlSource()
                {
                    Width = width,
                    Height = height,
                    Container = "application/vnd.apple.mpegurl",
                    Codec = x.StreamInfo?.Codecs ?? "",
                    Bitrate = x.StreamInfo?.Bandwidth ?? 0,
                    Duration = 0,
                    Name = suffix,
                    Url = x.Url
                };
            }).ToList();
        }
    }

    public class VariantPlaylist : IHLSPlaylist
    {
        public int? Version;
        public int? TargetDuration;
        public long? MediaSequence;
        public int? DiscontinuitySequence;
        public DateTime? ProgramDateTime;
        public string? PlaylistType;
        public StreamInfo? StreamInfo;
        public List<Segment> Segments;
        public string? MapUrl;
        public long MapBytesStart = -1;
        public long MapBytesLength = -1;
        public DecryptionInfo? Decryption;
        public List<string> UnHandled { get; } = new List<string>();

        public VariantPlaylist(int? version, int? targetDuration, long? mediaSequence, int? discontinuitySequence, DateTime? programDateTime, string? playlistType, StreamInfo? streamInfo, List<Segment> segments, string? mapUrl = null, List<string>? unhandled = null, DecryptionInfo? decryption = null)
        {
            Version = version;
            TargetDuration = targetDuration;
            MediaSequence = mediaSequence;
            DiscontinuitySequence = discontinuitySequence;
            ProgramDateTime = programDateTime;
            PlaylistType = playlistType;
            StreamInfo = streamInfo;
            Segments = segments;
            MapUrl = mapUrl;
            Decryption = decryption;

            if(unhandled != null)
                UnHandled.AddRange(unhandled);
        }

        public string GenerateM3U8()
        {
            var builder = new StringBuilder();
            builder.AppendLine("#EXTM3U");
            if (Version.HasValue)
                builder.AppendLine("#EXT-X-VERSION:" + Version.Value);

            if (TargetDuration.HasValue)
                builder.AppendLine("#EXT-X-TARGETDURATION:" + TargetDuration.Value);

            if (MediaSequence.HasValue)
                builder.AppendLine("#EXT-X-MEDIA-SEQUENCE:" + MediaSequence.Value);

            if (DiscontinuitySequence.HasValue)
                builder.AppendLine("#EXT-X-DISCONTINUITY-SEQUENCE:" + DiscontinuitySequence.Value);

            if (!string.IsNullOrEmpty(PlaylistType))
                builder.AppendLine("#EXT-X-PLAYLIST-TYPE:" + PlaylistType);

            if (ProgramDateTime.HasValue)
                builder.AppendLine("#EXT-X-PROGRAM-DATE-TIME:" + ProgramDateTime.Value.ToString("yyyy-MM-ddTHH:mm:ssZ"));

            if (StreamInfo != null)
                builder.Append(StreamInfo.ToM3U8Line());

            if (Decryption != null)
            {
                var keyBuilder = new StringBuilder();
                keyBuilder.Append("#EXT-X-KEY:METHOD=");
                keyBuilder.Append(Decryption.Method);
                if (!string.Equals(Decryption.Method, "NONE", StringComparison.OrdinalIgnoreCase))
                {
                    if (!string.IsNullOrEmpty(Decryption.KeyUrl))
                    {
                        keyBuilder.Append(",URI=\"");
                        keyBuilder.Append(Decryption.KeyUrl);
                        keyBuilder.Append("\"");
                    }

                    if (!string.IsNullOrEmpty(Decryption.IV))
                        keyBuilder.Append($",IV=0x{Decryption.IV}");

                    if (!string.IsNullOrEmpty(Decryption.KeyFormat))
                    {
                        keyBuilder.Append(",KEYFORMAT=\"");
                        keyBuilder.Append(Decryption.KeyFormat);
                        keyBuilder.Append("\"");
                    }

                    if (!string.IsNullOrEmpty(Decryption.KeyFormatVersions))
                    {
                        keyBuilder.Append(",KEYFORMATVERSIONS=\"");
                        keyBuilder.Append(Decryption.KeyFormatVersions);
                        keyBuilder.Append("\"");
                    }
                }

                builder.AppendLine(keyBuilder.ToString());
            }

            if (!string.IsNullOrEmpty(MapUrl))
            {
                var mapBuilder = new StringBuilder();
                mapBuilder.Append("#EXT-X-MAP:URI=\"");
                mapBuilder.Append(MapUrl);
                mapBuilder.Append("\"");

                if (MapBytesLength > 0)
                {
                    if (MapBytesStart >= 0)
                        mapBuilder.Append($",BYTERANGE=\"{MapBytesLength}@{MapBytesStart}\"");
                    else
                        mapBuilder.Append($",BYTERANGE=\"{MapBytesLength}\"");
                }

                builder.AppendLine(mapBuilder.ToString());
            }

            foreach (var segment in Segments)
                builder.Append(segment.ToM3U8Line());

            return builder.ToString();
        }

        public List<HLSVariantVideoUrlSource> GetVideoSources()
        {
            var x = this;

            int width = 0;
            int height = 0;
            var resolutionTokens = x.StreamInfo?.Resolution?.Split("x");
            if (resolutionTokens != null && resolutionTokens.Length >= 2)
            {
                int.TryParse(resolutionTokens[0], out width);
                int.TryParse(resolutionTokens[1], out height);
            }

            var suffix = string.Join(", ", new string[]
            {
                    x.StreamInfo?.Video ?? "",
                    x.StreamInfo?.Codecs ?? ""
            }.Where(x => x != null));

            var mediaSegment = x.Segments.OfType<MediaSegment>().FirstOrDefault();
            var url = mediaSegment?.Uri ?? string.Empty;
            if (mediaSegment != null)
            {
                return new List<HLSVariantVideoUrlSource>()
                {
                    new HLSVariantVideoUrlSource()
                    {
                        Width = width,
                        Height = height,
                        Container = "application/vnd.apple.mpegurl",
                        Codec = x.StreamInfo?.Codecs ?? "",
                        Bitrate = x.StreamInfo?.Bandwidth ?? 0,
                        Duration = 0,
                        Name = suffix,
                        Url = mediaSegment.Uri
                    }
                };
            }

            throw new NotImplementedException();
        }
    }

    public class SessionData
    {
        public string DataId;
        public string Value;

        public SessionData(string dataId, string value)
        {
            DataId = dataId;
            Value = value;
        }

        public string ToM3U8Line()
        {
            return $"#EXT-X-SESSION-DATA:{AttributesToString([
                ("DATA-ID", DataId),
                ("VALUE", Value)
            ])}\n";
        }
    }

    public class StreamInfo
    {
        public int? Bandwidth;
        public string? Resolution;
        public string? Codecs;
        public string? FrameRate;
        public string? VideoRange;
        public string? Audio;
        public string? Video;
        public string? Subtitles;
        public string? ClosedCaptions;

        public StreamInfo(int? bandwidth, string? resolution, string? codecs, string? frameRate, string? videoRange, string? audio, string? video, string? subtitles, string? closedCaptions)
        {
            Bandwidth = bandwidth;
            Resolution = resolution;
            Codecs = codecs;
            FrameRate = frameRate;
            VideoRange = videoRange;
            Audio = audio;
            Video = video;
            Subtitles = subtitles;
            ClosedCaptions = closedCaptions;
        }

        public string ToM3U8Line()
        {
            return $"#EXT-X-STREAM-INF:{AttributesToString([
                ("BANDWIDTH", Bandwidth?.ToString()),
                ("RESOLUTION", Resolution),
                ("CODECS", Codecs),
                ("FRAME-RATE", FrameRate),
                ("VIDEO-RANGE", VideoRange),
                ("AUDIO", Audio),
                ("VIDEO", Video),
                ("SUBTITLES", Subtitles),
                ("CLOSED-CAPTIONS", ClosedCaptions)
            ])}\n";
        }
    }

    public class MediaRendition
    {
        public string? Type;
        public string? Uri;
        public string? GroupId;
        public string? Language;
        public string? Name;
        public bool IsDefault;
        public bool IsAutoSelect;
        public bool IsForced;

        public MediaRendition(string? type, string? uri, string? groupId, string? language, string? name, bool isDefault, bool isAutoSelect, bool isForced)
        {
            Type = type;
            Uri = uri;
            GroupId = groupId;
            Language = language;
            Name = name;
            IsDefault = isDefault;
            IsAutoSelect = isAutoSelect;
            IsForced = isForced;
        }

        public string ToM3U8Line()
        {
            return $"#EXT-X-MEDIA:{AttributesToString([
                ("TYPE", Type),
                ("URI", Uri),
                ("GROUP-ID", GroupId),
                ("LANGUAGE", Language),
                ("NAME", Name),
                ("DEFAULT", IsDefault ? "YES" : "NO"),
                ("AUTOSELECT", IsAutoSelect ? "YES" : "NO"),
                ("FORCED", IsForced ? "YES" : "NO")
            ])}\n";
        }
    }

    public class VariantPlaylistReference
    {
        public string Url;
        public StreamInfo StreamInfo;

        public VariantPlaylistReference(string url, StreamInfo streamInfo)
        {
            Url = url;
            StreamInfo = streamInfo;
        }

        public string ToM3U8Line()
        {
            return StreamInfo.ToM3U8Line() + Url + "\n";
        }
    }

    public abstract class Segment
    {
        public abstract string ToM3U8Line();
    }

    public class MediaSegment : Segment
    {
        public double Duration;
        public string Uri = "";
        public long BytesStart = -1;
        public long BytesLength = -1;

        public List<string> Unhandled = new List<string>();

        public MediaSegment(double duration)
        {
            Duration = duration;
        }

        public override string ToM3U8Line()
        {
            var builder = new StringBuilder();
            builder.AppendLine($"#EXTINF:{Duration},");
            
            if (BytesLength > 0)
            {
                if (BytesStart >= 0)
                    builder.AppendLine($"#EXT-X-BYTERANGE:{BytesLength}@{BytesStart}");
                else
                    builder.AppendLine($"#EXT-X-BYTERANGE:{BytesLength}");
            }

            builder.AppendLine(Uri);
            return builder.ToString();
        }
    }

    public class DiscontinuitySegment : Segment
    {
        public override string ToM3U8Line()
        {
            return "#EXT-X-DISCONTINUITY\n";
        }
    }

    public class EndListSegment : Segment
    {
        public override string ToM3U8Line()
        {
            return "#EXT-X-ENDLIST\n";
        }
    }
}