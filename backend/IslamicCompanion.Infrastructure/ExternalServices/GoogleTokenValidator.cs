using Google.Apis.Auth;
using IslamicCompanion.Application.DTOs;
using IslamicCompanion.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace IslamicCompanion.Infrastructure.ExternalServices;

public sealed class GoogleTokenValidator : IGoogleTokenValidator
{
    private readonly IConfiguration _config;
    private readonly ILogger<GoogleTokenValidator> _logger;

    public GoogleTokenValidator(IConfiguration config, ILogger<GoogleTokenValidator> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task<GoogleUserInfo?> ValidateAsync(string idToken, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var clientId = _config["Google:ClientId"];
        if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(idToken))
            return null;

        try
        {
            var payload = await GoogleJsonWebSignature.ValidateAsync(
                idToken,
                new GoogleJsonWebSignature.ValidationSettings
                {
                    Audience = [clientId]
                });

            if (string.IsNullOrWhiteSpace(payload.Email))
                return null;

            return new GoogleUserInfo(
                payload.Subject,
                payload.Email,
                payload.Name,
                payload.EmailVerified);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Google ID token validation failed");
            return null;
        }
    }
}
