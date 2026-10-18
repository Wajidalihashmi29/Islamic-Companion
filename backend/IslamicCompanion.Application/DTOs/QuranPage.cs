namespace IslamicCompanion.Application.DTOs;

public sealed record QuranSurah(int Number, string NameArabic, string Name, string RevelationPlace,
    int AyahCount, int RukuCount, int StartPage);
public sealed record QuranJuz(int Number, string NameArabic, string VerseKey);
public sealed record QuranDirectory(IReadOnlyList<QuranSurah> Surahs, IReadOnlyList<QuranJuz> Juzs);
public sealed record QuranSegment(string VerseKey, int VerseNumberInSurah, int SurahNumber,
    string TextIndoPak, string TextUthmani, bool EndsAyah, bool IsSajdah, bool IsRukuEnd,
    int RukuNumberInSurah, int RukuNumberOverall, int RukuNumberInJuz, int RukuAyahCount, string Translation);
public sealed record QuranLine(int LineNumber, string TextIndoPak, string Translation,
    QuranSurah? SurahHeaderBeforeLine, bool IsJuzStart, IReadOnlyList<QuranSegment> Segments);
public sealed record QuranPage(int PageNumber, int JuzNumber, string JuzNameArabic, int ManzilNumber,
    string TranslationLanguage, string BismillahTranslation, IReadOnlyList<QuranLine> Lines);
public sealed record QuranAudio(string VerseKey, string Url);
public sealed record QuranTafseer(string VerseKey, string Name, string Language, string Text);

public sealed class QuranOptionException(string message) : Exception(message);
