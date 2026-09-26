namespace IslamicCompanion.Application.Services;

public static class EmailConfirmationHelper
{
    public static string BuildConfirmationLink(string frontendBaseUrl, string userId, string token)
    {
        var baseUrl = string.IsNullOrWhiteSpace(frontendBaseUrl)
            ? "http://localhost:5173"
            : frontendBaseUrl.TrimEnd('/');

        return $"{baseUrl}/verify-email?userId={Uri.EscapeDataString(userId)}&token={Uri.EscapeDataString(token)}";
    }

    public static string BuildConfirmationEmail(string? fullName, string confirmUrl)
    {
        var greeting = string.IsNullOrWhiteSpace(fullName) ? "Peace be upon you" : $"Peace be upon you, {fullName}";

        return $"""
            <html>
              <body style="font-family: Georgia, serif; color: #1c2b29; background: #faf6ec; padding: 32px;">
                <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid rgba(15,61,58,0.14);">
                  <h1 style="font-size: 22px; color: #0f3d3a; margin: 0 0 12px;">Islamic Companion</h1>
                  <p style="margin: 0 0 16px; line-height: 1.6;">{greeting},</p>
                  <p style="margin: 0 0 24px; line-height: 1.6;">Please confirm your email address to finish creating your account.</p>
                  <p style="margin: 0 0 24px;">
                    <a href="{confirmUrl}" style="display: inline-block; background: #0f3d3a; color: #faf6ec; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-family: sans-serif;">
                      Verify email
                    </a>
                  </p>
                  <p style="margin: 0; font-size: 13px; color: #6b8783; line-height: 1.6;">
                    If you did not create this account, you can ignore this message. This link expires in 24 hours.
                  </p>
                </div>
              </body>
            </html>
            """;
    }
}
