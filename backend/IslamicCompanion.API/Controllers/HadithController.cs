using IslamicCompanion.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IslamicCompanion.API.Controllers;

[ApiController]
[Route("api/hadith")]
[AllowAnonymous]
public sealed class HadithController(IHadithService service, ILogger<HadithController> logger) : ControllerBase
{
    [HttpGet("books")]
    public IActionResult Books() => Ok(service.GetBooks());

    [HttpGet("browse")]
    public async Task<IActionResult> Browse(
        [FromQuery] int bookId,
        [FromQuery] int page = 1,
        CancellationToken cancellationToken = default)
    {
        try
        {
            return Ok(await service.BrowseAsync(bookId, page, cancellationToken));
        }
        catch (ArgumentException error)
        {
            return BadRequest(new { message = error.Message });
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException)
        {
            logger.LogError(error, "Dawat-e-Islami Hadith browsing request failed");
            return StatusCode(502, new { message = "The Hadith provider is unavailable. Please try again shortly." });
        }
    }

    [HttpGet("search")]
    public async Task<IActionResult> Search(
        [FromQuery] string query,
        [FromQuery] string scope = "translation",
        [FromQuery] int? bookId = null,
        [FromQuery] int page = 1,
        CancellationToken cancellationToken = default)
    {
        try
        {
            return Ok(await service.SearchAsync(query, scope, bookId, page, cancellationToken));
        }
        catch (ArgumentException error)
        {
            return BadRequest(new { message = error.Message });
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException)
        {
            logger.LogError(error, "Dawat-e-Islami Hadith request failed");
            return StatusCode(502, new { message = "The Hadith provider is unavailable. Please try again shortly." });
        }
    }
}
