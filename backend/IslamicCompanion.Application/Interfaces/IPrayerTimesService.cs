using IslamicCompanion.Application.DTOs;

namespace IslamicCompanion.Application.Interfaces;

public interface IPrayerTimesService
{
    Task<PrayerTimesResult> GetByCoordinatesAsync(double latitude, double longitude, int method, int school);
    Task<PrayerTimesResult> GetByCityAsync(string city, string country, int method, int school);
}