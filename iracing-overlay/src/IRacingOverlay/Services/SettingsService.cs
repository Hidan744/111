using System.IO;
using System.Text.Json;
using IRacingOverlay.Models;

namespace IRacingOverlay.Services;

public sealed class SettingsService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() },
    };

    private readonly string _filePath;

    public event EventHandler<AppSettings>? SettingsChanged;

    public AppSettings Current { get; private set; }

    public SettingsService(string? filePath = null)
    {
        _filePath = filePath ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "IRacingOverlay",
            "settings.json");

        Current = Load();
    }

    public AppSettings Load()
    {
        try
        {
            if (!File.Exists(_filePath))
                return AppSettings.CreateDefault();

            var json = File.ReadAllText(_filePath);
            var loaded = JsonSerializer.Deserialize<AppSettings>(json, JsonOptions);
            return loaded ?? AppSettings.CreateDefault();
        }
        catch
        {
            // Corrupt or unreadable settings file: fall back to the default widget set rather than crash.
            return AppSettings.CreateDefault();
        }
    }

    public void Save(AppSettings settings)
    {
        Current = settings;
        try
        {
            var directory = Path.GetDirectoryName(_filePath);
            if (!string.IsNullOrEmpty(directory))
                Directory.CreateDirectory(directory);

            var json = JsonSerializer.Serialize(settings, JsonOptions);
            File.WriteAllText(_filePath, json);
        }
        catch
        {
            // Best-effort persistence; the app keeps running with the in-memory settings either way.
        }

        SettingsChanged?.Invoke(this, settings);
    }
}
