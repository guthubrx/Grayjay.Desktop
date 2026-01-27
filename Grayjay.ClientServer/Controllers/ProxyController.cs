using Grayjay.ClientServer.Parsers;
using Grayjay.ClientServer.Proxy;
using Grayjay.ClientServer.States;
using Grayjay.ClientServer.Subscriptions;
using Grayjay.Desktop.POC.Port.States;
using Grayjay.Engine.Models.Video.Additions;
using Grayjay.Engine.Packages;
using Grayjay.Engine.Web;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Primitives;
using System;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Globalization;
using System.Net;
using System.Runtime.CompilerServices;
using System.Text;
using System.Web;
using static Grayjay.ClientServer.Controllers.DetailsController;

namespace Grayjay.ClientServer.Controllers
{
    [Route("[controller]/[action]")]
    public class ProxyController: ControllerBase
    {
        private static readonly ConcurrentDictionary<string, string> ModifierIdCache = new();
        private static readonly Dictionary<(string? modifierId, string url), string> ExistingHlsProxies = new();

        [HttpGet]
        public async Task<IActionResult> Image(string url, string cacheName = null)
        {
            if (string.IsNullOrEmpty(url))
                throw new BadHttpRequestException("Missing url");
            url.IsHttpUrlOrThrow();

            using (HttpClient client = new HttpClient())
            {
                var result = await client.GetAsync(url);
                if (result.StatusCode != HttpStatusCode.OK)
                    return StatusCode((int)result.StatusCode);

                //if (!result.Content.Headers.ContentType.MediaType.StartsWith("image/"))
                //    return BadRequest("Only allowed images");

                foreach (var header in result.Content.Headers)
                    Response.Headers.Add(header.Key, new StringValues(header.Value.ToArray()));

                return new FileStreamResult(await result.Content.ReadAsStreamAsync(), result.Content.Headers.ContentType.MediaType);
            }
        }

