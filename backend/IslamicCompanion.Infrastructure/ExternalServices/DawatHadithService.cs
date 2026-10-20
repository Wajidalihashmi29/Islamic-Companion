using System.Globalization;
using System.Net;
using System.Text.RegularExpressions;
using IslamicCompanion.Application.DTOs;
using IslamicCompanion.Application.Interfaces;
using Microsoft.Extensions.Caching.Memory;

namespace IslamicCompanion.Infrastructure.ExternalServices;

public sealed partial class DawatHadithService(HttpClient http, IMemoryCache cache) : IHadithService
{
    private const string SearchBase = "https://www.dawateislami.net/hadees/ur/search";
    private const string BooksBase = "https://www.dawateislami.net/hadees/ur/books";
    private static readonly IReadOnlyList<HadithBook> Books =
    [
        new() { Id = 1, Name = "مرآۃ المناجیح شرح مشکوٰۃ المصابیح" },
        new() { Id = 9, Name = "اربَعیْنِ حَنفِیَّہ" },
        new() { Id = 10, Name = "منتخب حدیثیں" },
        new() { Id = 12, Name = "فیضان ریاض الصالحین" },
        new() { Id = 13, Name = "شرح اربعین نوویہ (اردو)" },
        new() { Id = 14, Name = "اَنْوارُ الحَدِیْثْ" },
    ];

    public IReadOnlyList<HadithBook> GetBooks() => Books;

