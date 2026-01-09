using Grayjay.Engine.Models;
using Grayjay.Engine.Web;
using Grayjay.Engine.Models.Video.Additions;
using Grayjay.Engine.Packages;

namespace Grayjay.ClientServer
{
    public static partial class ModifierHttp
    {
        public readonly record struct BytesResult(string FinalUrl, int Code, byte[] Bytes)
        {
            public bool IsOk => Code >= 200 && Code < 300;
        }

        public readonly record struct StreamResult(string FinalUrl, int Code, long ContentLength, Stream Stream)
        {
            public bool IsOk => Code >= 200 && Code < 300;
        }

        private static List<KeyValuePair<string, string>> ToHeaderList(HttpHeaders headers)
        {
            var list = new List<KeyValuePair<string, string>>();
            foreach (var h in headers)
            {
                if (!string.IsNullOrEmpty(h.Key) && h.Value != null)
                    list.Add(new KeyValuePair<string, string>(h.Key, h.Value));
            }
            return list;
        }

        public static BytesResult GetBytes(
            ManagedHttpClient client,
            string url,
            IRequestModifier? modifier = null,
            HttpHeaders? headers = null)
        {
            headers ??= new HttpHeaders();
            var modified = modifier?.ModifyRequest(url, headers);

            var finalUrl = modified?.Url ?? url;
            var finalHeaders = modified?.Headers ?? headers;
            var impersonate = modified?.Options?.ImpersonateTarget;

            if (!string.IsNullOrEmpty(impersonate))
            {
                var res = Libcurl.Perform(new Libcurl.Request
                {
                    Url = finalUrl,
                    Method = "GET",
                    Headers = ToHeaderList(finalHeaders),
                    ImpersonateTarget = impersonate
                });
                if (res.EffectiveUrl != null)
                    finalUrl = res.EffectiveUrl;

                var code = Convert.ToInt32(res.Status);
                return new BytesResult(finalUrl, code, res.BodyBytes ?? Array.Empty<byte>());
            }

            var resp = client.GET(finalUrl, finalHeaders);
            if (resp.Url != null)
                finalUrl = resp.Url;

            if (resp.Body == null)
                return new BytesResult(finalUrl, resp.Code, Array.Empty<byte>());

            return new BytesResult(finalUrl, resp.Code, resp.Body.AsBytes());
        }

        public static StreamResult GetStream(
            ManagedHttpClient client,
            string url,
            IRequestModifier? modifier = null,
            HttpHeaders? headers = null)
        {
            headers ??= new HttpHeaders();
            var modified = modifier?.ModifyRequest(url, headers);

            var finalUrl = modified?.Url ?? url;
            var finalHeaders = modified?.Headers ?? headers;
            var impersonate = modified?.Options?.ImpersonateTarget;

            if (!string.IsNullOrEmpty(impersonate))
            {
                var res = Libcurl.Perform(new Libcurl.Request
                {
                    Url = finalUrl,
                    Method = "GET",
                    Headers = ToHeaderList(finalHeaders),
                    ImpersonateTarget = impersonate
                });

                var bytes = res.BodyBytes ?? Array.Empty<byte>();
                var code = Convert.ToInt32(res.Status);
                return new StreamResult(finalUrl, code, bytes.LongLength, new MemoryStream(bytes, writable: false));
            }

            var resp = client.GET(finalUrl, finalHeaders);
            if (resp.Body == null)
                return new StreamResult(finalUrl, resp.Code, resp.ContentLength, Stream.Null);

            return new StreamResult(finalUrl, resp.Code, resp.ContentLength, resp.Body.AsStream());
        }
    }
}
