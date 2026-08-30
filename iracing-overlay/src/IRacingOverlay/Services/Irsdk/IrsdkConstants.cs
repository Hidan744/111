namespace IRacingOverlay.Services.Irsdk;

/// <summary>
/// Names and sizes of the shared-memory objects iRacing publishes while running.
/// These are part of iRacing's public SDK (irsdk_defines.h) and have been stable for years.
/// </summary>
internal static class IrsdkConstants
{
    public const string MemMapFileName = "Local\\IRSDKMemMapFileName";

    public const int MaxBufs = 4;
    public const int VarNameMaxLen = 32;
    public const int VarDescMaxLen = 64;
    public const int VarUnitMaxLen = 32;

    public const int VarHeaderSize = 4 + 4 + 4 + 4 + VarNameMaxLen + VarDescMaxLen + VarUnitMaxLen; // 144 bytes
    public const int HeaderSize = 48 + MaxBufs * 16; // 112 bytes

    public const int StatusConnected = 1; // irsdk_StatusField.irsdk_stConnected
}

internal enum IrsdkVarType
{
    Char = 0,
    Bool = 1,
    Int = 2,
    BitField = 3,
    Float = 4,
    Double = 5,
}
