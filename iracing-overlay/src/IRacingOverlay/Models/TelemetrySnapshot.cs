namespace IRacingOverlay.Models;

/// <summary>Point-in-time telemetry read from iRacing (or synthesized by the mock source).</summary>
public sealed class TelemetrySnapshot
{
    public bool IsConnected { get; init; }
    public DateTime TimestampUtc { get; init; } = DateTime.UtcNow;

    public float SpeedMs { get; init; }
    public float Rpm { get; init; }
    public int Gear { get; init; }

    public float FuelLevelL { get; init; }
    public float FuelUsePerHourL { get; init; }

    public float LapCurrentTimeSec { get; init; }
    public float LapLastTimeSec { get; init; }
    public float LapBestTimeSec { get; init; }
    public float DeltaToBestSec { get; init; }
    public int LapNumber { get; init; }

    public int Position { get; init; }
    public int ClassPosition { get; init; }
    public float LapDistPct { get; init; }

    public float LfTempC { get; init; }
    public float RfTempC { get; init; }
    public float LrTempC { get; init; }
    public float RrTempC { get; init; }

    public string TrackDisplayName { get; init; } = "";
    public IReadOnlyList<StandingRow> Standings { get; init; } = Array.Empty<StandingRow>();
    public IReadOnlyList<CarPositionOnTrack> CarsOnTrack { get; init; } = Array.Empty<CarPositionOnTrack>();

    public static TelemetrySnapshot Disconnected() => new() { IsConnected = false };

    public float EstimateLapsRemaining() => FuelCalculator.EstimateLapsRemaining(FuelLevelL, FuelUsePerHourL, LapLastTimeSec);
}

public readonly record struct StandingRow(int Position, int CarIdx, string DriverName, string CarNumber, bool IsPlayer, float GapSec);

public readonly record struct CarPositionOnTrack(int CarIdx, float LapDistPct, bool IsPlayer);
