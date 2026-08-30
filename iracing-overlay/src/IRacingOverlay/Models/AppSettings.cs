using System.Linq;

namespace IRacingOverlay.Models;

public enum SpeedUnit { Kmh, Mph }

public sealed class WidgetSettings
{
    public WidgetKind Kind { get; set; }
    public bool Enabled { get; set; } = true;
    public double X { get; set; }
    public double Y { get; set; }
}

public sealed class AppSettings
{
    public bool LayoutLocked { get; set; }
    public SpeedUnit Units { get; set; } = SpeedUnit.Kmh;
    public bool UseMockData { get; set; }
    public List<WidgetSettings> Widgets { get; set; } = new();

    public static AppSettings CreateDefault()
    {
        var kinds = Enum.GetValues<WidgetKind>();
        var settings = new AppSettings();
        double x = 40, y = 40;
        foreach (var kind in kinds)
        {
            settings.Widgets.Add(new WidgetSettings { Kind = kind, Enabled = true, X = x, Y = y });
            y += 90;
        }
        return settings;
    }

    public WidgetSettings GetOrAddWidget(WidgetKind kind)
    {
        var existing = Widgets.FirstOrDefault(w => w.Kind == kind);
        if (existing is not null)
            return existing;

        var created = new WidgetSettings { Kind = kind, Enabled = true, X = 40, Y = 40 };
        Widgets.Add(created);
        return created;
    }
}
