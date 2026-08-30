using System.Globalization;
using System.Windows.Data;
using System.Windows.Media;

namespace IRacingOverlay.Converters;

/// <summary>
/// Placeholder track-map projection: maps LapDistPct (0..1 progress around the lap) onto a circle.
/// Bundling real per-track outlines (as in the community trackmap SVG sets referenced in the design
/// doc) is a v2 asset-loading concern; this keeps relative car order and spacing meaningful until then.
/// </summary>
public sealed class LapDistPctToXConverter : IValueConverter
{
    public const double Radius = 55;
    public const double Center = 60;

    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        var pct = value is float f ? f : 0f;
        var angle = pct * 2 * Math.PI - Math.PI / 2;
        return Center + Radius * Math.Cos(angle) - 5;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}

public sealed class LapDistPctToYConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        var pct = value is float f ? f : 0f;
        var angle = pct * 2 * Math.PI - Math.PI / 2;
        return LapDistPctToXConverter.Center + LapDistPctToXConverter.Radius * Math.Sin(angle) - 5;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}

public sealed class IsPlayerToBrushConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        var isPlayer = value is bool b && b;
        var key = isPlayer ? "AccentBrush" : "TextSecondaryBrush";
        return (Brush)System.Windows.Application.Current.Resources[key];
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}
