using System.Windows;
using System.Windows.Controls;
using IRacingOverlay.Interop;
using IRacingOverlay.Models;
using IRacingOverlay.Services;
using IRacingOverlay.ViewModel;
using IRacingOverlay.Widgets;

namespace IRacingOverlay.Overlay;

public partial class OverlayWindow : Window
{
    private readonly SettingsService _settingsService;
    private readonly TelemetryViewModel _viewModel;
    private readonly Dictionary<WidgetKind, WidgetHost> _hosts = new();
    private bool _editable;

    public OverlayWindow(TelemetryViewModel viewModel, SettingsService settingsService)
    {
        InitializeComponent();
        _viewModel = viewModel;
        _settingsService = settingsService;
        DataContext = viewModel;

        Left = SystemParameters.VirtualScreenLeft;
        Top = SystemParameters.VirtualScreenTop;
        Width = SystemParameters.VirtualScreenWidth;
        Height = SystemParameters.VirtualScreenHeight;

        BuildWidgets();
        ApplyLayoutLocked(_settingsService.Current.LayoutLocked);
        UpdateStatusBanner();

        _viewModel.PropertyChanged += (_, _) => UpdateStatusBanner();
        _settingsService.SettingsChanged += (_, settings) => ApplySettings(settings);
        SourceInitialized += (_, _) => ApplyLayoutLocked(_settingsService.Current.LayoutLocked);
    }

    private void UpdateStatusBanner()
    {
        if (!_viewModel.IsConnected)
        {
            StatusBannerText.Text = "Waiting for iRacing...";
            StatusBanner.Visibility = Visibility.Visible;
        }
        else if (_viewModel.IsStale)
        {
            StatusBannerText.Text = "Telemetry stale — showing last known values";
            StatusBanner.Visibility = Visibility.Visible;
        }
        else
        {
            StatusBanner.Visibility = Visibility.Collapsed;
        }
    }

    private void BuildWidgets()
    {
        foreach (var kind in Enum.GetValues<WidgetKind>())
        {
            var content = CreateWidgetContent(kind);
            var settings = _settingsService.Current.GetOrAddWidget(kind);

            var host = new WidgetHost { Kind = kind, Content = content };
            Canvas.SetLeft(host, settings.X);
            Canvas.SetTop(host, settings.Y);
            host.Visibility = settings.Enabled ? Visibility.Visible : Visibility.Collapsed;
            host.PositionChanged += (_, pos) => OnWidgetMoved(kind, pos.X, pos.Y);

            _hosts[kind] = host;
            WidgetCanvas.Children.Add(host);
        }
    }

    private static UserControl CreateWidgetContent(WidgetKind kind) => kind switch
    {
        WidgetKind.Speed => new SpeedWidget(),
        WidgetKind.RpmGear => new RpmGearWidget(),
        WidgetKind.Fuel => new FuelWidget(),
        WidgetKind.LapTimes => new LapTimesWidget(),
        WidgetKind.DeltaBest => new DeltaBestWidget(),
        WidgetKind.TireTemps => new TireTempsWidget(),
        WidgetKind.Position => new PositionWidget(),
        WidgetKind.TrackMap => new TrackMapWidget(),
        WidgetKind.Standings => new StandingsWidget(),
        _ => throw new ArgumentOutOfRangeException(nameof(kind)),
    };

    private void OnWidgetMoved(WidgetKind kind, double x, double y)
    {
        var settings = _settingsService.Current.GetOrAddWidget(kind);
        settings.X = x;
        settings.Y = y;
        _settingsService.Save(_settingsService.Current);
    }

    public void ApplySettings(AppSettings settings)
    {
        _viewModel.Units = settings.Units;
        foreach (var (kind, host) in _hosts)
        {
            var widgetSettings = settings.GetOrAddWidget(kind);
            host.Visibility = widgetSettings.Enabled ? Visibility.Visible : Visibility.Collapsed;
            Canvas.SetLeft(host, widgetSettings.X);
            Canvas.SetTop(host, widgetSettings.Y);
        }
        ApplyLayoutLocked(settings.LayoutLocked);
    }

    public void ToggleLayoutLock()
    {
        var settings = _settingsService.Current;
        settings.LayoutLocked = !settings.LayoutLocked;
        _settingsService.Save(settings);
    }

    private void ApplyLayoutLocked(bool locked)
    {
        _editable = !locked;
        foreach (var host in _hosts.Values)
            host.IsEditable = _editable;

        EditHint.Visibility = _editable ? Visibility.Visible : Visibility.Collapsed;
        ClickThrough.SetClickThrough(this, locked);
    }
}
