using IslamicCompanion.Application.Interfaces;
using IslamicCompanion.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IslamicCompanion.API.Controllers;

[ApiController]
[Route("api/quran")]
[AllowAnonymous]
public sealed class QuranController(IQuranService service, ILogger<QuranController> logger) : ControllerBase
{
    [HttpGet("directory")]
    public Task<IActionResult> Directory(CancellationToken token) => Execute(() => service.GetDirectoryAsync(token));

    [HttpGet("page/{page:int}")]
    public Task<IActionResult> Page(int page, CancellationToken token,
        [FromQuery] string translation = "kanzul-iman-ur", [FromQuery] int lines = 16)
    {
        if (page is < 1 or > 604 || lines is not (15 or 16))
            return Task.FromResult<IActionResult>(BadRequest(new { message = "Page must be 1–604 and lines must be 15 or 16." }));
        return Execute(() => service.GetPageAsync(page, translation, lines, token));
    }

    [HttpGet("verse/{surah:int}/{ayah:int}/page")]
    public Task<IActionResult> VersePage(int surah, int ayah, CancellationToken token) =>
        Execute(async () => new { pageNumber = await service.GetVersePageAsync(surah, ayah, token) });

    [HttpGet("audio/{surah:int}/{ayah:int}")]
    public Task<IActionResult> Audio(int surah, int ayah, CancellationToken token, [FromQuery] string reciter = "alafasy") =>
        Execute(() => service.GetAudioAsync(surah, ayah, reciter, token));

    [HttpGet("tafseer/{surah:int}/{ayah:int}")]
    public Task<IActionResult> Tafseer(int surah, int ayah, CancellationToken token, [FromQuery] string tafseer = "sirat-ul-jinan") =>
        Execute(() => service.GetTafseerAsync(surah, ayah, tafseer, token));

    private async Task<IActionResult> Execute<T>(Func<Task<T>> action)
    {
        try { return Ok(await action()); }
        catch (QuranOptionException error) { return UnprocessableEntity(new { message = error.Message }); }
        catch (ArgumentOutOfRangeException error) { return BadRequest(new { message = error.Message }); }
        catch (InvalidDataException error)
        {
            logger.LogError(error, "Bundled Quran or Tafseer data could not be read");
            return StatusCode(500, new { message = "The bundled reading data could not be loaded. Please contact support." });
        }
        catch (Exception error) when (error is HttpRequestException or System.Text.Json.JsonException or
            InvalidOperationException or KeyNotFoundException or TaskCanceledException)
        {
            logger.LogError(error, "The Quran provider request failed");
            return StatusCode(502, new { message = "The Quran provider is unavailable. Please try again shortly." });
        }
    }
}
