namespace IslamicCompanion.Domain.Entities;

public class Favorite
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public ApplicationUser? User { get; set; }
    public string ItemType { get; set; } = string.Empty; // "Verse", "Dua", "Hadith"
    public string ItemReference { get; set; } = string.Empty; // e.g. "2:255" for a verse
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;
}