namespace IRacingOverlay.Services.Irsdk;

internal readonly struct IrsdkVarBufInfo
{
    public int TickCount { get; init; }
    public int BufOffset { get; init; }
}

internal sealed class IrsdkHeader
{
    public int Ver { get; init; }
    public int Status { get; init; }
    public int TickRate { get; init; }
    public int SessionInfoUpdate { get; init; }
    public int SessionInfoLen { get; init; }
    public int SessionInfoOffset { get; init; }
    public int NumVars { get; init; }
    public int VarHeaderOffset { get; init; }
    public int NumBuf { get; init; }
    public int BufLen { get; init; }
    public IrsdkVarBufInfo[] VarBufs { get; init; } = Array.Empty<IrsdkVarBufInfo>();

    public bool IsConnected => (Status & IrsdkConstants.StatusConnected) != 0;

    public static IrsdkHeader Parse(ReadOnlySpan<byte> buffer)
    {
        var bufs = new IrsdkVarBufInfo[IrsdkConstants.MaxBufs];
        for (int i = 0; i < IrsdkConstants.MaxBufs; i++)
        {
            int baseOffset = 48 + i * 16;
            bufs[i] = new IrsdkVarBufInfo
            {
                TickCount = BitConverter.ToInt32(buffer.Slice(baseOffset, 4)),
                BufOffset = BitConverter.ToInt32(buffer.Slice(baseOffset + 4, 4)),
            };
        }

        return new IrsdkHeader
        {
            Ver = BitConverter.ToInt32(buffer.Slice(0, 4)),
            Status = BitConverter.ToInt32(buffer.Slice(4, 4)),
            TickRate = BitConverter.ToInt32(buffer.Slice(8, 4)),
            SessionInfoUpdate = BitConverter.ToInt32(buffer.Slice(12, 4)),
            SessionInfoLen = BitConverter.ToInt32(buffer.Slice(16, 4)),
            SessionInfoOffset = BitConverter.ToInt32(buffer.Slice(20, 4)),
            NumVars = BitConverter.ToInt32(buffer.Slice(24, 4)),
            VarHeaderOffset = BitConverter.ToInt32(buffer.Slice(28, 4)),
            NumBuf = BitConverter.ToInt32(buffer.Slice(32, 4)),
            BufLen = BitConverter.ToInt32(buffer.Slice(36, 4)),
            VarBufs = bufs,
        };
    }
}

internal sealed class IrsdkVarHeader
{
    public required IrsdkVarType Type { get; init; }
    public required int Offset { get; init; }
    public required int Count { get; init; }
    public required string Name { get; init; }

    public static IrsdkVarHeader Parse(ReadOnlySpan<byte> entry)
    {
        var type = (IrsdkVarType)BitConverter.ToInt32(entry.Slice(0, 4));
        var offset = BitConverter.ToInt32(entry.Slice(4, 4));
        var count = BitConverter.ToInt32(entry.Slice(8, 4));
        var nameBytes = entry.Slice(16, IrsdkConstants.VarNameMaxLen);
        var name = ReadFixedAsciiString(nameBytes);
        return new IrsdkVarHeader { Type = type, Offset = offset, Count = count, Name = name };
    }

    private static string ReadFixedAsciiString(ReadOnlySpan<byte> bytes)
    {
        int len = bytes.IndexOf((byte)0);
        if (len < 0) len = bytes.Length;
        return System.Text.Encoding.ASCII.GetString(bytes.Slice(0, len));
    }
}
