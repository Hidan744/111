using IRacingOverlay.Models;
using Xunit;

namespace IRacingOverlay.Tests;

public class FuelCalculatorTests
{
    [Fact]
    public void EstimateLapsRemaining_ComputesFromUsageRateAndLapTime()
    {
        // 10 L/h burn rate, 90s laps -> 0.25 L per lap. 5 L on board -> 20 laps.
        var laps = FuelCalculator.EstimateLapsRemaining(fuelLevelL: 5f, fuelUsePerHourL: 10f, lastLapTimeSec: 90f);

        Assert.Equal(20f, laps, precision: 3);
    }

    [Theory]
    [InlineData(0f, 10f, 90f)]
    [InlineData(5f, 0f, 90f)]
    [InlineData(5f, 10f, 0f)]
    [InlineData(-1f, 10f, 90f)]
    public void EstimateLapsRemaining_ReturnsZero_ForInvalidInputs(float fuel, float usePerHour, float lapTime)
    {
        Assert.Equal(0f, FuelCalculator.EstimateLapsRemaining(fuel, usePerHour, lapTime));
    }
}
