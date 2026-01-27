using Grayjay.Desktop.POC;
using Microsoft.Extensions.Logging.Abstractions;
using System.Diagnostics;

namespace Grayjay.ClientServer
{
    public class TokenMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly GrayjayServer _server;

        private HashSet<string> _excluded = new HashSet<string>()
        {

        };

        public TokenMiddleware(RequestDelegate next, GrayjayServer server)
        {
            _next = next;
            _server = server;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            if (_server.UseTokenSecurity && !_excluded.Contains(context.Request.Path))
            {
                string token = context.Request.Headers["_token"];
                if(token == null || !_server.HasToken(token))
                    throw new UnauthorizedAccessException("No valid token");
            }
            await _next(context);
        }
    }
}
