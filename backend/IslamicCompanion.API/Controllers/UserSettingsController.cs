using IslamicCompanion.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text.Json;

namespace IslamicCompanion.API.Controllers;

public class UpdateSettingsRequest
{
    public JsonElement? Settings { get; set; }
    public string? SettingsJson { get; set; }
}

[Authorize]
[ApiController]
[Route("api/user/settings")]
public class UserSettingsController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ILogger<UserSettingsController> _logger;

    public UserSettingsController(
        UserManager<ApplicationUser> userManager,
        ILogger<UserSettingsController> logger)
    {
        _userManager = userManager;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetSettings()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null)
            return NotFound(new { message = "User not found" });

        return Ok(new
        {
            settingsJson = user.UserSettingsJson
        });
    }

    [HttpPut]
    public async Task<IActionResult> UpdateSettings([FromBody] UpdateSettingsRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null)
            return NotFound(new { message = "User not found" });

        string? serialized = null;
        if (!string.IsNullOrEmpty(request.SettingsJson))
        {
            serialized = request.SettingsJson;
        }
        else if (request.Settings.HasValue && request.Settings.Value.ValueKind != JsonValueKind.Undefined && request.Settings.Value.ValueKind != JsonValueKind.Null)
        {
            serialized = request.Settings.Value.GetRawText();
        }

        user.UserSettingsJson = serialized;
        var result = await _userManager.UpdateAsync(user);

        if (!result.Succeeded)
        {
            _logger.LogWarning("Failed to update user settings for {UserId}: {Errors}", userId, string.Join(", ", result.Errors.Select(e => e.Description)));
            return BadRequest(result.Errors);
        }

        return Ok(new
        {
            message = "Settings synchronized successfully",
            syncedAt = DateTime.UtcNow
        });
    }
}
