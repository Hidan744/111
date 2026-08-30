using System.Threading;
using IRacingOverlay.Models;
using IRacingOverlay.Services.Irsdk;

namespace IRacingOverlay.Services;

/// <summary>Polls the iRacing shared-memory block on a dedicated background thread at ~60Hz.</summary>
public sealed class IRacingTelemetryService : ITelemetryService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromMilliseconds(1000.0 / 60.0);

    private readonly IrsdkClient _client = new();
    private Thread? _thread;
    private volatile bool _running;
    private SessionInfo _sessionInfo = SessionInfo.Empty;

    public event EventHandler<TelemetrySnapshot>? SnapshotUpdated;

    public void Start()
    {
        if (_running)
            return;

        _running = true;
        _thread = new Thread(PollLoop)
        {
            IsBackground = true,
            Name = "IRacingTelemetryPoll",
        };
        _thread.Start();
    }

    public void Stop()
    {
        _running = false;
        _thread?.Join(TimeSpan.FromSeconds(1));
        _client.Disconnect();
    }

    private void PollLoop()
    {
        while (_running)
        {
            var frame = _client.ReadFrame();
            var snapshot = frame is null ? TelemetrySnapshot.Disconnected() : BuildSnapshot(frame);
            SnapshotUpdated?.Invoke(this, snapshot);
            Thread.Sleep(PollInterval);
        }
    }

    private TelemetrySnapshot BuildSnapshot(IrsdkFrame frame)
    {
        if (!string.IsNullOrEmpty(frame.SessionInfoYaml))
            _sessionInfo = SessionInfoParser.Parse(frame.SessionInfoYaml);

        var carIdxLapDistPct = frame.GetFloatArray("CarIdxLapDistPct");
        var carIdxPosition = frame.GetIntArray("CarIdxPosition");
        var carIdxClassPosition = frame.GetIntArray("CarIdxClassPosition");
        var carIdxBestLapTime = frame.GetFloatArray("CarIdxBestLapTime");
        var carIdxLastLapTime = frame.GetFloatArray("CarIdxLastLapTime");
        var carIdxGapToLeader = frame.GetFloatArray("CarIdxF2Time");
        var playerCarIdx = frame.GetInt("PlayerCarIdx", -1);

        var carsOnTrack = new List<CarPositionOnTrack>();
        for (int i = 0; i < carIdxLapDistPct.Length; i++)
        {
            if (carIdxLapDistPct[i] < 0f)
                continue; // car not on track
            carsOnTrack.Add(new CarPositionOnTrack(i, carIdxLapDistPct[i], i == playerCarIdx));
        }

        var standings = BuildStandings(carIdxPosition, carIdxClassPosition, carIdxBestLapTime, carIdxLastLapTime, carIdxGapToLeader, playerCarIdx);

        return new TelemetrySnapshot
        {
            IsConnected = true,
            SpeedMs = frame.GetFloat("Speed"),
            Rpm = frame.GetFloat("RPM"),
            Gear = frame.GetInt("Gear"),
            FuelLevelL = frame.GetFloat("FuelLevel"),
            FuelUsePerHourL = frame.GetFloat("FuelUsePerHour"),
            LapCurrentTimeSec = frame.GetFloat("LapCurrentLapTime"),
            LapLastTimeSec = frame.GetFloat("LapLastLapTime"),
            LapBestTimeSec = frame.GetFloat("LapBestLapTime"),
            DeltaToBestSec = frame.GetFloat("LapDeltaToBestLap"),
            LapNumber = frame.GetInt("Lap"),
            Position = frame.GetInt("PlayerCarPosition"),
            ClassPosition = frame.GetInt("PlayerCarClassPosition"),
            LapDistPct = frame.GetFloat("LapDistPct"),
            LfTempC = AverageTemp(frame, "LF"),
            RfTempC = AverageTemp(frame, "RF"),
            LrTempC = AverageTemp(frame, "LR"),
            RrTempC = AverageTemp(frame, "RR"),
            TrackDisplayName = _sessionInfo.TrackDisplayName,
            Standings = standings,
            CarsOnTrack = carsOnTrack,
        };
    }

    private static float AverageTemp(IrsdkFrame frame, string corner)
    {
        var l = frame.GetFloat($"{corner}tempCL");
        var m = frame.GetFloat($"{corner}tempCM");
        var r = frame.GetFloat($"{corner}tempCR");
        return (l + m + r) / 3f;
    }

    private IReadOnlyList<StandingRow> BuildStandings(
        int[] carIdxPosition, int[] carIdxClassPosition,
        float[] carIdxBestLapTime, float[] carIdxLastLapTime, float[] carIdxGapToLeader,
        int playerCarIdx)
    {
        if (carIdxPosition.Length == 0 || _sessionInfo.Drivers.Count == 0)
            return Array.Empty<StandingRow>();

        var rows = new List<StandingRow>();
        foreach (var driver in _sessionInfo.Drivers)
        {
            if (driver.IsSpectator || driver.CarIdx < 0 || driver.CarIdx >= carIdxPosition.Length)
                continue;

            var position = carIdxClassPosition.Length > driver.CarIdx && carIdxClassPosition[driver.CarIdx] > 0
                ? carIdxClassPosition[driver.CarIdx]
                : carIdxPosition[driver.CarIdx];

            if (position <= 0)
                continue;

            var bestLap = ArrayValueOrZero(carIdxBestLapTime, driver.CarIdx);
            var lastLap = ArrayValueOrZero(carIdxLastLapTime, driver.CarIdx);
            var gap = ArrayValueOrZero(carIdxGapToLeader, driver.CarIdx);

            rows.Add(new StandingRow(position, driver.CarIdx, driver.UserName, driver.CarNumber,
                driver.CarIdx == playerCarIdx, gap, bestLap, lastLap));
        }

        rows.Sort((a, b) => a.Position.CompareTo(b.Position));
        return rows;
    }

    private static float ArrayValueOrZero(float[] array, int index) =>
        index >= 0 && index < array.Length ? array[index] : 0f;

    public void Dispose()
    {
        Stop();
        _client.Dispose();
    }
}
