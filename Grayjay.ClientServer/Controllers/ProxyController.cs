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

        private static string GetOrCreateModifierId(WindowState state, IRequestModifier modifier, string finalHlsUrl)
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

        public static HLS.MasterPlaylist ProxyHLSMasterPlaylist(string baseUri, HLS.MasterPlaylist hlsMasterPlaylist, bool proxyMedia, string? modifierId = null, string? windowId = null)
        {
            //todo pass in window id
            foreach (var vp in hlsMasterPlaylist.MediaRenditions)
                vp.Uri = $"{baseUri}/proxy/HLS?url={HttpUtility.UrlEncode(vp.Uri)}&proxyMedia={proxyMedia}" + (modifierId != null ? "&modifierId=" + modifierId : "") + (windowId != null ? "&windowId=" + windowId : "");
            foreach (var vp in hlsMasterPlaylist.VariantPlaylistsRefs)
                vp.Url = $"{baseUri}/proxy/HLS?url={HttpUtility.UrlEncode(vp.Url)}&proxyMedia={proxyMedia}" + (modifierId != null ? "&modifierId=" + modifierId : "") + (windowId != null ? "&windowId=" + windowId : "");

            return hlsMasterPlaylist;
        }

        public static HLS.VariantPlaylist ProxyHLSPlaylist(string baseUri, HLS.VariantPlaylist hlsMediaPlaylist, bool proxyMedia, IRequestModifier? modifier = null, string? modifierId = null)
        {
            if (!proxyMedia)
                return hlsMediaPlaylist;

            var uri = new Uri(baseUri);
            var isLoopback = uri.Host.Contains("127.0.0.1");
            var ip = IPAddress.Parse(uri.Host);

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
