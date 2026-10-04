using IslamicCompanion.Application.DTOs;

namespace IslamicCompanion.Application.Interfaces;

public interface IGoogleTokenValidator
{
    /// <summary>
    /// Validates a Google ID token (JWT from Google Identity Services).
    /// Returns null when the token is invalid, expired, or issued for a different client.
    /// </summary>
    Task<GoogleUserInfo?> ValidateAsync(string idToken);
}