    public async Task<HadithSearchResult> BrowseAsync(
        int bookId,
        int page,
        CancellationToken cancellationToken)
    {
        if (page < 1)
            throw new ArgumentOutOfRangeException(nameof(page), "Page must be at least 1.");

        var slug = bookId switch
        {
            1 => "mishkat",
            9 => "arbaeen-e-hanfiya",
            10 => "muntakhab-hadeesen",
            12 => "faizan-e-riaz-us-saliheen",
            13 => "arbaeen-e-navavi",
            14 => "anwaar-ul-hadees",
            _ => throw new ArgumentOutOfRangeException(nameof(bookId), "The selected Hadith book is unavailable."),
        };

        return await cache.GetOrCreateAsync($"hadith:browse:{bookId}:{page}", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30);
            using var response = await http.GetAsync($"{BooksBase}/{slug}?page={page}", cancellationToken);
            response.EnsureSuccessStatusCode();
            var html = await response.Content.ReadAsStringAsync(cancellationToken);
            var result = ParseSearchResults(html);
            if (result.Items.Count > 0)
                return result;

            using var detailResponse = await http.GetAsync($"{BooksBase}/{slug}/hadees-{page}", cancellationToken);
            detailResponse.EnsureSuccessStatusCode();
            var detailHtml = await detailResponse.Content.ReadAsStringAsync(cancellationToken);
            var sourceUrl = $"{BooksBase}/{slug}/hadees-{page}";
            var bookName = Books.Single(book => book.Id == bookId).Name;
            var detail = ParseDetailResults(detailHtml, bookName, sourceUrl);
            var totalMatch = TotalHadithRegex().Match(html);
            var total = totalMatch.Success
                ? int.Parse(totalMatch.Groups["total"].Value, CultureInfo.InvariantCulture)
                : detail.TotalResults;
            detail.TotalResults = total;
            detail.HasMore = page < total;
            return detail;
        }) ?? new HadithSearchResult();
    }

    public async Task<HadithSearchResult> SearchAsync(
        string query,
        string scope,
        int? bookId,
        int page,
        CancellationToken cancellationToken)
    {
        query = query.Trim();
        if (query.Length < 2)
            throw new ArgumentException("Enter at least two characters or a Hadith number with two or more digits.", nameof(query));
        if (page < 1)
            throw new ArgumentOutOfRangeException(nameof(page), "Page must be at least 1.");
        if (bookId.HasValue && Books.All(book => book.Id != bookId.Value))
            throw new ArgumentOutOfRangeException(nameof(bookId), "The selected Hadith book is unavailable.");

        var providerScope = scope switch
        {
            "translation" => "tarjuma",
            "arabic" => "arabic",
            "number" => "number",
            _ => throw new ArgumentException("Search scope must be translation, arabic, or number.", nameof(scope)),
        };

        var url = $"{SearchBase}?q={Uri.EscapeDataString(query)}&scope={providerScope}&match=hadees&page={page}";
        if (bookId.HasValue)
            url += $"&books%5B%5D={bookId.Value}";

        var cacheKey = $"hadith:{scope}:{bookId?.ToString(CultureInfo.InvariantCulture) ?? "all"}:{page}:{query}";
        return await cache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30);
            using var response = await http.GetAsync(url, cancellationToken);
            response.EnsureSuccessStatusCode();
            var html = await response.Content.ReadAsStringAsync(cancellationToken);
            var result = ParseSearchResults(html);
            if (scope == "number" && int.TryParse(query, NumberStyles.None, CultureInfo.InvariantCulture, out var number))
            {
                var exactItems = result.Items.Where(item => item.HadithNumber == number).ToArray();
                return new HadithSearchResult { TotalResults = exactItems.Length, Items = exactItems };
            }
            return result;
        }) ?? new HadithSearchResult();
    }

    public static HadithSearchResult ParseSearchResults(string html)
    {
        var items = new List<HadithSearchItem>();
        foreach (Match blockMatch in ResultBlockRegex().Matches(html))
        {
            var block = blockMatch.Groups["body"].Value;
            var translation = ExtractParagraph(block, "withTarjuma");
            var arabic = ExtractParagraph(block, "withArabic");
            var numberMatch = HadithNumberRegex().Match(block);
            var linkMatch = SourceLinkRegex().Match(block);
            if (translation.Length == 0 || arabic.Length == 0 || !numberMatch.Success || !linkMatch.Success)
                continue;

            var headerText = CleanHtml(numberMatch.Groups["header"].Value);
            var bookName = headerText.Split('،', ',')[0].Trim();
            items.Add(new HadithSearchItem
            {
                HadithNumber = int.Parse(numberMatch.Groups["number"].Value, CultureInfo.InvariantCulture),
                BookName = bookName,
                Arabic = arabic,
                Translation = translation,
                SourceUrl = WebUtility.HtmlDecode(linkMatch.Groups["url"].Value),
            });
        }

        var totalMatch = TotalResultsRegex().Match(html);
        var total = totalMatch.Success
            ? int.Parse(totalMatch.Groups["total"].Value, CultureInfo.InvariantCulture)
            : items.Count;
        return new HadithSearchResult
        {
            TotalResults = total,
            HasMore = NextPageRegex().IsMatch(html),
            Items = items,
        };
    }

    public static HadithSearchResult ParseDetailResults(string html, string bookName, string sourceUrl)
    {
        var arabicText = ExtractParagraph(html, "withAraab");
        var translationMatch = DetailTranslationRegex().Match(html);
        var translationText = translationMatch.Success
            ? CleanHtml(translationMatch.Groups["text"].Value)
            : string.Empty;
        if (arabicText.Length == 0 || translationText.Length == 0)
            return new HadithSearchResult();

        var translations = SplitNumberedHadith(translationText);
        var numberedArabic = SplitNumberedHadith(arabicText);
        var items = numberedArabic
            .Where(entry => translations.ContainsKey(entry.Key))
            .Select(entry => new HadithSearchItem
            {
                HadithNumber = entry.Key,
                BookName = bookName,
                Arabic = entry.Value,
                Translation = translations[entry.Key],
                SourceUrl = sourceUrl,
            })
            .ToArray();
        if (items.Length == 0)
        {
            var sourceNumber = SourceHadithNumberRegex().Match(sourceUrl);
            if (sourceNumber.Success)
            {
                items =
                [
                    new HadithSearchItem
                    {
                        HadithNumber = int.Parse(sourceNumber.Groups["number"].Value, CultureInfo.InvariantCulture),
                        BookName = bookName,
                        Arabic = arabicText,
                        Translation = translationText,
                        SourceUrl = sourceUrl,
                    },
                ];
            }
        }
        return new HadithSearchResult
        {
            TotalResults = items.Length,
            Items = items,
        };
    }

    private static Dictionary<int, string> SplitNumberedHadith(string text)
    {
        var entries = new Dictionary<int, string>();
        foreach (Match match in NumberedHadithRegex().Matches(text))
        {
            var number = int.Parse(match.Groups["number"].Value, CultureInfo.InvariantCulture);
            var value = match.Groups["text"].Value.Trim();
            if (value.Length > 0)
                entries[number] = value;
        }
        return entries;
    }

    private static string ExtractParagraph(string html, string className)
    {
        var match = Regex.Match(
            html,
            $"""<p[^>]*class=["'][^"']*\b{Regex.Escape(className)}\b[^"']*["'][^>]*>(?<text>.*?)</p>""",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
        return match.Success ? CleanHtml(match.Groups["text"].Value) : string.Empty;
    }

    private static string CleanHtml(string html)
    {
        var withBreaks = BreakRegex().Replace(html, " ");
        var text = TagRegex().Replace(withBreaks, " ");
        return WhitespaceRegex().Replace(WebUtility.HtmlDecode(text), " ").Trim();
    }

    [GeneratedRegex("""<div[^>]*class=["'][^"']*\bh-detail-box\b[^"']*["'][^>]*>(?<body>.*?)</div>\s*</div>""",
        RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex ResultBlockRegex();

    [GeneratedRegex("""rel=["']next["']""", RegexOptions.IgnoreCase)]
    private static partial Regex NextPageRegex();

    [GeneratedRegex("""(?<header>[^<>]*?)،?\s*حدیث نمبر:\s*(?<number>\d+)""",
        RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex HadithNumberRegex();

    [GeneratedRegex("""<a[^>]*class=["'][^"']*\bhadees-read-btn\b[^"']*["'][^>]*href=["'](?<url>[^"']+)["']""",
        RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex SourceLinkRegex();

    [GeneratedRegex("""کے لیے\s*(?<total>\d+)\s*نتائج""", RegexOptions.IgnoreCase)]
    private static partial Regex TotalResultsRegex();

    [GeneratedRegex("""کل\s*احادیث:\s*(?:<[^>]+>\s*)*(?<total>\d+)""", RegexOptions.IgnoreCase)]
    private static partial Regex TotalHadithRegex();

    [GeneratedRegex("""<div[^>]*class=["'][^"']*\bh-detail-tarjuma\b[^"']*["'][^>]*>\s*<p[^>]*>(?<text>.*?)</p>""",
        RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex DetailTranslationRegex();

    [GeneratedRegex("""(?:ترجمہ\s*)?حدیث\s*(?<number>\d+)\s*:\s*(?<text>.*?)(?=(?:ترجمہ\s*)?حدیث\s*\d+\s*:|$)""",
        RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex NumberedHadithRegex();

    [GeneratedRegex("""/hadees-(?<number>\d+)(?:[/?#]|$)""", RegexOptions.IgnoreCase)]
    private static partial Regex SourceHadithNumberRegex();

    [GeneratedRegex("""<br\s*/?>""", RegexOptions.IgnoreCase)]
    private static partial Regex BreakRegex();

    [GeneratedRegex("<[^>]+>", RegexOptions.Singleline)]
    private static partial Regex TagRegex();

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();
}
