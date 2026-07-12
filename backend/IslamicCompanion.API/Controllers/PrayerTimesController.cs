using IslamicCompanion.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IslamicCompanion.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PrayerTimesController : ControllerBase
{
    private readonly IPrayerTimesService _service;

    public PrayerTimesController(IPrayerTimesService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> GetByCoordinates([FromQuery] double latitude, [FromQuery] double longitude, [FromQuery] int method = 2)
    {
        var result = await _service.GetByCoordinatesAsync(latitude, longitude, method);
        return Ok(result);
    }

    [HttpGet("by-city")]
    public async Task<IActionResult> GetByCity([FromQuery] string city, [FromQuery] string country, [FromQuery] int method = 2)
    {
        if (string.IsNullOrWhiteSpace(city) || string.IsNullOrWhiteSpace(country))
            return BadRequest(new { message = "City and country are required" });

        var result = await _service.GetByCityAsync(city, country, method);
        return Ok(result);
    }
}