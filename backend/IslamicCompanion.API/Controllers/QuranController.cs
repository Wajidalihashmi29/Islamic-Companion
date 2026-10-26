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

    [HttpGet("pdf/{script}/{juz:int}")]
    public async Task<IActionResult> GetPdfJuz(
        string script,
        int juz,
        [FromQuery] bool refresh,
        [FromServices] IHttpClientFactory httpClientFactory,
        CancellationToken token)
    {
        if (juz is < 1 or > 30) return BadRequest(new { message = "Juz must be between 1 and 30." });

        bool isMadina = string.Equals(script, "madina", StringComparison.OrdinalIgnoreCase);
        string url = isMadina
            ? $"https://islamicstudies.info/quran/mushaf/Quran-Al-Madina-Juz-{juz}.pdf"
            : $"https://islamicstudies.info/quran/juz/{juz}.pdf";

        var cacheDir = Path.Combine(AppContext.BaseDirectory, "QuranPdfs", isMadina ? "madina" : "indopak");
        System.IO.Directory.CreateDirectory(cacheDir);
        var filePath = Path.Combine(cacheDir, $"{juz}.pdf");

        if (!refresh && System.IO.File.Exists(filePath) && new FileInfo(filePath).Length > 50000)
        {
            var stream = System.IO.File.OpenRead(filePath);
            return File(stream, "application/pdf");
        }

        try
        {
            var client = httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromMinutes(3);
            client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
            var response = await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, token);
            if (!response.IsSuccessStatusCode)
                return StatusCode((int)response.StatusCode, new { message = "Failed to fetch PDF from IslamicStudies." });

            var tempPath = filePath + ".tmp";
            await using (var remoteStream = await response.Content.ReadAsStreamAsync(token))
            await using (var fileStream = System.IO.File.Create(tempPath))
            {
                await remoteStream.CopyToAsync(fileStream, token);
            }

            if (System.IO.File.Exists(tempPath) && new FileInfo(tempPath).Length > 50000)
            {
                System.IO.File.Move(tempPath, filePath, overwrite: true);
            }

            var returnStream = System.IO.File.OpenRead(filePath);
            return File(returnStream, "application/pdf");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to download Quran PDF for Juz {Juz} ({Script})", juz, script);
            return StatusCode(502, new { message = "Unable to fetch Quran PDF. Please try again." });
        }
    }

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