        [HttpGet]
        public async Task<IActionResult> Subtitle(int subtitleIndex, bool subtitleIsLocal = false, string? modifierId = null)
        {
            Response.Headers["Access-Control-Allow-Origin"] = "*";

            var state = this.State();

            byte[] bytes;
            string contentType;

            if (subtitleIsLocal)
            {
                var local = EnsureLocal(state);
                var src = local.SubtitleSources[subtitleIndex];
                contentType = src.Format ?? "text/vtt";
                bytes = await System.IO.File.ReadAllBytesAsync(src.FilePath);
                return File(bytes, contentType);
            }

            var video = EnsureVideo(state);
            var srcRemote = video.Subtitles[subtitleIndex];
            contentType = srcRemote.Format ?? "text/vtt";

            var uri = srcRemote.GetSubtitlesUri() ?? new Uri(srcRemote.Url);

            if (uri.Scheme.Equals("file", StringComparison.OrdinalIgnoreCase))
            {
                bytes = await System.IO.File.ReadAllBytesAsync(uri.LocalPath);
                return File(bytes, contentType);
            }

            IRequestModifier? modifier = null;
            if (!string.IsNullOrEmpty(modifierId))
                DetailsState.Modifiers.TryGetValue(modifierId, out modifier);

            if (modifier != null)
            {
                var headers = new Grayjay.Engine.Models.HttpHeaders();
                var res = ModifierHttp.GetBytes(new ManagedHttpClient(), uri.ToString(), modifier, headers);
                if (!res.IsOk)
                    return StatusCode(res.Code);

                return File(res.Bytes, contentType);
            }

            using var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = true });
            bytes = await client.GetByteArrayAsync(uri);
            return File(bytes, contentType);
        }

        [HttpGet]
        public IActionResult SubtitleHLS(int subtitleIndex, bool subtitleIsLocal = false, string? modifierId = null)
        {
            Response.Headers["Access-Control-Allow-Origin"] = "*";

            var state = this.State();
            var baseUri = $"{Request.Scheme}://{Request.Host.Value}";

            var vttUrl =
                $"{baseUri}/Details/Subtitle?subtitleIndex={subtitleIndex}" +
                $"&subtitleIsLocal={subtitleIsLocal}" +
                $"&windowId={state.WindowID}" +
                (!string.IsNullOrEmpty(modifierId) ? $"&modifierId={Uri.EscapeDataString(modifierId)}" : "");

            var durationSeconds = TryGetVideoDurationSeconds(state) ?? 60.0;
            var targetDuration = Math.Max(1, (int)Math.Ceiling(durationSeconds));
            var dur = durationSeconds.ToString(CultureInfo.InvariantCulture);

            var m3u8 =
                "#EXTM3U\n" +
                "#EXT-X-VERSION:3\n" +
                $"#EXT-X-TARGETDURATION:{targetDuration}\n" +
                "#EXT-X-MEDIA-SEQUENCE:0\n" +
                $"#EXTINF:{dur},\n" +
                vttUrl + "\n" +
                "#EXT-X-ENDLIST\n";

            return Content(m3u8, "application/x-mpegurl");
        }

        private static double? TryGetVideoDurationSeconds(WindowState state)
        {
            var v = state.DetailsState.VideoLoaded;
            if (v == null) return null;

            var prop = v.GetType().GetProperty("Duration") ?? v.GetType().GetProperty("DurationSeconds");
            if (prop?.GetValue(v) is int i) return i;
            if (prop?.GetValue(v) is long l) return l;
            if (prop?.GetValue(v) is double d) return d;

            var videoProp = v.GetType().GetProperty("Video")?.GetValue(v);
            if (videoProp != null)
            {
                var p2 = videoProp.GetType().GetProperty("Duration") ?? videoProp.GetType().GetProperty("DurationSeconds");
                if (p2?.GetValue(videoProp) is int i2) return i2;
                if (p2?.GetValue(videoProp) is long l2) return l2;
                if (p2?.GetValue(videoProp) is double d2) return d2;
            }

            return null;
        }


        [HttpGet]
        public async Task<IActionResult> HLS(string url, bool proxyMedia, string modifierId = null)
        {
            var state = this.State();
            IRequestModifier modifier = null;
            if (modifierId != null)
                DetailsState.Modifiers.TryGetValue(modifierId, out modifier);

            var playlist = await GenerateProxiedHLS(url, proxyMedia, $"{Request.Scheme}://{Request.Host.Value}", state, modifier, modifierId);

            return new ContentResult()
            {
                Content = playlist.GenerateM3U8(),
                ContentType = "application/x-mpegurl"
            };
        }

        public static string GetOrCreateModifierId(WindowState state, IRequestModifier modifier, string finalHlsUrl)
        {
            if (state == null || modifier == null || string.IsNullOrEmpty(finalHlsUrl))
                return null;

            var key = $"{state.WindowID}|{modifier.GetType().FullName}|{finalHlsUrl}";

            return ModifierIdCache.GetOrAdd(key, _ =>
            {
                return state.DetailsState.RegisterModifier(modifier);
            });
        }

        public static async Task<Parsers.HLS.IHLSPlaylist> GenerateProxiedHLS(string hlsUrl, bool proxyMedia, string baseUri, WindowState state = null, IRequestModifier? modifier = null, string modifierId = null)
        {
            if (string.IsNullOrEmpty(hlsUrl))
                throw new BadHttpRequestException("Missing url");

            var headers = new Engine.Models.HttpHeaders();
            var res = ModifierHttp.GetBytes(new ManagedHttpClient(), hlsUrl, modifier, headers);

            if (!res.IsOk)
                throw new InvalidDataException($"Failed to fetch manifest [{res.Code}]");

            hlsUrl = res.FinalUrl;
            var body = Encoding.UTF8.GetString(res.Bytes);

            if (string.IsNullOrEmpty(modifierId))
                modifierId = GetOrCreateModifierId(state, modifier, hlsUrl);

            if (!string.IsNullOrEmpty(modifierId) && modifier != null)
                DetailsState.Modifiers[modifierId] = modifier;

            try
            {
                var masterPlaylist = Parsers.HLS.ParseMasterPlaylist(body, hlsUrl);
                if (masterPlaylist.Unhandled.Any(x=>x.StartsWith("#EXTINF:")))
                    throw new ArgumentException("Is a variant playlist");
                masterPlaylist = ProxyHLSMasterPlaylist(baseUri, masterPlaylist, proxyMedia, modifierId, state?.WindowID);
                return masterPlaylist;
            }
            catch
            {
                var playlist = Parsers.HLS.ParseVariantPlaylist(body, hlsUrl);
                playlist = ProxyHLSPlaylist(baseUri, playlist, proxyMedia, modifier, modifierId);
                return playlist;
            }
        }

        private static bool IsSameHost(string baseUri, string url)
        {
            if (!Uri.TryCreate(baseUri, UriKind.Absolute, out var b))
                return false;
            if (!Uri.TryCreate(url, UriKind.Absolute, out var u))
                return false;

            return string.Equals(b.Host, u.Host, StringComparison.OrdinalIgnoreCase) && b.Port == u.Port;
        }

        public static HLS.MasterPlaylist ProxyHLSMasterPlaylist(string baseUri, HLS.MasterPlaylist hlsMasterPlaylist, bool proxyMedia, string? modifierId = null, string? windowId = null)
        {
            foreach (var vp in hlsMasterPlaylist.MediaRenditions)
            {
                if (string.IsNullOrEmpty(vp.Uri))
                    continue;

                if (IsSameHost(baseUri, vp.Uri))
                    continue;

                vp.Uri = $"{baseUri}/proxy/HLS?url={HttpUtility.UrlEncode(vp.Uri)}&proxyMedia={proxyMedia}"
                    + (modifierId != null ? "&modifierId=" + modifierId : "")
                    + (windowId != null ? "&windowId=" + windowId : "");
            }

            foreach (var vp in hlsMasterPlaylist.VariantPlaylistsRefs)
            {
                if (string.IsNullOrEmpty(vp.Url))
                    continue;

                if (IsSameHost(baseUri, vp.Url))
                    continue;

                vp.Url = $"{baseUri}/proxy/HLS?url={HttpUtility.UrlEncode(vp.Url)}&proxyMedia={proxyMedia}"
                    + (modifierId != null ? "&modifierId=" + modifierId : "")
                    + (windowId != null ? "&windowId=" + windowId : "");
            }

            return hlsMasterPlaylist;
        }


        public static HLS.VariantPlaylist ProxyHLSPlaylist(string baseUri, HLS.VariantPlaylist hlsMediaPlaylist, bool proxyMedia, IRequestModifier? modifier = null, string? modifierId = null)
        {
            if (!proxyMedia)
                return hlsMediaPlaylist;

            var uri = new Uri(baseUri);

            IPAddress? ip = null;
            if (!IPAddress.TryParse(uri.Host, out ip) || ip == null)
            {
                if (uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase))
                    ip = IPAddress.Loopback;
                else
                    ip = Dns.GetHostAddresses(uri.Host).First(a => a.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork);
            }
            else
            {
                if (ip.AddressFamily != System.Net.Sockets.AddressFamily.InterNetwork && IPAddress.IsLoopback(ip))
                    ip = IPAddress.Loopback;
            }

            var isLoopback = IPAddress.IsLoopback(ip);
            foreach (var s in hlsMediaPlaylist.Segments)
            {
                if (!(s is HLS.MediaSegment ms))
                    continue;

                var key = (modifierId, ms.Uri);
                lock (ExistingHlsProxies)
                {
                    if (ExistingHlsProxies.TryGetValue(key, out var cached))
                    {
                        ms.Uri = cached;
                    }
                    else
                    {
                        var proxiedUri = HttpProxy.Get(isLoopback).Add(new HttpProxyRegistryEntry()
                        {
                            Url = ms.Uri,
                            FollowRedirects = true,
                            RequestHeaderOptions = new RequestHeaderOptions()
                            {
                                HeadersToInject = new Dictionary<string, string>()
                                {
                                    { "Origin", null }
                                }
                            },
                            ResponseHeaderOptions = new ResponseHeaderOptions()
                            {
                                InjectPermissiveCORS = true
                            },
                            RequestModifier = (modifier != null) ? (string url, HttpProxyRequest req) =>
                            {
                                var modified = modifier.ModifyRequest(url, req.Headers);
                                var newReq = new HttpProxyRequest()
                                {
                                    Method = req.Method,
                                    Path = req.Path,
                                    QueryString = req.QueryString,
                                    Version = req.Version,
                                    Headers = modified?.Headers ?? req.Headers,
                                    Options = req.Options?.Clone() ?? new HttpProxyRequestOptions()
                                };

                                newReq.Options.ImpersonateTarget = modified?.Options?.ImpersonateTarget ?? newReq.Options.ImpersonateTarget;
                                return (modified?.Url ?? url, newReq);
                            }
                            : null
                        }, ip);

                        ExistingHlsProxies[key] = proxiedUri;
                        ms.Uri = proxiedUri;
                    }
                }
            }

            if (!string.IsNullOrEmpty(hlsMediaPlaylist.MapUrl))
            {
                var key = (modifierId, hlsMediaPlaylist.MapUrl);
                lock (ExistingHlsProxies)
                {
                    if (ExistingHlsProxies.TryGetValue(key, out var cached))
                    {
                        hlsMediaPlaylist.MapUrl = cached;
                    }
                    else
                    {
                        var proxiedUri = HttpProxy.Get(isLoopback).Add(new HttpProxyRegistryEntry()
                        {
                            Url = hlsMediaPlaylist.MapUrl,
                            FollowRedirects = true,
                            RequestHeaderOptions = new RequestHeaderOptions()
                            {
                                HeadersToInject = new Dictionary<string, string>()
                                {
                                    { "Origin", null }
                                }
                            },
                            ResponseHeaderOptions = new ResponseHeaderOptions()
                            {
                                InjectPermissiveCORS = true
                            },
                            RequestModifier = (modifier != null) ? (string url, HttpProxyRequest req) =>
                            {
                                var modified = modifier.ModifyRequest(url, req.Headers);
                                var newReq = new HttpProxyRequest()
                                {
                                    Method = req.Method,
                                    Path = req.Path,
                                    QueryString = req.QueryString,
                                    Version = req.Version,
                                    Headers = modified?.Headers ?? req.Headers,
                                    Options = req.Options?.Clone() ?? new HttpProxyRequestOptions()
                                };

                                newReq.Options.ImpersonateTarget = modified?.Options?.ImpersonateTarget ?? newReq.Options.ImpersonateTarget;
                                return (modified?.Url ?? url, newReq);
                            } : null
                        }, ip);

                        ExistingHlsProxies[key] = proxiedUri;
                        hlsMediaPlaylist.MapUrl = proxiedUri;
                    }
                }
            }

            return hlsMediaPlaylist;
        }



        /*
        [HttpGet]
        public async Task<IActionResult> Proxy(string url)
        {
            if (string.IsNullOrEmpty(url))
                throw new BadHttpRequestException("Missing url");

            using (HttpClient client = new HttpClient())
            {
                foreach (var header in Request.Headers)
                    client.DefaultRequestHeaders.Add(header.Key, header.Value.ToList());

                var result = await client.GetAsync(url);
                if (result.StatusCode != HttpStatusCode.OK)
                    return StatusCode((int)result.StatusCode);

                foreach (var header in result.Headers)
                    Response.Headers.Add(header.Key, new StringValues(header.Value.ToArray()));

                return new FileStreamResult(result.Content.ReadAsStream(), result.Content.Headers.ContentType.MediaType);
            }
        }*/
    }
}
