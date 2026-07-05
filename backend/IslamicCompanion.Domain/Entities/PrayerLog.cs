namespace IslamicCompanion.Domain.Entities;

public class PrayerLog
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public ApplicationUser? User { get; set; }
    public DateOnly Date { get; set; }
    public string PrayerName { get; set; } = string.Empty; // Fajr, Dhuhr, Asr, Maghrib, Isha
    public bool Prayed { get; set; }
}