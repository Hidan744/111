using System.Threading;
using IRacingOverlay.Models;
using IRacingOverlay.Services;
using Xunit;

namespace IRacingOverlay.Tests;

public class MockTelemetryServiceTests
{
    [Fact]
    public void Start_EmitsConnectedSnapshots_WithoutIRacingRunning()
    {
        using var service = new MockTelemetryService();
        var received = new List<TelemetrySnapshot>();
        using var signal = new ManualResetEventSlim(false);

        service.SnapshotUpdated += (_, snapshot) =>
        {
            received.Add(snapshot);
            if (received.Count >= 3)
                signal.Set();
        };

        service.Start();
        var signaled = signal.Wait(TimeSpan.FromSeconds(2));
        service.Stop();

        Assert.True(signaled, "Expected at least 3 synthetic telemetry frames within 2 seconds.");
        Assert.All(received, s => Assert.True(s.IsConnected));
        Assert.All(received, s => Assert.InRange(s.LapDistPct, 0f, 1f));
    }
}
