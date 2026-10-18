using System.Text;
using System.Text.Json;
using System.Xml.Linq;
using IslamicCompanion.Application.DTOs;
using IslamicCompanion.Infrastructure.ExternalServices;
using IslamicCompanion.Infrastructure.Quran;
using Microsoft.Extensions.Caching.Memory;

namespace IslamicCompanion.Tests;

public sealed class QuranDatasetFixture
{
    public QuranDataset Data { get; } = new();
}

public sealed class QuranDatasetTests(QuranDatasetFixture fixture) : IClassFixture<QuranDatasetFixture>
{
    private sealed class OfflineHandler : HttpMessageHandler
    {
        public int Requests { get; private set; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
        {
            Requests++;
            throw new HttpRequestException("Provider access is blocked for this test.");
        }
    }

    [Theory]
    [InlineData("kanzul-iman-ur", "ur.kanzuliman.txt", 15)]
    [InlineData("kanzul-iman-en", "en.ahmedraza.txt", 15)]
    [InlineData("irfan-ul-quran-ur", "ur.qadri.txt", 15)]
    [InlineData("kanzul-iman-ur", "ur.kanzuliman.txt", 16)]
    [InlineData("kanzul-iman-en", "en.ahmedraza.txt", 16)]
    [InlineData("irfan-ul-quran-ur", "ur.qadri.txt", 16)]
    public async Task AllPagesPreserveEverySourceAyahAndSelectedTranslationWithoutProviderAccess(
        string edition, string sourceFile, int registers)
    {
        var handler = new OfflineHandler();
        using var http = new HttpClient(handler);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var service = new QuranService(http, cache, fixture.Data);
        var directory = await service.GetDirectoryAsync(CancellationToken.None);
        var expected = directory.Surahs.SelectMany(surah =>
            Enumerable.Range(1, surah.AyahCount).Select(ayah => $"{surah.Number}:{ayah}")).ToArray();
        var segments = new List<QuranSegment>();
        var openings = new List<(string Key, int Page)>();
        for (var number = 1; number <= 604; number++)
        {
            var page = await service.GetPageAsync(number, edition, registers, CancellationToken.None);
            var rows = page.Lines.SelectMany(line => line.Segments).ToArray();
            Assert.NotEmpty(rows);
            Assert.False(string.IsNullOrWhiteSpace(page.BismillahTranslation));
            foreach (var verse in rows.Select(row => row.VerseKey).Distinct())
            {
                var parts = verse.Split(':').Select(int.Parse).ToArray();
                Assert.Equal(number, await service.GetVersePageAsync(parts[0], parts[1], CancellationToken.None));
            }
            openings.AddRange(page.Lines.Where(line => line.IsJuzStart).Select(line => (line.Segments[0].VerseKey, number)));
            segments.AddRange(rows);
        }
        Assert.Equal(expected, segments.Where(segment => segment.EndsAyah).Select(segment => segment.VerseKey));
        Assert.Equal(directory.Juzs.Select(juz => juz.VerseKey), openings.Select(opening => opening.Key));
        Assert.Equal(Enumerable.Range(0, 30).Select(index => index == 0 ? 1 : index * 20 + 2),
            openings.Select(opening => opening.Page));

        var translations = SourceText(sourceFile).Split('\n').Select(line => line.TrimEnd('\r'))
            .Where(line => line.Length > 0 && !line.StartsWith('#')).Select(line => line.Split('|', 3))
            .ToDictionary(parts => $"{parts[0]}:{parts[1]}", parts => parts[2]);
        using var indoPakJson = JsonDocument.Parse(SourceText("indopak.json"));
        var indoPak = indoPakJson.RootElement.GetProperty("verses").EnumerateArray()
            .ToDictionary(verse => verse.GetProperty("verse_key").GetString()!, verse => verse.GetProperty("text_indopak").GetString()!);
        var uthmani = XDocument.Parse(SourceText("uthmani.xml")).Root!.Elements("sura").SelectMany(surah =>
            surah.Elements("aya").Select(ayah => (Key: $"{surah.Attribute("index")!.Value}:{ayah.Attribute("index")!.Value}",
                Text: ayah.Attribute("text")!.Value))).ToDictionary(verse => verse.Key, verse => verse.Text);
        foreach (var verse in segments.GroupBy(segment => segment.VerseKey))
        {
            Assert.Equal(Normalize(indoPak[verse.Key]), Normalize(string.Join(" ", verse.Select(segment => segment.TextIndoPak))));
            Assert.Equal(Normalize(uthmani[verse.Key]), Normalize(string.Join(" ", verse.Select(segment => segment.TextUthmani))));
            Assert.Equal(Normalize(translations[verse.Key]), Normalize(string.Join(" ", verse.Select(segment => segment.Translation))));
        }
        Assert.Equal(0, handler.Requests);
    }

