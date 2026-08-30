using System.IO;
using IRacingOverlay.Models;
using IRacingOverlay.Services;
using Xunit;

namespace IRacingOverlay.Tests;

public class SettingsServiceTests : IDisposable
{
    private readonly string _tempFile = Path.Combine(Path.GetTempPath(), $"iro-settings-{Guid.NewGuid():N}.json");

    [Fact]
    public void SaveThenLoad_RoundTripsWidgetPositionsAndFlags()
    {
        var service = new SettingsService(_tempFile);
        var settings = AppSettings.CreateDefault();
        settings.LayoutLocked = true;
        settings.Units = SpeedUnit.Mph;
        settings.GetOrAddWidget(WidgetKind.Speed).X = 123.5;
        settings.GetOrAddWidget(WidgetKind.Speed).Y = 456.5;
        settings.GetOrAddWidget(WidgetKind.Fuel).Enabled = false;

        service.Save(settings);

        var reloaded = new SettingsService(_tempFile).Current;
        Assert.True(reloaded.LayoutLocked);
        Assert.Equal(SpeedUnit.Mph, reloaded.Units);
        Assert.Equal(123.5, reloaded.GetOrAddWidget(WidgetKind.Speed).X);
        Assert.Equal(456.5, reloaded.GetOrAddWidget(WidgetKind.Speed).Y);
        Assert.False(reloaded.GetOrAddWidget(WidgetKind.Fuel).Enabled);
    }

    [Fact]
    public void Load_FallsBackToDefaults_WhenFileIsCorrupt()
    {
        File.WriteAllText(_tempFile, "{ this is not valid json ");

        var settings = new SettingsService(_tempFile).Current;

        var defaults = AppSettings.CreateDefault();
        Assert.Equal(defaults.Widgets.Count, settings.Widgets.Count);
        Assert.All(settings.Widgets, w => Assert.True(w.Enabled));
    }

    [Fact]
    public void Load_ReturnsDefaults_WhenFileMissing()
    {
        var settings = new SettingsService(_tempFile).Current;

        Assert.Equal(AppSettings.CreateDefault().Widgets.Count, settings.Widgets.Count);
    }

    public void Dispose()
    {
        if (File.Exists(_tempFile))
            File.Delete(_tempFile);
    }
}
