using System.Net;
using System.Text.Json;
using IslamicCompanion.Application.Interfaces;
using IslamicCompanion.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using WebPush;

namespace IslamicCompanion.API.Services;

public sealed class PrayerPushScheduler : BackgroundService
{
    private static readonly string[] PrayerNames = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<PrayerPushScheduler> _logger;

    public PrayerPushScheduler(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        ILogger<PrayerPushScheduler> logger)
    {
        _scopeFactory = scopeFactory;
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));
        do
        {
            try { await SendDueNotifications(stoppingToken); }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                _logger.LogError(exception, "Prayer push scheduling cycle failed.");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task SendDueNotifications(CancellationToken cancellationToken)
    {
        var publicKey = _configuration["WebPush:PublicKey"];
        var privateKey = _configuration["WebPush:PrivateKey"];
        var subject = _configuration["WebPush:Subject"];
        if (string.IsNullOrWhiteSpace(publicKey) || string.IsNullOrWhiteSpace(privateKey) || string.IsNullOrWhiteSpace(subject))
            return;

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var prayerTimes = scope.ServiceProvider.GetRequiredService<IPrayerTimesService>();
        var subscriptions = await db.PrayerPushSubscriptions.Where(item => item.Enabled).ToListAsync(cancellationToken);
        var client = new WebPushClient();
        var vapid = new VapidDetails(subject, publicKey, privateKey);

        foreach (var stored in subscriptions)
        {
            var selectedPrayers = stored.PrayerNames
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .ToHashSet(StringComparer.Ordinal);
            if (selectedPrayers.Count == 0) continue;
            var localNow = GetLocalTime(stored.TimeZoneId);
            var result = await prayerTimes.GetByCoordinatesAsync(
                stored.Latitude, stored.Longitude, stored.CalculationMethod, stored.School);
            var duePrayer = PrayerNames.Where(selectedPrayers.Contains).FirstOrDefault(name =>
                result.Timings.TryGetValue(name, out var value) && IsCurrentMinute(value, localNow));
            if (duePrayer == null) continue;

            var notificationKey = $"{localNow:yyyy-MM-dd}:{duePrayer}";
            if (stored.LastNotificationKey == notificationKey) continue;
            var payload = JsonSerializer.Serialize(new
            {
                title = $"{duePrayer} prayer time",
                body = $"{duePrayer} has begun for your saved location.",
                url = "/prayer",
                tag = $"prayer-{duePrayer.ToLowerInvariant()}-{localNow:yyyy-MM-dd}",
            });

            try
            {
                await client.SendNotificationAsync(
                    new PushSubscription(stored.Endpoint, stored.P256dh, stored.Auth),
                    payload,
                    vapid,
                    cancellationToken);
                stored.LastNotificationKey = notificationKey;
            }
            catch (WebPushException exception) when (exception.StatusCode is HttpStatusCode.Gone or HttpStatusCode.NotFound)
            {
                db.PrayerPushSubscriptions.Remove(stored);
            }
            catch (WebPushException exception)
            {
                _logger.LogWarning(exception, "Prayer push delivery failed for subscription {SubscriptionId}.", stored.Id);
            }
        }
        await db.SaveChangesAsync(cancellationToken);
    }

    private static DateTime GetLocalTime(string timeZoneId)
    {
        try { return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById(timeZoneId)); }
        catch (TimeZoneNotFoundException) { return DateTime.UtcNow; }
        catch (InvalidTimeZoneException) { return DateTime.UtcNow; }
    }

    private static bool IsCurrentMinute(string value, DateTime localNow)
    {
        var clean = value.Split(' ', '(', StringSplitOptions.RemoveEmptyEntries)[0];
        return TimeOnly.TryParse(clean, out var time) && time.Hour == localNow.Hour && time.Minute == localNow.Minute;
    }
}