    [Fact]
    public async Task FreshDatasetAndEmptyCacheCanReadUnvisitedPagesAfterRestart()
    {
        using var http = new HttpClient(new OfflineHandler());
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var first = new QuranService(http, cache, fixture.Data);
        var before = await first.GetPageAsync(442, "kanzul-iman-ur", 16, CancellationToken.None);
        using var restartedCache = new MemoryCache(new MemoryCacheOptions());
        var restarted = new QuranService(http, restartedCache, new QuranDataset());
        Assert.Equal(JsonSerializer.Serialize(before), JsonSerializer.Serialize(
            await restarted.GetPageAsync(442, "kanzul-iman-ur", 16, CancellationToken.None)));
        Assert.NotEmpty((await restarted.GetPageAsync(73, "irfan-ul-quran-ur", 15, CancellationToken.None)).Lines);
    }

    [Theory]
    [InlineData("kanzul-iman-hi")]
    [InlineData("farooq-khan-hi")]
    [InlineData("jalandhari-ur")]
    [InlineData("unknown")]
    public void UnavailableEditionsNeverReturnAnotherTranslation(string edition)
    {
        Assert.Throws<QuranOptionException>(() => fixture.Data.GetPage(1, edition, 16));
    }

    [Theory]
    [InlineData(1, 7, 1, 1, 7)]
    [InlineData(2, 7, 1, 2, 7)]
    [InlineData(2, 147, 17, 1, 6)]
    [InlineData(36, 32, 2, 1, 20)]
    [InlineData(36, 50, 3, 2, 18)]
    [InlineData(37, 21, 1, 5, 21)]
    public void RukuMarksUseSurahAndIndoPakParaCountsIncludingAParaStartingInsideARuku(
        int surah, int ayah, int inSurah, int inPara, int ayahCount)
    {
        var page = fixture.Data.GetPage(fixture.Data.GetVersePage(surah, ayah), "kanzul-iman-ur", 16);
        var end = Assert.Single(page.Lines.SelectMany(line => line.Segments),
            segment => segment.VerseKey == $"{surah}:{ayah}" && segment.IsRukuEnd);
        Assert.Equal(inSurah, end.RukuNumberInSurah);
        Assert.Equal(inPara, end.RukuNumberInJuz);
        Assert.Equal(ayahCount, end.RukuAyahCount);
    }

    [Fact]
    public void RukuCountersResetInEveryParaAndSurahAndTheirAyahCountsCoverTheWholeQuran()
    {
        var pages = Enumerable.Range(1, 604).Select(number => fixture.Data.GetPage(number, "kanzul-iman-ur", 16)).ToArray();
        foreach (var para in pages.GroupBy(page => page.JuzNumber))
        {
            var ends = para.SelectMany(page => page.Lines).SelectMany(line => line.Segments)
                .Where(segment => segment.IsRukuEnd).ToArray();
            Assert.Equal(Enumerable.Range(1, ends.Length), ends.Select(end => end.RukuNumberInJuz));
        }
        var markers = pages.SelectMany(page => page.Lines).SelectMany(line => line.Segments)
            .Where(segment => segment.IsRukuEnd).ToArray();
        foreach (var surah in fixture.Data.Directory.Surahs)
        {
            var ends = markers.Where(end => end.SurahNumber == surah.Number).ToArray();
            Assert.Equal(Enumerable.Range(1, surah.RukuCount), ends.Select(end => end.RukuNumberInSurah));
            Assert.Equal(surah.AyahCount, ends.Sum(end => end.RukuAyahCount));
        }
    }

    [Fact]
    public async Task TafseerUnavailabilityAndAudioOutagesDoNotBlockLocalReading()
    {
        var handler = new OfflineHandler();
        using var http = new HttpClient(handler);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var service = new QuranService(http, cache, fixture.Data);
        await Assert.ThrowsAsync<QuranOptionException>(() =>
            service.GetTafseerAsync(1, 1, "khazain-ul-irfan", CancellationToken.None));
        await Assert.ThrowsAsync<QuranOptionException>(() =>
            service.GetTafseerAsync(1, 1, "ibn-kathir", CancellationToken.None));
        Assert.Equal(0, handler.Requests);
        await Assert.ThrowsAsync<HttpRequestException>(() =>
            service.GetAudioAsync(1, 1, "alafasy", CancellationToken.None));
        Assert.Equal(1, handler.Requests);
        Assert.NotEmpty((await service.GetPageAsync(604, "kanzul-iman-en", 16, CancellationToken.None)).Lines);
    }

    [Theory]
    [InlineData(0, 1)]
    [InlineData(115, 1)]
    [InlineData(33, 0)]
    [InlineData(33, 74)]
    public void InvalidAyahsAreRejectedLocally(int surah, int ayah)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => fixture.Data.GetVersePage(surah, ayah));
    }

    private static string Normalize(string text) =>
        string.Join(" ", text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

    private static string SourceText(string file)
    {
        using var stream = typeof(QuranDataset).Assembly.GetManifestResourceStream("QuranData." + file)!;
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return reader.ReadToEnd();
    }
}
