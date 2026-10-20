using System.Net.Http.Json;
using System.Text.Json;
using IslamicCompanion.Application.DTOs;
using IslamicCompanion.Application.Interfaces;
using Microsoft.Extensions.Caching.Memory;

namespace IslamicCompanion.Infrastructure.ExternalServices;

public class AladhanPrayerTimesService : IPrayerTimesService
{
    private readonly HttpClient _httpClient;
    private readonly IMemoryCache _cache;
    private static readonly string[] RelevantPrayers = { "Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha" };
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public AladhanPrayerTimesService(HttpClient httpClient, IMemoryCache cache)
    {
        _httpClient = httpClient;
        _cache = cache;
    }

    public async Task<PrayerTimesResult> GetByCoordinatesAsync(double latitude, double longitude, int method, int school)
    {
        var cacheKey = $"prayer:coords:{latitude:F2}:{longitude:F2}:{method}:{school}:{DateTime.UtcNow:yyyy-MM-dd}";
        var url = $"https://api.aladhan.com/v1/timings?latitude={latitude}&longitude={longitude}&method={method}&school={school}";
        return await FetchCachedAsync(cacheKey, url);
    }

    public async Task<PrayerTimesResult> GetByCityAsync(string city, string country, int method, int school)
    {
        var cacheKey = $"prayer:city:{city.ToLower()}:{country.ToLower()}:{method}:{school}:{DateTime.UtcNow:yyyy-MM-dd}";
        var url = $"https://api.aladhan.com/v1/timingsByCity?city={Uri.EscapeDataString(city)}&country={Uri.EscapeDataString(country)}&method={method}&school={school}";
        return await FetchCachedAsync(cacheKey, url);
    }

    public Task<IReadOnlyList<PrayerTimesResult>> GetMonthlyByCoordinatesAsync(
        double latitude, double longitude, int year, int month, int method, int school)
    {
        var cacheKey = $"prayer:calendar:coords:{latitude:F2}:{longitude:F2}:{year}:{month}:{method}:{school}";
        var url = $"https://api.aladhan.com/v1/calendar/{year}/{month}?latitude={latitude}&longitude={longitude}&method={method}&school={school}";
        return FetchMonthlyCachedAsync(cacheKey, url);
    }

    public Task<IReadOnlyList<PrayerTimesResult>> GetMonthlyByCityAsync(
        string city, string country, int year, int month, int method, int school)
    {
        var cacheKey = $"prayer:calendar:city:{city.ToLowerInvariant()}:{country.ToLowerInvariant()}:{year}:{month}:{method}:{school}";
        var url = $"https://api.aladhan.com/v1/calendarByCity/{year}/{month}?city={Uri.EscapeDataString(city)}&country={Uri.EscapeDataString(country)}&method={method}&school={school}";
        return FetchMonthlyCachedAsync(cacheKey, url);
    }

    private async Task<PrayerTimesResult> FetchCachedAsync(string cacheKey, string url)
    {
        var cached = await _cache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(12);

            var response = await _httpClient.GetAsync(url);
            response.EnsureSuccessStatusCode();

            var parsed = await response.Content.ReadFromJsonAsync<AladhanResponse>(JsonOptions)
                ?? throw new InvalidOperationException("Empty response from prayer times provider");

            return new PrayerTimesResult
            {
                Date = parsed.Data.Date.Readable,
                HijriDate = $"{parsed.Data.Date.Hijri.Day} {parsed.Data.Date.Hijri.Month.En} {parsed.Data.Date.Hijri.Year}",
                TimeZone = parsed.Data.Meta.Timezone,
                Timings = RelevantPrayers.ToDictionary(p => p, p => parsed.Data.Timings.GetValueOrDefault(p, "-"))
            };
        });

        return cached!;
    }

    private async Task<IReadOnlyList<PrayerTimesResult>> FetchMonthlyCachedAsync(string cacheKey, string url)
    {
        var cached = await _cache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(12);
            var response = await _httpClient.GetAsync(url);
            response.EnsureSuccessStatusCode();
            var parsed = await response.Content.ReadFromJsonAsync<AladhanCalendarResponse>(JsonOptions)
                ?? throw new InvalidOperationException("Empty response from prayer timetable provider");
            return parsed.Data.Select(ToResult).ToList();
        });
        return cached!;
    }

    private static PrayerTimesResult ToResult(AladhanData data) => new()
    {
        Date = data.Date.Readable,
        HijriDate = $"{data.Date.Hijri.Day} {data.Date.Hijri.Month.En} {data.Date.Hijri.Year}",
        TimeZone = data.Meta.Timezone,
        Timings = RelevantPrayers.ToDictionary(prayer => prayer, prayer => data.Timings.GetValueOrDefault(prayer, "-"))
    };
}