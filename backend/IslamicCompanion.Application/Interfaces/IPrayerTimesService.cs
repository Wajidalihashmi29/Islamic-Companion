using IslamicCompanion.Application.DTOs;

namespace IslamicCompanion.Application.Interfaces;

public interface IPrayerTimesService
{
    Task<PrayerTimesResult> GetByCoordinatesAsync(double latitude, double longitude, int method, int school);
    Task<PrayerTimesResult> GetByCityAsync(string city, string country, int method, int school);
    Task<IReadOnlyList<PrayerTimesResult>> GetMonthlyByCoordinatesAsync(
        double latitude, double longitude, int year, int month, int method, int school);
    Task<IReadOnlyList<PrayerTimesResult>> GetMonthlyByCityAsync(
        string city, string country, int year, int month, int method, int school);
}