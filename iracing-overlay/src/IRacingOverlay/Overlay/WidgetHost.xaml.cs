using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using IRacingOverlay.Models;

namespace IRacingOverlay.Overlay;

/// <summary>Draggable wrapper placed on the overlay Canvas for each widget. Dragging is only possible
/// while the layout is unlocked, since a locked overlay is click-through and never receives mouse input.</summary>
public partial class WidgetHost : ContentControl
{
    public static readonly DependencyProperty IsEditableProperty =
        DependencyProperty.Register(nameof(IsEditable), typeof(bool), typeof(WidgetHost), new PropertyMetadata(false, OnIsEditableChanged));

    public bool IsEditable
    {
        get => (bool)GetValue(IsEditableProperty);
        set => SetValue(IsEditableProperty, value);
    }

    public WidgetKind Kind { get; init; }

    public event EventHandler<(double X, double Y)>? PositionChanged;

    private Point _dragStart;
    private bool _dragging;

    public WidgetHost()
    {
        InitializeComponent();
        MouseLeftButtonDown += OnMouseDown;
        MouseLeftButtonUp += OnMouseUp;
        MouseMove += OnMouseMove;
    }

    private static void OnIsEditableChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is not WidgetHost host)
            return;

        host.ApplyTemplate();
        if (host.Template.FindName("EditBorder", host) is not Border border)
            return;
        border.BorderThickness = (bool)e.NewValue ? new Thickness(1.5) : new Thickness(0);
        host.Cursor = (bool)e.NewValue ? Cursors.SizeAll : Cursors.Arrow;
    }

    private void OnMouseDown(object sender, MouseButtonEventArgs e)
    {
        if (!IsEditable)
            return;
        _dragging = true;
        _dragStart = e.GetPosition(Parent as UIElement);
        CaptureMouse();
        e.Handled = true;
    }

    private void OnMouseMove(object sender, MouseEventArgs e)
    {
        if (!_dragging || !IsEditable)
            return;

        var current = e.GetPosition(Parent as UIElement);
        var newLeft = Canvas.GetLeft(this) + (current.X - _dragStart.X);
        var newTop = Canvas.GetTop(this) + (current.Y - _dragStart.Y);
        Canvas.SetLeft(this, newLeft);
        Canvas.SetTop(this, newTop);
        _dragStart = current;
    }

    private void OnMouseUp(object sender, MouseButtonEventArgs e)
    {
        if (!_dragging)
            return;
        _dragging = false;
        ReleaseMouseCapture();
        PositionChanged?.Invoke(this, (Canvas.GetLeft(this), Canvas.GetTop(this)));
    }
}
