namespace IslamicCompanion.Application.DTOs;

public sealed class MetalPriceResult
{
    public string Currency { get; set; } = string.Empty;
    public decimal GoldPerGram { get; set; }
    public decimal SilverPerGram { get; set; }
    public decimal GoldPerOunceUsd { get; set; }
    public decimal SilverPerOunceUsd { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public string Source { get; set; } = string.Empty;
}
