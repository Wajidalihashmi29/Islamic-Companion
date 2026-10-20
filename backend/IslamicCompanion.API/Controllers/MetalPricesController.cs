using IslamicCompanion.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace IslamicCompanion.API.Controllers;

[ApiController]
[Route("api/metal-prices")]
[AllowAnonymous]
public sealed class MetalPricesController(
    IMetalPriceService service,
    ILogger<MetalPricesController> logger) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string currency = "USD",
        CancellationToken cancellationToken = default)
    {
        try
        {
            return Ok(await service.GetCurrentPricesAsync(currency, cancellationToken));
        }
        catch (ArgumentException error)
        {
            return BadRequest(new { message = error.Message });
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException or JsonException)
        {
            logger.LogError(error, "Live metal price request failed");
            return StatusCode(502, new { message = "Live metal prices are unavailable. Enter prices manually or try again shortly." });
        }
    }
}
