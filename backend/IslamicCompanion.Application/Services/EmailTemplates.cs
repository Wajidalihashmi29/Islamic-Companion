using System.Net;

namespace IslamicCompanion.Application.Services;

public static class EmailTemplates
{
   
    public static string BuildConfirmationLink(string frontendBaseUrl, string userId, string encodedToken)
    {
        var baseUrl = frontendBaseUrl.TrimEnd('/');
        return $"{baseUrl}/verify-email?userId={Uri.EscapeDataString(userId)}&token={Uri.EscapeDataString(encodedToken)}";
    }

    public static string BuildConfirmationEmail(string? fullName, string confirmUrl)
    {
        var name = WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(fullName) ? "there" : fullName.Trim());
        var url = WebUtility.HtmlEncode(confirmUrl);

        // Inline styles only — most email clients strip <style> blocks.
        return $"""
        <!doctype html>
        <html>
          <body style="margin:0;padding:0;background:#f6f1e4;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1c2b29;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:42px 16px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 26px rgba(15,61,58,0.08);">
                    <tr>
                      <td style="background:#0f3d3a;padding:26px 42px;color:#e3c878;font-size:20px;font-weight:700;letter-spacing:0.02em;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                          <tr>                            
                            <td valign="middle" style="color:#e3c878;font-size:20px;font-weight:700;letter-spacing:0.02em;">
                              Islamic Companion
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:42px;">
                        <p style="margin:0 0 16px;font-size:16px;">Assalamu Alaikum {name},</p>
                        <p style="margin:0 0 26px;font-size:15px;line-height:1.618;color:#4a5f5c;">
                          Thank you for joining Islamic Companion. Please confirm your email address to activate your account.
                        </p>
                        <p style="margin:0 0 26px;">
                          <a href="{url}" style="display:inline-block;background:#0f3d3a;color:#faf6ec;text-decoration:none;font-weight:600;padding:14px 26px;border-radius:10px;">Verify my email</a>
                        </p>
                        <p style="margin:0 0 10px;font-size:13px;color:#6b8783;">Or paste this link into your browser:</p>
                        <p style="margin:0 0 26px;font-size:12px;word-break:break-all;color:#0f3d3a;">{url}</p>
                        <p style="margin:0;font-size:13px;color:#6b8783;">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
        """;
    }
}
