using Grayjay.Engine.Models;

namespace Grayjay.ClientServer.Proxy
{
    public sealed class HttpProxyRangeCache : IDisposable
    {
        private readonly object _lockObject = new object();
        private byte[]? _data;
        private long _start;
        private long? _totalLength;
        private string? _contentType;

        public int Length
        {
            get
            {
                lock (_lockObject)
                    return _data?.Length ?? 0;
            }
        }

        public int HitCount { get; private set; }

        public void Store(long start, byte[] data, long? totalLength, string? contentType)
        {
            ArgumentNullException.ThrowIfNull(data);
            lock (_lockObject)
            {
                _start = start;
                _data = data;
                _totalLength = totalLength;
                _contentType = contentType;
            }
        }

        public bool TryCreateResponse(HttpProxyRequest request, out HttpProxyResponse? response)
        {
            response = null;
            if (!request.Method.Equals("GET", StringComparison.OrdinalIgnoreCase) ||
                !request.Headers.TryGetFirst("range", out var rangeHeader) ||
                !TryParseRange(rangeHeader, out var requestedStart, out var requestedEnd))
                return false;

            lock (_lockObject)
            {
                if (_data == null || requestedStart < _start || requestedEnd >= _start + _data.Length)
                    return false;

                var offset = checked((int)(requestedStart - _start));
                var length = checked((int)(requestedEnd - requestedStart + 1));
                var data = new byte[length];
                Buffer.BlockCopy(_data, offset, data, 0, length);
                var headers = new HttpHeaders(new Dictionary<string, string>
                {
                    { "Accept-Ranges", "bytes" },
                    { "Access-Control-Allow-Origin", "*" },
                    { "Content-Length", length.ToString() },
                    { "Content-Range", $"bytes {requestedStart}-{requestedEnd}/{_totalLength?.ToString() ?? "*"}" }
                });
                if (!string.IsNullOrWhiteSpace(_contentType))
                    headers.Add("Content-Type", _contentType);

                HitCount++;
                response = new HttpProxyResponse
                {
                    StatusCode = 206,
                    Version = "HTTP/1.1",
                    Headers = headers,
                    Data = data
                };
                return true;
            }
        }

        public void Dispose()
        {
            lock (_lockObject)
            {
                _data = null;
                _totalLength = null;
                _contentType = null;
            }
        }

        private static bool TryParseRange(string? value, out long start, out long end)
        {
            start = 0;
            end = 0;
            if (string.IsNullOrWhiteSpace(value) || !value.StartsWith("bytes=", StringComparison.OrdinalIgnoreCase))
                return false;

            var parts = value.Substring("bytes=".Length).Split('-', 2);
            return parts.Length == 2 &&
                long.TryParse(parts[0], out start) &&
                long.TryParse(parts[1], out end) &&
                start >= 0 && end >= start;
        }
    }

    public sealed class StartupMediaPrefetchTarget : IDisposable
    {
        private readonly Action? _release;
        private int _disposed;

        public string Url { get; }
        public int Bitrate { get; }
        public HttpProxyRangeCache Cache { get; }

        public StartupMediaPrefetchTarget(string url, int bitrate, HttpProxyRangeCache cache, Action? release = null)
        {
            Url = url;
            Bitrate = bitrate;
            Cache = cache;
            _release = release;
        }

        public void Dispose()
        {
            if (Interlocked.Exchange(ref _disposed, 1) != 0)
                return;
            Cache.Dispose();
            _release?.Invoke();
        }
    }

    public static class StartupMediaPrefetchPolicy
    {
        public const int MaxTotalBytes = 16 * 1024 * 1024;
        public const int MinTargetBytes = 256 * 1024;
        public const double DefaultThroughputBitsPerSecond = 25_000_000;

        private static readonly object _lockObject = new object();
        private static double _observedThroughputBitsPerSecond = DefaultThroughputBitsPerSecond;

        public static double ObservedThroughputBitsPerSecond
        {
            get
            {
                lock (_lockObject)
                    return _observedThroughputBitsPerSecond;
            }
        }

        public static int[] CalculateTargetBytes(IReadOnlyList<int> bitrates, double throughputBitsPerSecond)
        {
            if (bitrates.Count == 0)
                return [];

            var weights = bitrates.Select(bitrate => Math.Max(bitrate, 1)).ToArray();
            var totalBitrate = weights.Sum(value => (long)value);
            var ratio = throughputBitsPerSecond / totalBitrate;
            var targetSeconds = ratio >= 4 ? 6 : ratio >= 2 ? 4 : 2;
            var desiredTotal = Math.Clamp(totalBitrate * targetSeconds / 8, MinTargetBytes * bitrates.Count, MaxTotalBytes);
            var result = weights
                .Select(weight => Math.Max(MinTargetBytes, (int)Math.Min(int.MaxValue, desiredTotal * weight / totalBitrate)))
                .ToArray();

            var allocated = result.Sum(value => (long)value);
            if (allocated <= MaxTotalBytes)
                return result;

            var scale = (double)MaxTotalBytes / allocated;
            for (var i = 0; i < result.Length; i++)
                result[i] = Math.Max(1, (int)(result[i] * scale));
            return result;
        }

        public static void Observe(long bytes, TimeSpan elapsed)
        {
            if (bytes <= 0 || elapsed <= TimeSpan.Zero)
                return;

            var sample = bytes * 8 / elapsed.TotalSeconds;
            lock (_lockObject)
                _observedThroughputBitsPerSecond = (_observedThroughputBitsPerSecond * 0.75) + (sample * 0.25);
        }
    }
}
