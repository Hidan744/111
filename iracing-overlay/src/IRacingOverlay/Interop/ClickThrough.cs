using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;

namespace IRacingOverlay.Interop;

/// <summary>
/// Toggles WS_EX_TRANSPARENT/WS_EX_LAYERED on a WPF window so it either passes all mouse input through
/// to iRacing (locked layout) or accepts it for dragging widgets around (unlocked/edit mode).
/// </summary>
internal static class ClickThrough
{
    private const int GWL_EXSTYLE = -20;
    private const int WS_EX_TRANSPARENT = 0x00000020;
    private const int WS_EX_LAYERED = 0x00080000;
    private const int WS_EX_TOOLWINDOW = 0x00000080;

    [DllImport("user32.dll", SetLastError = true)]
    private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll")]
    private static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

    public static void SetClickThrough(Window window, bool clickThrough)
    {
        var helper = new WindowInteropHelper(window);
        var handle = helper.Handle;
        if (handle == IntPtr.Zero)
            return;

        var style = GetWindowLong(handle, GWL_EXSTYLE);
        style |= WS_EX_LAYERED | WS_EX_TOOLWINDOW;
        style = clickThrough ? style | WS_EX_TRANSPARENT : style & ~WS_EX_TRANSPARENT;
        SetWindowLong(handle, GWL_EXSTYLE, style);
    }
}
