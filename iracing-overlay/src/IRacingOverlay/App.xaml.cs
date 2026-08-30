using System.Windows;
using IRacingOverlay.Overlay;
using IRacingOverlay.Services;
using IRacingOverlay.Settings;
using IRacingOverlay.ViewModel;

namespace IRacingOverlay;

public partial class App : Application
{
    private SettingsService _settingsService = null!;
    private ITelemetryService _telemetryService = null!;
    private TelemetryViewModel _viewModel = null!;
    private OverlayWindow _overlayWindow = null!;
    private SettingsWindow? _settingsWindow;
    private System.Windows.Forms.NotifyIcon? _trayIcon;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        ShutdownMode = ShutdownMode.OnExplicitShutdown;

        _settingsService = new SettingsService();
        _viewModel = new TelemetryViewModel(Dispatcher);
        _viewModel.Units = _settingsService.Current.Units;

        _telemetryService = CreateTelemetryService(_settingsService.Current.UseMockData);
        _viewModel.Attach(_telemetryService);
        _telemetryService.Start();

        _overlayWindow = new OverlayWindow(_viewModel, _settingsService);
        _overlayWindow.Show();

        SetupTrayIcon();
        OpenSettingsWindow();
    }

    private static ITelemetryService CreateTelemetryService(bool useMock) =>
        useMock ? new MockTelemetryService() : new IRacingTelemetryService();

    private void SetupTrayIcon()
    {
        _trayIcon = new System.Windows.Forms.NotifyIcon
        {
            Icon = System.Drawing.SystemIcons.Application,
            Visible = true,
            Text = "iRacing Overlay",
        };

        var menu = new System.Windows.Forms.ContextMenuStrip();
        menu.Items.Add("Settings", null, (_, _) => OpenSettingsWindow());
        menu.Items.Add("Lock / Unlock layout", null, (_, _) => _overlayWindow.ToggleLayoutLock());
        menu.Items.Add(new System.Windows.Forms.ToolStripSeparator());
        menu.Items.Add("Exit", null, (_, _) => ShutdownApp());
        _trayIcon.ContextMenuStrip = menu;
        _trayIcon.DoubleClick += (_, _) => OpenSettingsWindow();
    }

    private void OpenSettingsWindow()
    {
        if (_settingsWindow is { IsVisible: true })
        {
            _settingsWindow.Activate();
            return;
        }

        _settingsWindow = new SettingsWindow(_settingsService);
        _settingsWindow.Show();
    }

    private void ShutdownApp()
    {
        _trayIcon!.Visible = false;
        _trayIcon.Dispose();
        _telemetryService.Dispose();
        Shutdown();
    }
}
