using Microsoft.AspNetCore.Identity;

namespace IslamicCompanion.Domain.Entities;

public class ApplicationUser : IdentityUser
{
    public string? FullName { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? PreferredCalculationMethod { get; set; }
    public string? UserSettingsJson { get; set; }
    public string? PasswordResetOtpHash { get; set; }
    public DateTime? PasswordResetOtpExpiresAt { get; set; }
    public string? PasswordResetCode { get; set; }
    public DateTime? PasswordResetCodeExpires { get; set; }
}