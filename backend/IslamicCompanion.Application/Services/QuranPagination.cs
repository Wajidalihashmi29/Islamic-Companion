using IslamicCompanion.Application.DTOs;

namespace IslamicCompanion.Application.Services;

public static class QuranPagination
{
    // Indo-Pak Para openings differ from the providers' Madani Juz divisions.
    private static readonly (string Name, string Key, int SourcePage)[] Openings =
    [
        ("الم", "1:1", 1), ("سَيَقُولُ", "2:142", 22), ("تِلْكَ الرُّسُلُ", "2:253", 42),
        ("لَنْ تَنَالُوا", "3:92", 62), ("وَالْمُحْصَنَاتُ", "4:24", 82),
        ("لَا يُحِبُّ اللّٰهُ", "4:148", 102), ("وَإِذَا سَمِعُوا", "5:83", 122),
        ("وَلَوْ أَنَّنَا", "6:111", 142), ("قَالَ الْمَلَأُ", "7:88", 162),
        ("وَاعْلَمُوا", "8:41", 182), ("يَعْتَذِرُونَ", "9:94", 202),
        ("وَمَا مِنْ دَابَّةٍ", "11:6", 222), ("وَمَا أُبَرِّئُ", "12:53", 242),
        ("رُبَمَا", "15:1", 262), ("سُبْحَانَ الَّذِي", "17:1", 282),
        ("قَالَ أَلَمْ", "18:75", 302), ("اقْتَرَبَ", "21:1", 322),
        ("قَدْ أَفْلَحَ", "23:1", 342), ("وَقَالَ الَّذِينَ", "25:21", 362),
        ("أَمَّنْ خَلَقَ", "27:60", 382), ("اتْلُ مَا أُوحِيَ", "29:45", 401),
        ("وَمَنْ يَقْنُتْ", "33:31", 422), ("وَمَا لِيَ", "36:22", 441),
        ("فَمَنْ أَظْلَمُ", "39:32", 462), ("إِلَيْهِ يُرَدُّ", "41:47", 482),
        ("حم", "46:1", 502), ("قَالَ فَمَا خَطْبُكُمْ", "51:31", 522),
        ("قَدْ سَمِعَ", "58:1", 542), ("تَبَارَكَ الَّذِي", "67:1", 562),
        ("عَمَّ", "78:1", 582)
    ];

    public static IReadOnlyList<QuranJuz> Juzs { get; } = Openings
        .Select((opening, index) => new QuranJuz(index + 1, opening.Name, opening.Key)).ToArray();

    private static int StartPage(int index) => index == 0 ? 1 : index * 20 + 2;
    private static (int Surah, int Ayah) Verse(string key)
    {
        var parts = key.Split(':');
        return (int.Parse(parts[0]), int.Parse(parts[1]));
    }

    public static QuranJuz GetJuz(string verseKey) =>
        Juzs.Last(juz => Verse(verseKey).CompareTo(Verse(juz.VerseKey)) >= 0);

    public static int GetPage(string verseKey, int sourcePage)
    {
        for (var index = 0; index < Openings.Length; index++)
        {
            var opening = Openings[index];
            if (opening.SourcePage == sourcePage)
                return Verse(verseKey).CompareTo(Verse(opening.Key)) < 0
                    ? StartPage(index) - 1 : StartPage(index);
        }
        return sourcePage;
    }

    public static IReadOnlyList<int> GetSourcePages(int page)
    {
        var sources = new SortedSet<int> { page };
        for (var index = 0; index < Openings.Length; index++)
            if (page == StartPage(index) || page == StartPage(index) - 1)
                sources.Add(Openings[index].SourcePage);
        return sources.ToArray();
    }
}
