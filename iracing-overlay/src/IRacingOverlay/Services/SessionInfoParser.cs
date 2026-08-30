using System.IO;
using YamlDotNet.RepresentationModel;

namespace IRacingOverlay.Services;

public sealed record SessionDriver(int CarIdx, string UserName, string CarNumber, int CarClassId, bool IsSpectator);

public sealed record SessionInfo(string TrackDisplayName, IReadOnlyList<SessionDriver> Drivers)
{
    public static readonly SessionInfo Empty = new("", Array.Empty<SessionDriver>());
}

/// <summary>
/// iRacing exposes race-weekend metadata (track name, driver roster) as a YAML document alongside the
/// telemetry buffer. The document is large and changes shape between session types, so we only pull the
/// handful of fields the overlay widgets need and fail soft (empty result) on anything unexpected.
/// </summary>
public static class SessionInfoParser
{
    public static SessionInfo Parse(string yaml)
    {
        if (string.IsNullOrWhiteSpace(yaml))
            return SessionInfo.Empty;

        try
        {
            var stream = new YamlStream();
            stream.Load(new StringReader(yaml));
            if (stream.Documents.Count == 0)
                return SessionInfo.Empty;

            var root = (YamlMappingNode)stream.Documents[0].RootNode;

            var trackName = TryGetNested(root, "WeekendInfo", "TrackDisplayName") ?? "";

            var drivers = new List<SessionDriver>();
            if (TryGetMapping(root, "DriverInfo", out var driverInfo) &&
                driverInfo.Children.TryGetValue(new YamlScalarNode("Drivers"), out var driversNode) &&
                driversNode is YamlSequenceNode driverSeq)
            {
                foreach (var entry in driverSeq.Children)
                {
                    if (entry is not YamlMappingNode driverMap)
                        continue;

                    var carIdx = GetInt(driverMap, "CarIdx");
                    var userName = GetString(driverMap, "UserName") ?? $"Car {carIdx}";
                    var carNumber = GetString(driverMap, "CarNumber") ?? "";
                    var carClassId = GetInt(driverMap, "CarClassID");
                    var isSpectator = GetInt(driverMap, "IsSpectator") == 1;

                    drivers.Add(new SessionDriver(carIdx, userName, carNumber, carClassId, isSpectator));
                }
            }

            return new SessionInfo(trackName, drivers);
        }
        catch
        {
            return SessionInfo.Empty;
        }
    }

    private static bool TryGetMapping(YamlMappingNode root, string key, out YamlMappingNode result)
    {
        if (root.Children.TryGetValue(new YamlScalarNode(key), out var node) && node is YamlMappingNode mapping)
        {
            result = mapping;
            return true;
        }
        result = new YamlMappingNode();
        return false;
    }

    private static string? TryGetNested(YamlMappingNode root, string parentKey, string childKey)
    {
        if (!TryGetMapping(root, parentKey, out var parent))
            return null;
        return GetString(parent, childKey);
    }

    private static string? GetString(YamlMappingNode map, string key)
    {
        if (map.Children.TryGetValue(new YamlScalarNode(key), out var node) && node is YamlScalarNode scalar)
            return scalar.Value;
        return null;
    }

    private static int GetInt(YamlMappingNode map, string key)
    {
        var value = GetString(map, key);
        return int.TryParse(value, out var result) ? result : 0;
    }
}
