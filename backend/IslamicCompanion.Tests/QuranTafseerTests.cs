using IslamicCompanion.Application.DTOs;
using IslamicCompanion.Infrastructure.ExternalServices;
using IslamicCompanion.Infrastructure.Quran;
using Microsoft.Extensions.Caching.Memory;

namespace IslamicCompanion.Tests;

public sealed class QuranTafseerTests(QuranDatasetFixture fixture) : IClassFixture<QuranDatasetFixture>
{
    private sealed class OfflineHandler : HttpMessageHandler
    {
        public int Requests { get; private set; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
        {
            Requests++;
            throw new HttpRequestException("External providers are unavailable.");
        }
    }

    [Fact]
    public async Task EveryAyahHasBundledUrduTafseerWithoutAnyExternalRequest()
    {
        var handler = new OfflineHandler();
        using var http = new HttpClient(handler);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var service = new QuranService(http, cache, fixture.Data);
        var count = 0;
        foreach (var surah in fixture.Data.Directory.Surahs)
        for (var ayah = 1; ayah <= surah.AyahCount; ayah++)
        {
            var result = await service.GetTafseerAsync(surah.Number, ayah, "sirat-ul-jinan", CancellationToken.None);
            Assert.Equal($"{surah.Number}:{ayah}", result.VerseKey);
            Assert.False(string.IsNullOrWhiteSpace(result.Text));
            Assert.Contains(result.Text, character => character >= '\u0600' && character <= '\u06ff');
            Assert.DoesNotContain("<script", result.Text, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("QuranAdmin", result.Text);
            Assert.Equal("ur", result.Language);
            count++;
        }
        Assert.Equal(6236, count);
        Assert.Equal(0, handler.Requests);
    }

    [Theory]
    [InlineData(1, 1, "al-fatihah", 0)]
    [InlineData(1, 2, "al-fatihah", 1)]
    [InlineData(1, 7, "al-fatihah", 6)]
    [InlineData(2, 286, "al-baqarah", 286)]
    [InlineData(12, 111, "yusf", 111)]
    [InlineData(36, 83, "yasin", 83)]
    [InlineData(76, 31, "ad-dahr", 31)]
    [InlineData(94, 8, "alam-nashrah", 8)]
    [InlineData(98, 8, "al-baiyinah", 8)]
    [InlineData(114, 6, "an-nas", 6)]
    public void RetainsSourceMappingAndAttribution(int surah, int ayah, string slug, int sourceAyah)
    {
        var result = fixture.Data.GetTafseer(surah, ayah, "sirat-ul-jinan");
        Assert.Equal($"https://www.dawateislami.net/quran/surah-{slug}/ayat-{sourceAyah}/translation-1/tafseer", result.SourceUrl);
        Assert.Equal("Sirat-ul-Jinan", result.Name);
        Assert.Equal("Mufti Muhammad Qasim Attari", result.Author);
    }

    [Fact]
    public void ColdRestartDoesNotNeedPreviouslyVisitedAyahsOrAWarmCache()
    {
        var restarted = new QuranDataset();
        foreach (var (surah, ayah) in new[] { (1, 1), (2, 286), (114, 6) })
            Assert.Equal(fixture.Data.GetTafseer(surah, ayah, "sirat-ul-jinan"),
                restarted.GetTafseer(surah, ayah, "sirat-ul-jinan"));
    }

    [Fact]
    public async Task RejectsInvalidVersesUnknownEditionsAndCancellationWithoutProviderAccess()
    {
        var handler = new OfflineHandler();
        using var http = new HttpClient(handler);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var service = new QuranService(http, cache, fixture.Data);
        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() =>
            service.GetTafseerAsync(1, 0, "sirat-ul-jinan", CancellationToken.None));
        await Assert.ThrowsAsync<QuranOptionException>(() =>
            service.GetTafseerAsync(1, 1, "unknown", CancellationToken.None));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            service.GetTafseerAsync(1, 1, "sirat-ul-jinan", new CancellationToken(true)));
        Assert.Equal(0, handler.Requests);
    }
}
