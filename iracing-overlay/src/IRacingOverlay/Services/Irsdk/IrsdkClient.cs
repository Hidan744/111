using System.IO.MemoryMappedFiles;
using System.Text;

namespace IRacingOverlay.Services.Irsdk;

/// <summary>
/// Minimal reader for the iRacing SDK shared-memory block. No third-party SDK wrapper is required:
/// iRacing publishes a memory-mapped file (Local\IRSDKMemMapFileName) with a fixed header, a table of
/// variable descriptors, and one or more rotating telemetry buffers. This client opens that file,
/// resolves variable offsets once, and reads a torn-free snapshot on every poll.
/// </summary>
internal sealed class IrsdkClient : IDisposable
{
    private MemoryMappedFile? _mmf;
    private MemoryMappedViewAccessor? _view;
    private readonly Dictionary<string, IrsdkVarHeader> _varHeaders = new();
    private int _lastSessionInfoUpdate = -1;
    private string _lastSessionInfoYaml = "";

    public bool IsConnected { get; private set; }

    public bool TryConnect()
    {
        if (_mmf is not null)
            return true;

        try
        {
            _mmf = MemoryMappedFile.OpenExisting(IrsdkConstants.MemMapFileName, MemoryMappedFileRights.Read);
            // Size 0 maps the view to the full length of the underlying shared-memory file, so we don't
            // depend on iRacing's total buffer size staying at any particular constant across versions.
            _view = _mmf.CreateViewAccessor(0, 0, MemoryMappedFileAccess.Read);
            return true;
        }
        catch
        {
            Disconnect();
            return false;
        }
    }

    public void Disconnect()
    {
        _view?.Dispose();
        _mmf?.Dispose();
        _view = null;
        _mmf = null;
        _varHeaders.Clear();
        IsConnected = false;
    }

    public IrsdkFrame? ReadFrame()
    {
        if (_view is null && !TryConnect())
            return null;

        try
        {
            var header = ReadHeader();
            IsConnected = header.IsConnected;
            if (!IsConnected)
                return null;

            if (_varHeaders.Count == 0 && header.NumVars > 0)
                LoadVarHeaders(header);

            var data = ReadLatestBufferTearFree(header, out header);
            if (data is null)
                return null;

            RefreshSessionInfoIfNeeded(header);

            return new IrsdkFrame(data, _varHeaders, _lastSessionInfoYaml);
        }
        catch
        {
            Disconnect();
            return null;
        }
    }

    private IrsdkHeader ReadHeader()
    {
        var buffer = new byte[IrsdkConstants.HeaderSize];
        _view!.ReadArray(0, buffer, 0, buffer.Length);
        return IrsdkHeader.Parse(buffer);
    }

    private void LoadVarHeaders(IrsdkHeader header)
    {
        var entrySize = IrsdkConstants.VarHeaderSize;
        var buffer = new byte[entrySize];
        for (int i = 0; i < header.NumVars; i++)
        {
            int entryOffset = header.VarHeaderOffset + i * entrySize;
            _view!.ReadArray(entryOffset, buffer, 0, entrySize);
            var vh = IrsdkVarHeader.Parse(buffer);
            _varHeaders[vh.Name] = vh;
        }
    }

    /// <summary>
    /// iRacing writes telemetry into a small ring of buffers while the sim runs. We pick the buffer with
    /// the highest tick count and re-check the header afterwards; if the tick count changed mid-read the
    /// data may be torn, so we retry a few times (mirrors the pattern used by iRacing's own sample client).
    /// </summary>
    private byte[]? ReadLatestBufferTearFree(IrsdkHeader header, out IrsdkHeader finalHeader)
    {
        finalHeader = header;
        for (int attempt = 0; attempt < 4; attempt++)
        {
            int bestIndex = 0;
            for (int i = 1; i < header.VarBufs.Length; i++)
                if (header.VarBufs[i].TickCount > header.VarBufs[bestIndex].TickCount)
                    bestIndex = i;

            var chosen = header.VarBufs[bestIndex];
            var data = new byte[header.BufLen];
            _view!.ReadArray(chosen.BufOffset, data, 0, data.Length);

            var afterHeader = ReadHeader();
            if (afterHeader.VarBufs[bestIndex].TickCount == chosen.TickCount)
            {
                finalHeader = afterHeader;
                return data;
            }

            header = afterHeader;
        }

        return null;
    }

    private void RefreshSessionInfoIfNeeded(IrsdkHeader header)
    {
        if (header.SessionInfoUpdate == _lastSessionInfoUpdate || header.SessionInfoLen <= 0)
            return;

        var buffer = new byte[header.SessionInfoLen];
        _view!.ReadArray(header.SessionInfoOffset, buffer, 0, buffer.Length);
        int nullIndex = Array.IndexOf(buffer, (byte)0);
        int length = nullIndex >= 0 ? nullIndex : buffer.Length;
        _lastSessionInfoYaml = Encoding.UTF8.GetString(buffer, 0, length);
        _lastSessionInfoUpdate = header.SessionInfoUpdate;
    }

    public void Dispose() => Disconnect();
}
