namespace IslamicCompanion.Infrastructure.Quran;

internal static class SiratUlJinan
{
    // Canonical slugs from the official site's Surah directory, not transliterations of our display names.
    private static readonly string[] Surahs = (
        "al-fatihah al-baqarah al-imran an-nisa al-maidah al-anam al-araf al-anfal al-taubah yunus hud yusf " +
        "ar-rad ibrahim al-hijr an-nahl al-isra al-kahf maryam taha al-anbiya al-hajj al-muminun an-nur " +
        "al-furqan ash-shuara an-naml al-qasas al-ankabut ar-rum luqman as-sajdah al-ahzab saba fatir yasin " +
        "as-saffat sad az-zumar ghafir fussilat ash-shura az-zukhruf ad-dukhan al-jasia al-ahqaf muhammad " +
        "al-fath al-hujurat qaf az-zariyat at-tur an-najm al-qamar ar-rahman al-waqiah al-hadid al-mujadilah " +
        "al-hashr al-mumtahinah as-saff al-jumuah al-munafiqun at-taghabun at-talaq at-tahrim al-mulk al-qalam " +
        "al-haqqah al-maarij nuh al-jin al-muzzammil al-mudassir al-qiyamah ad-dahr al-mursalat an-naba " +
        "an-naziat abasa at-takwir al-infitar al-mutaffifin al-inshiqaq al-buruj at-tariq al-ala al-ghashiyah " +
        "al-fajr al-balad ash-shams al-lail ad-duha alam-nashrah at-tin al-alaq al-qadr al-baiyinah az-zilzal " +
        "al-adiyat al-qariah at-takasur al-asr al-humazah al-fil quraish al-maun al-kausar al-kafiroon " +
        "an-nasr al-lahab al-ikhlas al-falaq an-nas").Split(' ');

    public static string SourceUrl(int surah, int ayah)
    {
        // Our Fatihah counts Bismillah as 1:1; the provider labels it ayat-0.
        var sourceAyah = surah == 1 ? ayah - 1 : ayah;
        return $"https://www.dawateislami.net/quran/surah-{Surahs[surah - 1]}/ayat-{sourceAyah}/translation-1/tafseer";
    }

}
