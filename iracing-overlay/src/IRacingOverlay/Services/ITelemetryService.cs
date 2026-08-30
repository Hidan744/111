using IRacingOverlay.Models;

namespace IRacingOverlay.Services;

public interface ITelemetryService : IDisposable
{
    /// <summary>Raised roughly 60 times per second on a background thread. Subscribers must marshal to the UI thread themselves.</summary>
    event EventHandler<TelemetrySnapshot>? SnapshotUpdated;

    void Start();
    void Stop();
}
