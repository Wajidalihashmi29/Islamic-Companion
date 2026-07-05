using Microsoft.AspNetCore.Identity;

namespace IslamicCompanion.Domain.Entities;

public class ApplicationUser : IdentityUser
{
    public string? FullName { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? PreferredCalculationMethod { get; set; }
}