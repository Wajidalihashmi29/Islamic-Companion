using System.Globalization;
using IslamicCompanion.Application.DTOs;

namespace IslamicCompanion.Application.Services;

public static class QuranPageLayout
{
    public static string Digits(int value) => string.Concat(value.ToString(CultureInfo.InvariantCulture)
        .Select(digit => (char)('\u06F0' + digit - '0')));

    public static IReadOnlyList<QuranLine> Build(IReadOnlyList<QuranSegment> verses,
        IReadOnlyDictionary<int, QuranSurah> surahs, IReadOnlySet<string> juzStarts, int count)
    {
        var totalWords = verses.Sum(verse => verse.TextIndoPak.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length);
        var target = Math.Max(1, (int)Math.Ceiling((double)totalWords / count));
        var result = new List<QuranLine>();
        var row = new List<QuranSegment>();
        QuranSurah? header = null;
        var juzStart = false;
        var used = 0;
        void Flush()
        {
            if (row.Count == 0) return;
            result.Add(new QuranLine(result.Count + 1, string.Join(" ", row.Select(s => s.TextIndoPak)),
                string.Join(" ", row.Select(s => s.Translation + (s.EndsAyah ? $" ﴿{Digits(s.VerseNumberInSurah)}﴾" : ""))),
                header, juzStart, row.ToArray()));
            row.Clear();
            header = null;
            juzStart = false;
            used = 0;
        }
        foreach (var verse in verses)
        {
            if (verse.VerseNumberInSurah == 1 || juzStarts.Contains(verse.VerseKey)) Flush();
            if (verse.VerseNumberInSurah == 1) header = surahs[verse.SurahNumber];
            juzStart |= juzStarts.Contains(verse.VerseKey);
            var words = verse.TextIndoPak.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var uthmani = verse.TextUthmani.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var translation = verse.Translation.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            for (var index = 0; index < words.Length;)
            {
                var take = Math.Min(words.Length - index, target - used);
                var end = index + take;
                var isEnd = end == words.Length && verse.EndsAyah;
                var translationStart = index * translation.Length / words.Length;
                var translationEnd = end * translation.Length / words.Length;
                row.Add(verse with
                {
                    TextIndoPak = string.Join(" ", words[index..end]),
                    TextUthmani = string.Join(" ", uthmani[(index * uthmani.Length / words.Length)..(end * uthmani.Length / words.Length)]),
                    Translation = string.Join(" ", translation[translationStart..translationEnd]),
                    EndsAyah = isEnd,
                    IsRukuEnd = isEnd && verse.IsRukuEnd,
                    IsSajdah = verse.IsSajdah
                });
                index = end;
                used += take;
                if (used >= target) Flush();
            }
        }
        Flush();
        return result;
    }
}
