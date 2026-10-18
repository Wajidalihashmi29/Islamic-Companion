using System.Text.Json;
using IslamicCompanion.Application.DTOs;
using IslamicCompanion.Application.Interfaces;
using IslamicCompanion.Infrastructure.Quran;
using Microsoft.Extensions.Caching.Memory;

namespace IslamicCompanion.Infrastructure.ExternalServices;

public sealed class QuranService(HttpClient http, IMemoryCache cache, QuranDataset data) : IQuranService
{
    private const string QuranApi = "https://api.quran.com/api/v4";
    private static readonly Dictionary<string, int> Reciters = new()
    {
        ["alafasy"] = 7, ["abdul-basit"] = 2, ["husary"] = 6, ["minshawi"] = 9, ["shuraim"] = 10
    };

    private async Task<JsonElement> Fetch(string url, CancellationToken token)
    {
        using var response = await http.GetAsync(url, token);
        response.EnsureSuccessStatusCode();
        using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(token),
            cancellationToken: token);
        return json.RootElement.Clone();
    }

    private async Task<T> Cached<T>(string key, Func<Task<T>> fetch) where T : class =>
        await cache.GetOrCreateAsync("quran:" + key, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(12);
            return await fetch();
        }) ?? throw new InvalidOperationException("The Quran provider returned no data.");

    public Task<QuranDirectory> GetDirectoryAsync(CancellationToken token)
    {
        token.ThrowIfCancellationRequested();
        return Task.FromResult(data.Directory);
    }

    public Task<QuranPage> GetPageAsync(int page, string translation, int lines, CancellationToken token)
    {
        token.ThrowIfCancellationRequested();
        return Task.FromResult(data.GetPage(page, translation, lines));
    }

    public Task<int> GetVersePageAsync(int surah, int ayah, CancellationToken token)
    {
        token.ThrowIfCancellationRequested();
        return Task.FromResult(data.GetVersePage(surah, ayah));
    }

    public async Task<QuranAudio> GetAudioAsync(int surah, int ayah, string reciter, CancellationToken token)
    {
        if (!Reciters.TryGetValue(reciter, out var id)) throw new QuranOptionException("This reciter is not available.");
        data.ValidateVerse(surah, ayah);
        return await Cached($"audio:{reciter}:{surah}:{ayah}", async () =>
        {
            var response = await Fetch($"{QuranApi}/recitations/{id}/by_ayah/{surah}:{ayah}", token);
            var audio = response.GetProperty("audio_files").EnumerateArray()
                .Single(item => item.GetProperty("verse_key").GetString() == $"{surah}:{ayah}");
            var source = audio.GetProperty("url").GetString()!;
            var url = new Uri(new Uri("https://verses.quran.com/"), source);
            if (url.Scheme != "https" || url.Host != "verses.quran.com")
                throw new InvalidOperationException("The audio provider returned an untrusted address.");
            return new QuranAudio($"{surah}:{ayah}", url.AbsoluteUri);
        });
    }

    public Task<QuranTafseer> GetTafseerAsync(int surah, int ayah, string tafseer, CancellationToken token)
    {
        token.ThrowIfCancellationRequested();
        return Task.FromResult(data.GetTafseer(surah, ayah, tafseer));
    }
}
