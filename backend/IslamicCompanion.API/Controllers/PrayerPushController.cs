using System.Security.Claims;
using IslamicCompanion.Domain.Entities;
using IslamicCompanion.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IslamicCompanion.API.Controllers;

public record PushKeysRequest(string P256dh, string Auth);
public record SavePrayerPushRequest(
    string Endpoint,
    PushKeysRequest Keys,
    double Latitude,
    double Longitude,
    int CalculationMethod,
    int School,
    string TimeZoneId,
    IReadOnlyList<string>? PrayerNames = null);
public record RemovePrayerPushRequest(string Endpoint);
public record UpdatePrayerPushPrayersRequest(string Endpoint, IReadOnlyList<string> PrayerNames);

[ApiController]
[Route("api/prayer-push")]
public class PrayerPushController : ControllerBase
{
    private static readonly string[] SupportedPrayerNames = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
    private readonly AppDbContext _db;
    private readonly IConfiguration _configuration;

    public PrayerPushController(AppDbContext db, IConfiguration configuration)
    {
        _db = db;
        _configuration = configuration;
    }

    [AllowAnonymous]
    [HttpGet("public-key")]
    public IActionResult GetPublicKey()
    {
        var publicKey = _configuration["WebPush:PublicKey"];
        return string.IsNullOrWhiteSpace(publicKey)
            ? Problem("Prayer push notifications are not configured.", statusCode: StatusCodes.Status503ServiceUnavailable)
            : Ok(new { publicKey });
    }

    [Authorize]
    [HttpPut("subscription")]
    public async Task<IActionResult> SaveSubscription([FromBody] SavePrayerPushRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
        if (!Uri.TryCreate(request.Endpoint, UriKind.Absolute, out var endpoint) || endpoint.Scheme != Uri.UriSchemeHttps)
            return BadRequest(new { message = "A secure push endpoint is required." });
        if (request.Latitude is < -90 or > 90 || request.Longitude is < -180 or > 180)
            return BadRequest(new { message = "Valid prayer location coordinates are required." });
        if (string.IsNullOrWhiteSpace(request.Keys.P256dh) || string.IsNullOrWhiteSpace(request.Keys.Auth) ||
            string.IsNullOrWhiteSpace(request.TimeZoneId))
            return BadRequest(new { message = "Push keys and time zone are required." });
        if (!TryNormalizePrayerNames(request.PrayerNames, true, out var prayerNames))
            return BadRequest(new { message = "Prayer alert selections are invalid." });

        var subscription = await _db.PrayerPushSubscriptions.SingleOrDefaultAsync(item => item.Endpoint == request.Endpoint);
        if (subscription == null)
        {
            subscription = new PrayerPushSubscription
            {
                UserId = userId,
                Endpoint = request.Endpoint,
                P256dh = request.Keys.P256dh,
                Auth = request.Keys.Auth,
                TimeZoneId = request.TimeZoneId,
            };
            _db.PrayerPushSubscriptions.Add(subscription);
        }
        else if (subscription.UserId != userId)
        {
            return Conflict(new { message = "This browser subscription belongs to another account." });
        }

        subscription.P256dh = request.Keys.P256dh;
        subscription.Auth = request.Keys.Auth;
        subscription.Latitude = request.Latitude;
        subscription.Longitude = request.Longitude;
        subscription.CalculationMethod = request.CalculationMethod;
        subscription.School = request.School;
        subscription.TimeZoneId = request.TimeZoneId;
        subscription.PrayerNames = prayerNames;
        subscription.Enabled = true;
        subscription.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { message = "Closed-app prayer alerts are enabled." });
    }

    [Authorize]
    [HttpPatch("subscription/prayers")]
    public async Task<IActionResult> UpdatePrayerSelection([FromBody] UpdatePrayerPushPrayersRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
        if (!TryNormalizePrayerNames(request.PrayerNames, false, out var prayerNames))
            return BadRequest(new { message = "Prayer alert selections are invalid." });

        var subscription = await _db.PrayerPushSubscriptions
            .SingleOrDefaultAsync(item => item.Endpoint == request.Endpoint && item.UserId == userId);
        if (subscription == null) return NotFound(new { message = "Prayer push subscription was not found." });
        subscription.PrayerNames = prayerNames;
        subscription.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { message = "Prayer alert selection updated." });
    }

    [Authorize]
    [HttpDelete("subscription")]
    public async Task<IActionResult> RemoveSubscription([FromBody] RemovePrayerPushRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
        var subscription = await _db.PrayerPushSubscriptions
            .SingleOrDefaultAsync(item => item.Endpoint == request.Endpoint && item.UserId == userId);
        if (subscription != null)
        {
            _db.PrayerPushSubscriptions.Remove(subscription);
            await _db.SaveChangesAsync();
        }
        return NoContent();
    }

    private static bool TryNormalizePrayerNames(
        IReadOnlyList<string>? requested,
        bool defaultToAll,
        out string prayerNames)
    {
        prayerNames = string.Empty;
        if (requested == null)
        {
            if (!defaultToAll) return false;
            prayerNames = string.Join(',', SupportedPrayerNames);
            return true;
        }
        if (requested.Any(name => !SupportedPrayerNames.Contains(name, StringComparer.Ordinal)))
            return false;
        prayerNames = string.Join(',', SupportedPrayerNames.Where(requested.Contains));
        return true;
    }
}
