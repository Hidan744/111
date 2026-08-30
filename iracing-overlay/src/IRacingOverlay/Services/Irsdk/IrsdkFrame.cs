namespace IRacingOverlay.Services.Irsdk;

/// <summary>A single consistent snapshot of the telemetry variable buffer plus the last known session YAML.</summary>
internal sealed class IrsdkFrame
{
    private readonly byte[] _data;
    private readonly IReadOnlyDictionary<string, IrsdkVarHeader> _varHeaders;

    public string SessionInfoYaml { get; }

    public IrsdkFrame(byte[] data, IReadOnlyDictionary<string, IrsdkVarHeader> varHeaders, string sessionInfoYaml)
    {
        _data = data;
        _varHeaders = varHeaders;
        SessionInfoYaml = sessionInfoYaml;
    }

    public bool HasVar(string name) => _varHeaders.ContainsKey(name);

    public float GetFloat(string name, float fallback = 0f) => GetScalar(name, fallback);

    public int GetInt(string name, int fallback = 0) => (int)GetScalar(name, fallback);

    public bool GetBool(string name, bool fallback = false) => GetScalar(name, fallback ? 1f : 0f) != 0f;

    public float[] GetFloatArray(string name)
    {
        if (!_varHeaders.TryGetValue(name, out var vh))
            return Array.Empty<float>();

        var result = new float[vh.Count];
        for (int i = 0; i < vh.Count; i++)
            result[i] = ReadElement(vh, i);
        return result;
    }

    public int[] GetIntArray(string name)
    {
        var floats = GetFloatArray(name);
        var result = new int[floats.Length];
        for (int i = 0; i < floats.Length; i++) result[i] = (int)floats[i];
        return result;
    }

    private float GetScalar(string name, float fallback)
    {
        if (!_varHeaders.TryGetValue(name, out var vh) || vh.Count < 1)
            return fallback;
        return ReadElement(vh, 0);
    }

    private float ReadElement(IrsdkVarHeader vh, int index)
    {
        int elementSize = vh.Type switch
        {
            IrsdkVarType.Char => 1,
            IrsdkVarType.Bool => 1,
            IrsdkVarType.Int => 4,
            IrsdkVarType.BitField => 4,
            IrsdkVarType.Float => 4,
            IrsdkVarType.Double => 8,
            _ => 4,
        };
        int offset = vh.Offset + index * elementSize;
        if (offset < 0 || offset + elementSize > _data.Length)
            return 0f;

        var span = _data.AsSpan(offset, elementSize);
        return vh.Type switch
        {
            IrsdkVarType.Char => span[0],
            IrsdkVarType.Bool => span[0] != 0 ? 1f : 0f,
            IrsdkVarType.Int => BitConverter.ToInt32(span),
            IrsdkVarType.BitField => BitConverter.ToInt32(span),
            IrsdkVarType.Float => BitConverter.ToSingle(span),
            IrsdkVarType.Double => (float)BitConverter.ToDouble(span),
            _ => 0f,
        };
    }
}
