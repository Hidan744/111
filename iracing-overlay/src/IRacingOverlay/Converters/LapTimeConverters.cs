using System.Globalization;
using System.Windows.Data;
using System.Windows.Media;

namespace IRacingOverlay.Converters;

public sealed class SecondsToLapTimeConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        var seconds = value is float f ? f : 0f;
        if (seconds <= 0f || float.IsNaN(seconds) || float.IsInfinity(seconds))
            return "--:--.---";

        var minutes = (int)(seconds / 60);
        var remainder = seconds - minutes * 60;
        return $"{minutes}:{remainder:00.000}";
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}

public sealed class DeltaSecondsToTextConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        var seconds = value is float f ? f : 0f;
        var sign = seconds > 0 ? "+" : "";
        return $"{sign}{seconds:0.00}";
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}

public sealed class DeltaSecondsToBrushConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        var seconds = value is float f ? f : 0f;
        if (seconds < -0.02f)
            return GetBrush("GoodBrush");
        if (seconds > 0.02f)
            return GetBrush("DangerBrush");
        return GetBrush("TextPrimaryBrush");
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        throw new NotSupportedException();

    private static Brush GetBrush(string key) =>
        (Brush)System.Windows.Application.Current.Resources[key];
}
