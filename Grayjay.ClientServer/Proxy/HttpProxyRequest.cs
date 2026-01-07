using System.Text;
using Grayjay.Desktop.POC;
using Grayjay.Engine.Models;

namespace Grayjay.ClientServer.Proxy
{
    public sealed class HttpProxyRequestOptions
    {
        public string? ImpersonateTarget { get; set; }

        public HttpProxyRequestOptions Clone()
        {
            return new HttpProxyRequestOptions 
            {
                ImpersonateTarget = ImpersonateTarget
            };
        }
    }

    public class HttpProxyRequest
    {
        public required string Method;
        public required string Path;
        public string QueryString;
        public required string Version;
        public required HttpHeaders Headers;
        public HttpProxyRequestOptions Options { get; set; } = new();

        public byte[] ToBytes()
        {
            var stringBuilder = new StringBuilder();
            stringBuilder.Append($"{Method} {Path} {Version}\r\n");
            foreach (var header in Headers.Items)
                stringBuilder.Append($"{header.Key}: {header.Value}\r\n");
            stringBuilder.Append("\r\n");

            var request = stringBuilder.ToString();
            return Encoding.UTF8.GetBytes(request);
        }

        public static HttpProxyRequest FromBytes(byte[] bytes)
        {
            using var stream = new MemoryStream(bytes);
            using var streamReader = new StreamReader(stream);

            string? requestLine = streamReader.ReadLine();
            if (string.IsNullOrEmpty(requestLine))
                throw new Exception("Request line is empty.");

            var requestParts = requestLine.Split(' ');
            if (requestParts.Length < 3)
                throw new Exception("Invalid request line format.");

            var method = requestParts[0];
            var path = requestParts[1];
            var version = requestParts[2];

            var headers = new HttpHeaders();
            string? line;
            while ((line = streamReader.ReadLine()) != null && line != string.Empty)
            {
                var idx = line.IndexOf(':');
                if (idx <= 0) continue;
                var name = line.Substring(0, idx).Trim();
                var value = line.Substring(idx + 1).Trim();
                if (name.Length == 0) continue;
                headers.Add(name, value);
            }

            return new HttpProxyRequest
            {
                Method = method,
                Path = path,
                Headers = headers,
                Version = version,
                Options = new HttpProxyRequestOptions()
            };
        }
    }
}