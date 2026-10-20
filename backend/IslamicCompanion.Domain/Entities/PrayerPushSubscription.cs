namespace IslamicCompanion.Domain.Entities;

public class PrayerPushSubscription
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string UserId { get; set; }
    public ApplicationUser? User { get; set; }
    public required string Endpoint { get; set; }
    public required string P256dh { get; set; }
    public required string Auth { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public int CalculationMethod { get; set; } = 1;
    public int School { get; set; } = 1;
    public required string TimeZoneId { get; set; }
    public string PrayerNames { get; set; } = "Fajr,Dhuhr,Asr,Maghrib,Isha";
    public bool Enabled { get; set; } = true;
    public string? LastNotificationKey { get; set; }
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
