using IslamicCompanion.Infrastructure.ExternalServices;

namespace IslamicCompanion.Tests;

public class DawatHadithServiceTests
{
    [Fact]
    public void ParsesArabicTranslationNumberBookAndSourceFromSearchResults()
    {
        const string html = """
            <h2>"نیت" کے لیے 1 نتائج</h2>
            <div class="h-detail-box">
              <div class="h-detail-hadees">
                <p class="withTarjuma"><span>اعمال کا دارومدار نیتوں پر ہے۔</span></p>
                <p class="withArabic"><span>إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ</span></p>
              </div>
              <div class="h-detail-header">
                <p>مرآۃ المناجیح، حدیث نمبر:1</p>
                <a class="hadees-read-btn" href="https://www.dawateislami.net/hadees/ur/books/example/hadees-1">شرح پڑھیں</a>
              </div>
            </div>
            """;

        var result = DawatHadithService.ParseSearchResults(html);

        var hadith = Assert.Single(result.Items);
        Assert.Equal(1, result.TotalResults);
        Assert.Equal(1, hadith.HadithNumber);
        Assert.Equal("مرآۃ المناجیح", hadith.BookName);
        Assert.Contains("الْأَعْمَالُ", hadith.Arabic);
        Assert.Contains("نیتوں", hadith.Translation);
        Assert.EndsWith("/hadees-1", hadith.SourceUrl);
    }

    [Fact]
    public void ParserKeepsDistinctNumbersForExactFiltering()
    {
        const string html = """
            <div class="h-detail-box"><div class="h-detail-hadees">
            <p class="withTarjuma">بارہ</p><p class="withArabic">اثنا عشر</p></div>
            <div class="h-detail-header"><p>کتاب، حدیث نمبر:12</p>
            <a class="hadees-read-btn" href="https://example.com/12">Source</a></div></div>
            <div class="h-detail-box"><div class="h-detail-hadees">
            <p class="withTarjuma">ایک سو بارہ</p><p class="withArabic">مائة واثنا عشر</p></div>
            <div class="h-detail-header"><p>کتاب، حدیث نمبر:112</p>
            <a class="hadees-read-btn" href="https://example.com/112">Source</a></div></div>
            <a href="?page=2" rel="next">Next</a>
            """;

        var result = DawatHadithService.ParseSearchResults(html);

        Assert.Equal([12, 112], result.Items.Select(item => item.HadithNumber));
        Assert.True(result.HasMore);
    }

    [Fact]
    public void ParsesMultipleHadithFromHierarchicalBookDetailPage()
    {
        const string html = """
            <div class="h-detail-box">
              <div class="h-detail-hadees h-detail-hadees-arabic">
                <p class="withAraab"><span>حدیث 1:<br />عربی اول<br />حدیث 2:<br />عربی دوم</span></p>
              </div>
            </div>
            <div class="h-detail-box">
              <div class="h-detail-tarjuma">
                <p><span>ترجمہ حدیث 1:</span><span>ترجمہ اول</span><span>ترجمہ حدیث 2:</span><span>ترجمہ دوم</span></p>
              </div>
            </div>
            """;

        var result = DawatHadithService.ParseDetailResults(
            html,
            "اَنْوارُ الحَدِیْثْ",
            "https://www.dawateislami.net/hadees/ur/books/anwaar-ul-hadees/hadees-1");

        Assert.Equal(2, result.TotalResults);
        Assert.Equal([1, 2], result.Items.Select(item => item.HadithNumber));
        Assert.Equal("عربی دوم", result.Items[1].Arabic);
        Assert.Equal("ترجمہ دوم", result.Items[1].Translation);
        Assert.All(result.Items, item => Assert.Equal("اَنْوارُ الحَدِیْثْ", item.BookName));
    }

    [Fact]
    public void UsesDetailPageNumberWhenThePageContainsOneUnlabelledHadith()
    {
        const string html = """
            <p class="withAraab"><span>عربی متن</span></p>
            <div class="h-detail-tarjuma"><p><span>اردو ترجمہ</span></p></div>
            """;

        var result = DawatHadithService.ParseDetailResults(
            html,
            "مرآۃ المناجیح شرح مشکوٰۃ المصابیح",
            "https://www.dawateislami.net/hadees/ur/books/mishkat/hadees-25");

        var hadith = Assert.Single(result.Items);
        Assert.Equal(25, hadith.HadithNumber);
        Assert.Equal("عربی متن", hadith.Arabic);
        Assert.Equal("اردو ترجمہ", hadith.Translation);
    }
}
