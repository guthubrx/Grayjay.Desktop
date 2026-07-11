using Grayjay.ClientServer.Controllers;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace Grayjay.Desktop.Tests
{
    [TestClass]
    public class PlaybackPreparationTests
    {
        private sealed class DisposableValue : IDisposable
        {
            public bool IsDisposed { get; private set; }

            public void Dispose()
            {
                IsDisposed = true;
            }
        }

        [TestMethod]
        public async Task PrepareAsync_DeduplicatesMatchingRequests()
        {
            var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            var resolveCount = 0;
            var preparation = new DetailsController.PlaybackPreparation<string>();

            var first = preparation.PrepareAsync("video-a", async () =>
            {
                Interlocked.Increment(ref resolveCount);
                await release.Task;
                return "resolved-a";
            });
            var second = preparation.PrepareAsync("video-a", () => Task.FromResult("unused"));

            Assert.AreSame(first, second);
            release.SetResult();
            await first;
            Assert.AreEqual(1, resolveCount);
        }

        [TestMethod]
        public async Task PrepareAsync_SerializesDifferentRequestsAndKeepsLatest()
        {
            var firstStarted = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            var releaseFirst = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            var secondStarted = false;
            var preparation = new DetailsController.PlaybackPreparation<string>();

            var first = preparation.PrepareAsync("video-a", async () =>
            {
                firstStarted.SetResult();
                await releaseFirst.Task;
                return "resolved-a";
            });
            await firstStarted.Task;

            var second = preparation.PrepareAsync("video-b", () =>
            {
                secondStarted = true;
                return Task.FromResult("resolved-b");
            });

            await Task.Delay(50);
            Assert.IsFalse(secondStarted);
            releaseFirst.SetResult();

            Assert.AreEqual(DetailsController.PlaybackPreparationStatus.Superseded, (await first).Status);
            Assert.AreEqual(DetailsController.PlaybackPreparationStatus.Prepared, (await second).Status);
            Assert.AreEqual("resolved-b", await preparation.ConsumeAsync("video-b", TimeSpan.FromHours(2)));
            Assert.IsNull(await preparation.ConsumeAsync("video-a", TimeSpan.FromHours(2)));
        }

        [TestMethod]
        public async Task ConsumeAsync_ExpiresOldPreparation()
        {
            var now = new DateTime(2026, 7, 11, 10, 0, 0, DateTimeKind.Utc);
            var preparation = new DetailsController.PlaybackPreparation<string>(() => now);

            await preparation.PrepareAsync("video-a", () => Task.FromResult("resolved-a"));
            now = now.AddHours(2).AddMilliseconds(1);

            Assert.IsNull(await preparation.ConsumeAsync("video-a", TimeSpan.FromHours(2)));
        }

        [TestMethod]
        public async Task ConsumeAsync_ReturnsPreparationOnlyOnce()
        {
            var preparation = new DetailsController.PlaybackPreparation<string>();

            await preparation.PrepareAsync("video-a", () => Task.FromResult("resolved-a"));

            Assert.AreEqual("resolved-a", await preparation.ConsumeAsync("video-a", TimeSpan.FromHours(2)));
            Assert.IsNull(await preparation.ConsumeAsync("video-a", TimeSpan.FromHours(2)));
        }

        [TestMethod]
        public async Task Cancel_DiscardsRunningPreparation()
        {
            var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            var preparation = new DetailsController.PlaybackPreparation<string>();

            var task = preparation.PrepareAsync("video-a", async () =>
            {
                started.SetResult();
                await release.Task;
                return "resolved-a";
            });
            await started.Task;

            preparation.Cancel();
            release.SetResult();

            Assert.AreEqual(DetailsController.PlaybackPreparationStatus.Superseded, (await task).Status);
            Assert.IsNull(await preparation.ConsumeAsync("video-a", TimeSpan.FromHours(2)));
        }

        [TestMethod]
        public async Task PrepareAsync_DisposesPreparedValueWhenTargetChanges()
        {
            var preparation = new DetailsController.PlaybackPreparation<DisposableValue>();
            var first = new DisposableValue();

            await preparation.PrepareAsync("video-a", () => Task.FromResult(first));
            await preparation.PrepareAsync("video-b", () => Task.FromResult(new DisposableValue()));

            Assert.IsTrue(first.IsDisposed);
        }

        [TestMethod]
        public async Task Cancel_DisposesPreparedValue()
        {
            var preparation = new DetailsController.PlaybackPreparation<DisposableValue>();
            var value = new DisposableValue();

            await preparation.PrepareAsync("video-a", () => Task.FromResult(value));
            preparation.Cancel();

            Assert.IsTrue(value.IsDisposed);
        }

        [TestMethod]
        public async Task ConsumeAsync_DoesNotDisposeTransferredValue()
        {
            var preparation = new DetailsController.PlaybackPreparation<DisposableValue>();
            var value = new DisposableValue();

            await preparation.PrepareAsync("video-a", () => Task.FromResult(value));
            var consumed = await preparation.ConsumeAsync("video-a", TimeSpan.FromHours(2));

            Assert.AreSame(value, consumed);
            Assert.IsFalse(value.IsDisposed);
        }

        [TestMethod]
        public async Task ConsumeAsync_DisposesExpiredValue()
        {
            var now = new DateTime(2026, 7, 11, 10, 0, 0, DateTimeKind.Utc);
            var preparation = new DetailsController.PlaybackPreparation<DisposableValue>(() => now);
            var value = new DisposableValue();

            await preparation.PrepareAsync("video-a", () => Task.FromResult(value));
            now = now.AddHours(2).AddMilliseconds(1);
            await preparation.ConsumeAsync("video-a", TimeSpan.FromHours(2));

            Assert.IsTrue(value.IsDisposed);
        }

        [TestMethod]
        public async Task AdoptPreparedMedia_TransfersDashCache()
        {
            var prepared = new DetailsController.DetailsState();
            var active = new DetailsController.DetailsState();
            prepared.SetCachedDash(2, 3, -1, null, Task.FromResult("prepared-dash"));

            active.AdoptPreparedMedia(prepared);

            Assert.AreEqual("prepared-dash", await active.GetCachedDashTask(2, 3, -1, null)!);
            Assert.IsNull(prepared.GetCachedDashTask(2, 3, -1, null));
        }
    }
}
