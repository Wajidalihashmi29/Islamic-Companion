using IslamicCompanion.Application.DTOs;
using IslamicCompanion.Application.Services;

namespace IslamicCompanion.Tests;

public class QuranPageLayoutTests
{
    private static readonly QuranSurah Surah = new(2, "البقرة", "Baqara", "madinah", 286, 40, 2);
    private static QuranSegment Verse(int ayah, string arabic, string translation) =>
        new($"2:{ayah}", ayah, 2, arabic, arabic, true, true, true, 1, 2, 2, 7, translation);

    [Fact]
    public void SplittingPreservesTextAndTranslationAndKeepsEndMarkersOnlyAtEnd()
    {
        var original = Verse(7, "ا ب ج د ہ و ز ح", "ایک دو تین چار پانچ چھ سات آٹھ");
        var lines = QuranPageLayout.Build([original], new Dictionary<int, QuranSurah> { [2] = Surah }, new HashSet<string>(), 4);
        Assert.Equal(4, lines.Count);
        Assert.Equal(original.TextIndoPak, string.Join(" ", lines.SelectMany(l => l.Segments).Select(s => s.TextIndoPak)));
        Assert.Equal(original.Translation, string.Join(" ", lines.SelectMany(l => l.Segments).Select(s => s.Translation)));
        Assert.Single(lines.SelectMany(l => l.Segments), s => s.EndsAyah);
        Assert.True(lines[^1].Segments[^1].IsRukuEnd);
        Assert.Single(lines.SelectMany(line => line.Segments), segment => segment.IsRukuEnd);
        Assert.Equal(original.RukuNumberInJuz, lines[^1].Segments[^1].RukuNumberInJuz);
        Assert.Equal(original.RukuAyahCount, lines[^1].Segments[^1].RukuAyahCount);
        Assert.True(lines[^1].Segments[^1].IsSajdah);
        Assert.All(lines.SelectMany(l => l.Segments), s => Assert.True(s.IsSajdah));
        Assert.Contains("﴿۷﴾", lines[^1].Translation);
    }

    [Fact]
    public void SurahAndJuzMetadataAppearOnlyBeforeTheOpeningRegister()
    {
        var lines = QuranPageLayout.Build([Verse(1, "ا ب ج د", "ایک دو تین چار")],
            new Dictionary<int, QuranSurah> { [2] = Surah }, new HashSet<string> { "2:1" }, 2);
        Assert.Equal(Surah, lines[0].SurahHeaderBeforeLine);
        Assert.True(lines[0].IsJuzStart);
        Assert.Null(lines[1].SurahHeaderBeforeLine);
        Assert.False(lines[1].IsJuzStart);
    }

    [Theory]
    [InlineData("3:92", 62, 62, 4)]
    [InlineData("5:82", 121, 121, 6)]
    [InlineData("5:83", 122, 122, 7)]
    [InlineData("9:93", 201, 201, 10)]
    [InlineData("9:94", 202, 202, 11)]
    [InlineData("27:59", 382, 381, 19)]
    [InlineData("27:60", 382, 382, 20)]
    [InlineData("29:44", 401, 401, 20)]
    [InlineData("29:45", 401, 402, 21)]
    [InlineData("29:46", 402, 402, 21)]
    [InlineData("36:21", 441, 441, 22)]
    [InlineData("36:22", 441, 442, 23)]
    [InlineData("36:27", 441, 442, 23)]
    [InlineData("36:28", 442, 442, 23)]
    public void ParaLabelsAndVerseNavigationUseTheSameIndoPakBoundary(string key, int sourcePage, int page, int juz)
    {
        Assert.Equal(page, QuranPagination.GetPage(key, sourcePage));
        Assert.Equal(juz, QuranPagination.GetJuz(key).Number);
    }

    [Theory]
    [InlineData(27, 381, 45, 55, 63, 60)]
    [InlineData(29, 401, 39, 45, 52, 45)]
    [InlineData(36, 441, 13, 27, 40, 22)]
    public void BoundaryPagesMoveCompleteAyahsWithoutLossDuplicationOrReordering(
        int surah, int firstPage, int firstAyah, int sourceEnd, int lastAyah, int opening)
    {
        var source = Enumerable.Range(firstAyah, lastAyah - firstAyah + 1)
            .Select(ayah => (Key: $"{surah}:{ayah}", Page: ayah <= sourceEnd ? firstPage : firstPage + 1)).ToArray();
        var pages = Enumerable.Range(firstPage, 2).Select(page => source
            .Where(verse => QuranPagination.GetSourcePages(page).Contains(verse.Page) &&
                QuranPagination.GetPage(verse.Key, verse.Page) == page)
            .Select(verse => verse.Key).ToArray()).ToArray();
        Assert.Equal(source.Select(verse => verse.Key), pages.SelectMany(page => page));
        Assert.Equal($"{surah}:{opening - 1}", pages[0][^1]);
        Assert.Equal($"{surah}:{opening}", pages[1][0]);

        var segments = pages[1].Select(key => new QuranSegment(key, int.Parse(key.Split(':')[1]), surah,
            "ا ب", "ا ب", true, false, false, 1, 1, 1, 1, "ایک دو")).ToArray();
        var lines = QuranPageLayout.Build(segments, new Dictionary<int, QuranSurah>(),
            QuranPagination.Juzs.Select(juz => juz.VerseKey).ToHashSet(), 16);
        Assert.True(lines[0].IsJuzStart);
        Assert.Single(lines, line => line.IsJuzStart);
    }
}
