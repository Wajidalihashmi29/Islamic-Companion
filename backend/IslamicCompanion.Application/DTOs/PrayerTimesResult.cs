namespace IslamicCompanion.Application.DTOs;

public class PrayerTimesResult
{
    public string Date { get; set; } = string.Empty;
    public string HijriDate { get; set; } = string.Empty;
    public Dictionary<string, string> Timings { get; set; } = new();
}