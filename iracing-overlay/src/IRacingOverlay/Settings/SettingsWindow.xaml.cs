using System.Windows;
using System.Windows.Controls;
using IRacingOverlay.Models;
using IRacingOverlay.Services;

namespace IRacingOverlay.Settings;

public partial class SettingsWindow : Window
{
    private readonly SettingsService _settingsService;
    private readonly Dictionary<WidgetKind, CheckBox> _widgetChecks;

    public SettingsWindow(SettingsService settingsService)
    {
        InitializeComponent();
        _settingsService = settingsService;

        _widgetChecks = new Dictionary<WidgetKind, CheckBox>
        {
            [WidgetKind.Speed] = ChkSpeed,
            [WidgetKind.RpmGear] = ChkRpmGear,
            [WidgetKind.Fuel] = ChkFuel,
            [WidgetKind.LapTimes] = ChkLapTimes,
            [WidgetKind.DeltaBest] = ChkDeltaBest,
            [WidgetKind.TireTemps] = ChkTireTemps,
            [WidgetKind.Position] = ChkPosition,
            [WidgetKind.TrackMap] = ChkTrackMap,
            [WidgetKind.Standings] = ChkStandings,
        };

        LoadFromSettings(_settingsService.Current);
    }

    private void LoadFromSettings(AppSettings settings)
    {
        foreach (var (kind, checkBox) in _widgetChecks)
            checkBox.IsChecked = settings.GetOrAddWidget(kind).Enabled;

        RadioKmh.IsChecked = settings.Units == SpeedUnit.Kmh;
        RadioMph.IsChecked = settings.Units == SpeedUnit.Mph;
        ChkUseMockData.IsChecked = settings.UseMockData;
        UpdateLockButtonText(settings.LayoutLocked);
    }

    private void UpdateLockButtonText(bool locked) =>
        BtnToggleLock.Content = locked ? "Unlock layout" : "Lock layout";

    private void OnToggleLock(object sender, RoutedEventArgs e)
    {
        var settings = _settingsService.Current;
        settings.LayoutLocked = !settings.LayoutLocked;
        _settingsService.Save(settings);
        UpdateLockButtonText(settings.LayoutLocked);
    }

    private void OnSave(object sender, RoutedEventArgs e)
    {
        var settings = _settingsService.Current;
        foreach (var (kind, checkBox) in _widgetChecks)
            settings.GetOrAddWidget(kind).Enabled = checkBox.IsChecked == true;

        settings.Units = RadioMph.IsChecked == true ? SpeedUnit.Mph : SpeedUnit.Kmh;
        settings.UseMockData = ChkUseMockData.IsChecked == true;

        _settingsService.Save(settings);
    }

    private void OnClose(object sender, RoutedEventArgs e) => Close();
}
