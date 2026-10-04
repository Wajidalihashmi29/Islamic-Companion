using IslamicCompanion.Application.Interfaces;
using IslamicCompanion.Application.Services;
using IslamicCompanion.Domain.Entities;
using IslamicCompanion.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace IslamicCompanion.API.Controllers;

public record RegisterRequest(string Email, string Password, string FullName);
public record LoginRequest(string Email, string Password);
public record RefreshRequest(string RefreshToken);
public record ConfirmEmailRequest(string UserId, string Token);
public record ResendConfirmationRequest(string Email);
public record GoogleSignInRequest(string IdToken);
public record AuthResponse(string Token, string RefreshToken, DateTime ExpiresAt, string FullName);

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("AuthPolicy")]
public class AuthController : ControllerBase
{
    private const string GoogleProvider = "Google";

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IConfiguration _config;
    private readonly AppDbContext _db;
    private readonly IEmailSender _emailSender;
    private readonly IGoogleTokenValidator _googleTokenValidator;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        IConfiguration config,
        AppDbContext db,
        IEmailSender emailSender,
        IGoogleTokenValidator googleTokenValidator,
        ILogger<AuthController> logger)
    {
        _userManager = userManager;
        _config = config;
        _db = db;
        _emailSender = emailSender;
        _googleTokenValidator = googleTokenValidator;
        _logger = logger;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var user = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            FullName = request.FullName,
            EmailConfirmed = false
        };

        var result = await _userManager.CreateAsync(user, request.Password);

        if (!result.Succeeded)
            return BadRequest(result.Errors);

        await SendConfirmationEmailAsync(user);

        return Ok(new
        {
            message = "Account created. Check your inbox to verify your email address.",
            requiresEmailConfirmation = true
        });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user == null || !await _userManager.CheckPasswordAsync(user, request.Password))
            return Unauthorized(new { message = "Invalid credentials" });

        // Checked only after the password, so this doesn't reveal which emails are registered.
        if (!user.EmailConfirmed)
            return Unauthorized(new
            {
                message = "Please verify your email before signing in.",
                code = "email_not_confirmed"
            });

        var response = await IssueTokensAsync(user);
        return Ok(response);
    }

    [HttpPost("confirm-email")]
    public async Task<IActionResult> ConfirmEmail(ConfirmEmailRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.UserId) || string.IsNullOrWhiteSpace(request.Token))
            return BadRequest(new { message = "This verification link is incomplete." });

        var user = await _userManager.FindByIdAsync(request.UserId);
        if (user == null)
            return BadRequest(new { message = "This verification link is invalid or has expired." });

        if (user.EmailConfirmed)
            return Ok(new { message = "Your email is already verified. You can sign in." });

        var decodedToken = DecodeToken(request.Token);
        if (decodedToken == null)
            return BadRequest(new { message = "This verification link is invalid or has expired." });

        var result = await _userManager.ConfirmEmailAsync(user, decodedToken);
        if (!result.Succeeded)
            return BadRequest(new { message = "This verification link is invalid or has expired." });

        return Ok(new { message = "Email verified. You can now sign in." });
    }

    [HttpPost("resend-confirmation")]
    public async Task<IActionResult> ResendConfirmation(ResendConfirmationRequest request)
    {
        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            var user = await _userManager.FindByEmailAsync(request.Email);
            if (user != null && !user.EmailConfirmed)
                await SendConfirmationEmailAsync(user);
        }

        // Same response either way to avoid leaking which emails exist.
        return Ok(new { message = "If an unverified account exists for that email, a new link is on its way." });
    }

    [HttpPost("google")]
    public async Task<IActionResult> GoogleSignIn(GoogleSignInRequest request)
    {
        var googleUser = await _googleTokenValidator.ValidateAsync(request.IdToken);
        if (googleUser == null)
            return Unauthorized(new { message = "We couldn't verify your Google sign-in. Please try again." });

        if (!googleUser.EmailVerified || string.IsNullOrWhiteSpace(googleUser.Email))
            return Unauthorized(new { message = "Your Google account email isn't verified." });

        var loginInfo = new UserLoginInfo(GoogleProvider, googleUser.Subject, GoogleProvider);
        var user = await _userManager.FindByLoginAsync(loginInfo.LoginProvider, loginInfo.ProviderKey);

        if (user == null)
        {
            user = await _userManager.FindByEmailAsync(googleUser.Email);

            if (user == null)
            {
                user = new ApplicationUser
                {
                    UserName = googleUser.Email,
                    Email = googleUser.Email,
                    FullName = googleUser.Name,
                    EmailConfirmed = true // Google has already verified ownership
                };

                var createResult = await _userManager.CreateAsync(user);
                if (!createResult.Succeeded)
                    return BadRequest(createResult.Errors);
            }
            else if (!user.EmailConfirmed)
            {
                // Someone registered this email with a password but never verified it.
                // The Google user has now proven ownership, so drop the unverified password
                // to prevent a pre-registration account takeover, then mark verified.
                if (await _userManager.HasPasswordAsync(user))
                    await _userManager.RemovePasswordAsync(user);

                user.EmailConfirmed = true;
                if (string.IsNullOrWhiteSpace(user.FullName))
                    user.FullName = googleUser.Name;
                await _userManager.UpdateAsync(user);
            }

            var addLogin = await _userManager.AddLoginAsync(user, loginInfo);
            if (!addLogin.Succeeded && addLogin.Errors.All(e => e.Code != "LoginAlreadyAssociated"))
                return BadRequest(addLogin.Errors);
        }

        var response = await IssueTokensAsync(user);
        return Ok(response);
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh(RefreshRequest request)
    {
        var existing = await _db.RefreshTokens
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Token == request.RefreshToken);

        if (existing == null || existing.IsRevoked || existing.ExpiresAt < DateTime.UtcNow)
            return Unauthorized(new { message = "Session expired. Please log in again." });

        existing.IsRevoked = true; // one-time use — rotate on every refresh
        var response = await IssueTokensAsync(existing.User!);
        return Ok(response);
    }

    private async Task SendConfirmationEmailAsync(ApplicationUser user)
    {
        var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
        var frontendBaseUrl = _config["Frontend:BaseUrl"] ?? "http://localhost:5173";
        var confirmUrl = EmailTemplates.BuildConfirmationLink(frontendBaseUrl, user.Id, encodedToken);
        var body = EmailTemplates.BuildConfirmationEmail(user.FullName, confirmUrl);

        try
        {
            await _emailSender.SendAsync(user.Email!, "Verify your Islamic Companion email", body);
        }
        catch (Exception ex)
        {
            // Don't fail registration if the mail server hiccups — the user can resend.
            _logger.LogError(ex, "Failed to send confirmation email to {Email}", user.Email);
        }
    }

    private static string? DecodeToken(string token)
    {
        try
        {
            return Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(token));
        }
        catch (FormatException)
        {
            return null;
        }
    }

    private async Task<AuthResponse> IssueTokensAsync(ApplicationUser user)
    {
        var accessExpiryMinutes = double.Parse(_config["Jwt:AccessTokenExpiryMinutes"]!);
        var refreshExpiryDays = double.Parse(_config["Jwt:RefreshTokenExpiryDays"]!);
        var expiresAt = DateTime.UtcNow.AddMinutes(accessExpiryMinutes);

        var accessToken = GenerateJwtToken(user, expiresAt);
        var refreshToken = GenerateRefreshToken();

        _db.RefreshTokens.Add(new RefreshToken
        {
            Token = refreshToken,
            UserId = user.Id,
            ExpiresAt = DateTime.UtcNow.AddDays(refreshExpiryDays)
        });
        await _db.SaveChangesAsync();

        return new AuthResponse(accessToken, refreshToken, expiresAt, user.FullName ?? "");
    }

    private string GenerateJwtToken(ApplicationUser user, DateTime expiresAt)
    {
        var jwtSettings = _config.GetSection("Jwt");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings["Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Email, user.Email!),
            new(ClaimTypes.Name, user.FullName ?? "")
        };

        var token = new JwtSecurityToken(
            issuer: jwtSettings["Issuer"],
            audience: jwtSettings["Audience"],
            claims: claims,
            expires: expiresAt,
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string GenerateRefreshToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(bytes);
    }
}