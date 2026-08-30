namespace IRacingOverlay.Models;

public static class FuelCalculator
{
    /// <summary>
    /// Estimates how many more laps the current fuel load will last, using the car's
    /// reported average consumption rate (FuelUsePerHour) and the last completed lap time
    /// as the best available estimate of lap duration.
    /// </summary>
    public static float EstimateLapsRemaining(float fuelLevelL, float fuelUsePerHourL, float lastLapTimeSec)
    {
        if (fuelLevelL <= 0f || fuelUsePerHourL <= 0f || lastLapTimeSec <= 0f)
            return 0f;

        var fuelPerLapL = fuelUsePerHourL * (lastLapTimeSec / 3600f);
        if (fuelPerLapL <= 0f)
            return 0f;

        return fuelLevelL / fuelPerLapL;
    }
}
