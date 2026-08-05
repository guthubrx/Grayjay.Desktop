using System.Net.WebSockets;
using System.Text;
using Grayjay.ClientServer.WebSockets;

namespace Grayjay.Desktop.Tests;

[TestClass]
public class WebSocketTests
{
    private sealed class BlockingWebSocket : WebSocket
    {
        private readonly TaskCompletionSource _release = new(TaskCreationOptions.RunContinuationsAsynchronously);

        public TaskCompletionSource FirstSendStarted { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public int SendCount { get; private set; }

        public override WebSocketCloseStatus? CloseStatus => null;
        public override string? CloseStatusDescription => null;
        public override WebSocketState State => WebSocketState.Open;
        public override string SubProtocol => string.Empty;

        public override void Abort()
        {
            _release.TrySetCanceled();
        }

        public override Task CloseAsync(WebSocketCloseStatus closeStatus, string? statusDescription, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }

        public override Task CloseOutputAsync(WebSocketCloseStatus closeStatus, string? statusDescription, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }

        public override void Dispose()
        {
            _release.TrySetCanceled();
        }

        public override Task<WebSocketReceiveResult> ReceiveAsync(ArraySegment<byte> buffer, CancellationToken cancellationToken)
        {
            return Task.FromResult(new WebSocketReceiveResult(0, WebSocketMessageType.Close, true));
        }

        public override async Task SendAsync(ArraySegment<byte> buffer, WebSocketMessageType messageType, bool endOfMessage, CancellationToken cancellationToken)
        {
            SendCount++;
            FirstSendStarted.TrySetResult();
            await _release.Task.WaitAsync(cancellationToken);
        }

        public void Release()
        {
            _release.TrySetResult();
        }
    }

    [TestMethod]
    public async Task WebSocketClient_DropsMessagesWhenClientIsBackpressured()
    {
        using var socket = new BlockingWebSocket();
        using var client = new WebSocketClient(socket);
        var message = Encoding.UTF8.GetBytes("message");

        for (var i = 0; i < 128; i++)
            await client.SendRaw(message);

        await socket.FirstSendStarted.Task.WaitAsync(TimeSpan.FromSeconds(1));
        socket.Release();
        await Task.Delay(100);

        Assert.IsTrue(socket.SendCount <= 32, "A blocked client must not retain an unbounded number of messages.");
    }
}
