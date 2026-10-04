using System.Net;
using System.Net.Mail;
using IslamicCompanion.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace IslamicCompanion.Infrastructure.ExternalServices;

/// <summary>
/// Sends email via SMTP using settings from the "Smtp" configuration section.
/// When no SMTP host is configured (typical in local development), the email
/// is written to the log instead so the verification link can still be used.
/// </summary>
public class SmtpEmailSender : IEmailSender
{
    private readonly IConfiguration _config;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(IConfiguration config, ILogger<SmtpEmailSender> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task SendAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        var smtp = _config.GetSection("Smtp");
        var host = smtp["Host"];

        if (string.IsNullOrWhiteSpace(host))
        {
            _logger.LogWarning(
                "SMTP is not configured. Email to {Email} with subject '{Subject}' was not sent. Body:\n{Body}",
                toEmail, subject, htmlBody);
            return;
        }

        var port = int.TryParse(smtp["Port"], out var p) ? p : 587;
        var enableSsl = !bool.TryParse(smtp["EnableSsl"], out var ssl) || ssl;
        var username = smtp["Username"];
        var password = smtp["Password"];
        var fromEmail = smtp["FromEmail"] ?? username ?? "no-reply@islamiccompanion.app";
        var fromName = smtp["FromName"] ?? "Islamic Companion";

        using var message = new MailMessage
        {
            From = new MailAddress(fromEmail, fromName),
            Subject = subject,
            Body = htmlBody,
            IsBodyHtml = true
        };
        message.To.Add(toEmail);

        using var client = new SmtpClient(host, port)
        {
            EnableSsl = enableSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network
        };

        if (!string.IsNullOrWhiteSpace(username))
            client.Credentials = new NetworkCredential(username, password);

        await client.SendMailAsync(message, cancellationToken);
    }
}
