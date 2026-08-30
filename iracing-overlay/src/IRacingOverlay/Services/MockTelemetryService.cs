using IRacingOverlay.Models;

namespace IRacingOverlay.Services;

/// <summary>Synthesizes plausible telemetry frames so the overlay and widgets can be developed and
/// tested without iRacing running, per the design doc's testing strategy.</summary>
public sealed class MockTelemetryService : ITelemetryService
{
    private static readonly TimeSpan TickInterval = TimeSpan.FromMilliseconds(1000.0 / 60.0);
    private readonly System.Timers.Timer _timer = new(TickInterval.TotalMilliseconds);
    private double _t;
    private float _bestLap = 92.4f;
    private float _fuel = 60f;

    public event EventHandler<TelemetrySnapshot>? SnapshotUpdated;

    public MockTelemetryService()
    {
        _timer.Elapsed += (_, _) => Tick();
        _timer.AutoReset = true;
    }

    public void Start() => _timer.Start();

    public void Stop() => _timer.Stop();

    private void Tick()
    {
        _t += TickInterval.TotalSeconds;
        var lapPct = (float)(_t % _bestLap) / _bestLap;
        var speed = 40f + 30f * (float)Math.Sin(_t * 0.5) + 20f;
        _fuel = Math.Max(0f, _fuel - 0.0006f);

        var standings = new List<StandingRow>
        {
            new(1, 0, "A. Driver", "12", false, 0f, _bestLap - 0.4f, _bestLap + 0.1f),
            new(2, 1, "You", "07", true, 1.2f, _bestLap, _bestLap + 0.6f),
            new(3, 2, "C. Racer", "44", false, 2.8f, _bestLap + 0.5f, _bestLap + 0.9f),
        };

        var cars = new List<CarPositionOnTrack>
        {
            new(0, (lapPct + 0.05f) % 1f, false),
            new(1, lapPct, true),
            new(2, (lapPct - 0.04f + 1f) % 1f, false),
        };

        var snapshot = new TelemetrySnapshot
        {
            IsConnected = true,
            SpeedMs = Math.Max(0f, speed),
            Rpm = 3000f + 4000f * Math.Abs((float)Math.Sin(_t)),
            Gear = 3,
            FuelLevelL = _fuel,
            FuelUsePerHourL = 12.5f,
            LapCurrentTimeSec = (float)(_t % _bestLap),
            LapLastTimeSec = _bestLap + 0.6f,
            LapBestTimeSec = _bestLap,
            DeltaToBestSec = (float)Math.Sin(_t * 0.3) * 0.8f,
            LapNumber = (int)(_t / _bestLap) + 1,
            Position = 2,
            ClassPosition = 2,
            LapDistPct = lapPct,
            LfTempC = 85f,
            RfTempC = 87f,
            LrTempC = 82f,
            RrTempC = 84f,
            TrackDisplayName = "Mock Speedway (offline)",
            Standings = standings,
            CarsOnTrack = cars,
        };

        SnapshotUpdated?.Invoke(this, snapshot);
    }

    public void Dispose() => _timer.Dispose();
}
