using Grayjay.ClientServer.Parsers;
using Grayjay.ClientServer.Proxy;
using Grayjay.ClientServer.States;
using Grayjay.ClientServer.Subscriptions;
using Grayjay.Desktop.POC.Port.States;
using Grayjay.Engine.Models.Video.Additions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Primitives;
using System;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using System.Runtime.CompilerServices;
using System.Web;
using static Grayjay.ClientServer.Controllers.DetailsController;

namespace Grayjay.ClientServer.Controllers
{
    [Route("[controller]/[action]")]
    public class ProxyController: ControllerBase
    {
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

            var playlist = await GenerateProxiedHLS(url, proxyMedia, $"{Request.Scheme}://{Request.Host.Value}", state, modifier);

            return new ContentResult()
            {
                Content = playlist.GenerateM3U8(),
                ContentType = "application/x-mpegurl"
            };
        }

        public static async Task<Parsers.HLS.IHLSPlaylist> GenerateProxiedHLS(string hlsUrl, bool proxyMedia, string baseUri, WindowState state = null, IRequestModifier? modifier = null)
        {
            if (string.IsNullOrEmpty(hlsUrl))
                throw new BadHttpRequestException("Missing url");

            string modifierId = (state != null && modifier != null) ? state.DetailsState.RegisterModifier(modifier) : null;

            using (HttpClient client = new HttpClient())
            {
                var modified = modifier?.ModifyRequest(hlsUrl, new Engine.Models.HttpHeaders());
                if(modified != null)
                {
                    hlsUrl = modified.Url ?? hlsUrl;
                    if(modified.Headers != null)
                        foreach(var header in modified.Headers)
                        {
                            client.DefaultRequestHeaders.Add(header.Key, header.Value);
                        }
                }
                    
                var result = await client.GetAsync(hlsUrl);
                if (result.StatusCode != HttpStatusCode.OK)
                    throw new InvalidDataException($"Failed to fetch manifest [" + result.StatusCode + "]");

                var body = await result.Content.ReadAsStringAsync();

                try
                {
                    var masterPlaylist = Parsers.HLS.ParseMasterPlaylist(body, result.RequestMessage.RequestUri.ToString());
                    if (masterPlaylist.Unhandled.Any(x=>x.StartsWith("#EXTINF:")))
                        throw new ArgumentException("Is a variant playlist");
                    masterPlaylist = ProxyHLSMasterPlaylist(baseUri, masterPlaylist, proxyMedia, modifierId);
                    return masterPlaylist;
                }
                catch
                {
                    var playlist = Parsers.HLS.ParseVariantPlaylist(body, hlsUrl);
                    playlist = ProxyHLSPlaylist(baseUri, playlist, proxyMedia, modifier);
                    return playlist;
                }
            }
        }



        public static HLS.MasterPlaylist ProxyHLSMasterPlaylist(string baseUri, HLS.MasterPlaylist hlsMasterPlaylist, bool proxyMedia, string? modifierId = null)
        {
            foreach (var vp in hlsMasterPlaylist.MediaRenditions)
                vp.Uri = $"{baseUri}/proxy/HLS?url={HttpUtility.UrlEncode(vp.Uri)}&proxyMedia={proxyMedia}" + (modifierId != null ? "&modifierId=" + modifierId : "");
            foreach (var vp in hlsMasterPlaylist.VariantPlaylistsRefs)
                vp.Url = $"{baseUri}/proxy/HLS?url={HttpUtility.UrlEncode(vp.Url)}&proxyMedia={proxyMedia}" + (modifierId != null ? "&modifierId=" + modifierId : "");

            return hlsMasterPlaylist;
        }

        private static Dictionary<string, string> ExistingHlsProxies = new Dictionary<string, string>();

        public static HLS.VariantPlaylist ProxyHLSPlaylist(string baseUri, HLS.VariantPlaylist hlsMediaPlaylist, bool proxyMedia, IRequestModifier? modifier = null)
        {
            if (!proxyMedia)
                return hlsMediaPlaylist;

            foreach (var s in hlsMediaPlaylist.Segments)
            {
                if (!(s is HLS.MediaSegment ms))
                    continue;

                var uri = new Uri(baseUri);
                var isLoopback = uri.Host.Contains("127.0.0.1");
                var ip = IPAddress.Parse(uri.Host);


                lock (ExistingHlsProxies)
                {
                    if (ExistingHlsProxies.TryGetValue(ms.Uri, out var ur))
                        ms.Uri = ur;
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

                        ExistingHlsProxies[ms.Uri] = proxiedUri;
                        ms.Uri = proxiedUri;
                    }
                }
            }

            if (!string.IsNullOrEmpty(hlsMediaPlaylist.MapUrl))
            {
                lock (ExistingHlsProxies)
                {
                    if (ExistingHlsProxies.TryGetValue(hlsMediaPlaylist.MapUrl, out var ur))
                        hlsMediaPlaylist.MapUrl = ur;
                    else
                    {
                        var proxiedUri = HttpProxy.Get().Add(new HttpProxyRegistryEntry()
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
                                return (modified?.Url ?? url, new HttpProxyRequest()
                                {
                                    Method = req.Method,
                                    Path = req.Path,
                                    QueryString = req.QueryString,
                                    Version = req.Version,
                                    Headers = modified?.Headers ?? req.Headers
                                });
                            } : null
                        });

                        ExistingHlsProxies[hlsMediaPlaylist.MapUrl] = proxiedUri;
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
