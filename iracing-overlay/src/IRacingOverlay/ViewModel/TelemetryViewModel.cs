using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows.Threading;
using IRacingOverlay.Models;
using IRacingOverlay.Services;

namespace IRacingOverlay.ViewModel;

public sealed class TelemetryViewModel : INotifyPropertyChanged
{
    private static readonly TimeSpan StaleThreshold = TimeSpan.FromSeconds(2);

    private readonly Dispatcher _dispatcher;
    private readonly DispatcherTimer _staleCheckTimer;
    private DateTime _lastUpdateUtc = DateTime.MinValue;

    public event PropertyChangedEventHandler? PropertyChanged;

    public SpeedUnit Units { get; set; } = SpeedUnit.Kmh;

    private bool _isConnected;
    public bool IsConnected { get => _isConnected; private set => SetField(ref _isConnected, value); }

    private bool _isStale;
    public bool IsStale { get => _isStale; private set => SetField(ref _isStale, value); }

    private float _speed;
    public float Speed { get => _speed; private set => SetField(ref _speed, value); }

    private float _rpm;
    public float Rpm { get => _rpm; private set => SetField(ref _rpm, value); }

    private int _gear;
    public int Gear { get => _gear; private set => SetField(ref _gear, value); }
    public string GearDisplay => Gear switch { -1 => "R", 0 => "N", _ => Gear.ToString() };

    private float _fuelLevelL;
    public float FuelLevelL { get => _fuelLevelL; private set => SetField(ref _fuelLevelL, value); }

    private float _lapsRemaining;
    public float LapsRemaining { get => _lapsRemaining; private set => SetField(ref _lapsRemaining, value); }

    private float _lapCurrentTimeSec;
    public float LapCurrentTimeSec { get => _lapCurrentTimeSec; private set => SetField(ref _lapCurrentTimeSec, value); }

    private float _lapLastTimeSec;
    public float LapLastTimeSec { get => _lapLastTimeSec; private set => SetField(ref _lapLastTimeSec, value); }

    private float _lapBestTimeSec;
    public float LapBestTimeSec { get => _lapBestTimeSec; private set => SetField(ref _lapBestTimeSec, value); }

    private float _deltaToBestSec;
    public float DeltaToBestSec { get => _deltaToBestSec; private set => SetField(ref _deltaToBestSec, value); }

    private int _position;
    public int Position { get => _position; private set => SetField(ref _position, value); }

    private int _classPosition;
    public int ClassPosition { get => _classPosition; private set => SetField(ref _classPosition, value); }

    private float _lapDistPct;
    public float LapDistPct { get => _lapDistPct; private set => SetField(ref _lapDistPct, value); }

    private float _lfTempC;
    public float LfTempC { get => _lfTempC; private set => SetField(ref _lfTempC, value); }
    private float _rfTempC;
    public float RfTempC { get => _rfTempC; private set => SetField(ref _rfTempC, value); }
    private float _lrTempC;
    public float LrTempC { get => _lrTempC; private set => SetField(ref _lrTempC, value); }
    private float _rrTempC;
    public float RrTempC { get => _rrTempC; private set => SetField(ref _rrTempC, value); }

    private string _trackDisplayName = "";
    public string TrackDisplayName { get => _trackDisplayName; private set => SetField(ref _trackDisplayName, value); }

    public ObservableCollection<StandingRow> Standings { get; } = new();
    public ObservableCollection<CarPositionOnTrack> CarsOnTrack { get; } = new();

    public string SpeedDisplay => Units == SpeedUnit.Mph
        ? $"{Speed * 2.23694f:0} mph"
        : $"{Speed * 3.6f:0} km/h";

    public TelemetryViewModel(Dispatcher dispatcher)
    {
        _dispatcher = dispatcher;
        _staleCheckTimer = new DispatcherTimer(DispatcherPriority.Background, dispatcher)
        {
            Interval = TimeSpan.FromMilliseconds(500),
        };
        _staleCheckTimer.Tick += (_, _) => RefreshStale();
        _staleCheckTimer.Start();
    }

    public void Attach(ITelemetryService telemetryService) => telemetryService.SnapshotUpdated += OnSnapshot;

    public void Detach(ITelemetryService telemetryService) => telemetryService.SnapshotUpdated -= OnSnapshot;

    private void OnSnapshot(object? sender, TelemetrySnapshot snapshot)
    {
        if (_dispatcher.CheckAccess())
            Apply(snapshot);
        else
            _dispatcher.BeginInvoke(() => Apply(snapshot));
    }

    private void Apply(TelemetrySnapshot snapshot)
    {
        IsConnected = snapshot.IsConnected;
        if (!snapshot.IsConnected)
            return;

        _lastUpdateUtc = DateTime.UtcNow;
        IsStale = false;

        Speed = snapshot.SpeedMs;
        Rpm = snapshot.Rpm;
        Gear = snapshot.Gear;
        FuelLevelL = snapshot.FuelLevelL;
        LapsRemaining = snapshot.EstimateLapsRemaining();
        LapCurrentTimeSec = snapshot.LapCurrentTimeSec;
        LapLastTimeSec = snapshot.LapLastTimeSec;
        LapBestTimeSec = snapshot.LapBestTimeSec;
        DeltaToBestSec = snapshot.DeltaToBestSec;
        Position = snapshot.Position;
        ClassPosition = snapshot.ClassPosition;
        LapDistPct = snapshot.LapDistPct;
        LfTempC = snapshot.LfTempC;
        RfTempC = snapshot.RfTempC;
        LrTempC = snapshot.LrTempC;
        RrTempC = snapshot.RrTempC;
        TrackDisplayName = snapshot.TrackDisplayName;

        ReplaceCollection(Standings, snapshot.Standings);
        ReplaceCollection(CarsOnTrack, snapshot.CarsOnTrack);

        OnPropertyChanged(nameof(SpeedDisplay));
        OnPropertyChanged(nameof(GearDisplay));
    }

    private static void ReplaceCollection<T>(ObservableCollection<T> collection, IReadOnlyList<T> items)
    {
        collection.Clear();
        foreach (var item in items)
            collection.Add(item);
    }

    private void RefreshStale()
    {
        if (IsConnected && DateTime.UtcNow - _lastUpdateUtc > StaleThreshold)
            IsStale = true;
    }

    private void SetField<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value))
            return;
        field = value;
        OnPropertyChanged(propertyName);
    }

    private void OnPropertyChanged([CallerMemberName] string? propertyName = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
}
