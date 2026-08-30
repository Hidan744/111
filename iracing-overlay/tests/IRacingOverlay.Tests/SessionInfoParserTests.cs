using IRacingOverlay.Services;
using Xunit;

namespace IRacingOverlay.Tests;

public class SessionInfoParserTests
{
    private const string SampleYaml = """
        WeekendInfo:
         TrackDisplayName: Road Atlanta
        DriverInfo:
         Drivers:
         - CarIdx: 0
           UserName: Alice Racer
           CarNumber: '12'
           CarClassID: 1
           IsSpectator: 0
         - CarIdx: 1
           UserName: Pace Car
           CarNumber: '00'
           CarClassID: 1
           IsSpectator: 1
        """;

    [Fact]
    public void Parse_ExtractsTrackNameAndNonSpectatorDrivers()
    {
        var info = SessionInfoParser.Parse(SampleYaml);

        Assert.Equal("Road Atlanta", info.TrackDisplayName);
        Assert.Equal(2, info.Drivers.Count);
        Assert.Contains(info.Drivers, d => d.UserName == "Alice Racer" && d.CarNumber == "12" && !d.IsSpectator);
        Assert.Contains(info.Drivers, d => d.UserName == "Pace Car" && d.IsSpectator);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not: [valid, yaml: structure")]
    public void Parse_ReturnsEmpty_ForMissingOrMalformedInput(string yaml)
    {
        var info = SessionInfoParser.Parse(yaml);

        Assert.Equal(SessionInfo.Empty, info);
    }
}
