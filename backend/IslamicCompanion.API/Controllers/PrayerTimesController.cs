using IslamicCompanion.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IslamicCompanion.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[AllowAnonymous]
public class PrayerTimesController : ControllerBase
{
    private readonly IPrayerTimesService _service;

    public PrayerTimesController(IPrayerTimesService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> GetByCoordinates([FromQuery] double latitude, [FromQuery] double longitude, [FromQuery] int method = 2, [FromQuery] int school = 0)
    {
        var result = await _service.GetByCoordinatesAsync(latitude, longitude, method, school);
        return Ok(result);
    }

    [HttpGet("by-city")]
    public async Task<IActionResult> GetByCity([FromQuery] string city, [FromQuery] string country, [FromQuery] int method = 2, [FromQuery] int school = 0)
    {
        if (string.IsNullOrWhiteSpace(city) || string.IsNullOrWhiteSpace(country))
            return BadRequest(new { message = "City and country are required" });

        var result = await _service.GetByCityAsync(city, country, method, school);
        return Ok(result);
    }

    [HttpGet("calendar")]
    public async Task<IActionResult> GetMonthlyByCoordinates(
        [FromQuery] double latitude,
        [FromQuery] double longitude,
        [FromQuery] int year,
        [FromQuery] int month,
        [FromQuery] int method = 2,
        [FromQuery] int school = 0)
    {
        if (year is < 2000 or > 2100 || month is < 1 or > 12)
            return BadRequest(new { message = "A valid timetable year and month are required" });
        return Ok(await _service.GetMonthlyByCoordinatesAsync(latitude, longitude, year, month, method, school));
    }

    [HttpGet("calendar/by-city")]
    public async Task<IActionResult> GetMonthlyByCity(
        [FromQuery] string city,
        [FromQuery] string country,
        [FromQuery] int year,
        [FromQuery] int month,
        [FromQuery] int method = 2,
        [FromQuery] int school = 0)
    {
        if (string.IsNullOrWhiteSpace(city) || string.IsNullOrWhiteSpace(country))
            return BadRequest(new { message = "City and country are required" });
        if (year is < 2000 or > 2100 || month is < 1 or > 12)
            return BadRequest(new { message = "A valid timetable year and month are required" });
        return Ok(await _service.GetMonthlyByCityAsync(city, country, year, month, method, school));
    }
}