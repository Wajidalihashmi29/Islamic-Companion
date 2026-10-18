using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Xml.Linq;
using IslamicCompanion.Application.DTOs;
using IslamicCompanion.Application.Services;

namespace IslamicCompanion.Infrastructure.Quran;

public sealed class QuranDataset
{
    private sealed record Verse(string Key, int Surah, int Ayah, int Page, int Manzil,
        int Ruku, int RukuInSurah, int RukuInJuz, int RukuAyahCount,
        bool IsRukuEnd, bool IsSajdah, string IndoPak, string Uthmani);
    private sealed record Translation(string Language, IReadOnlyDictionary<string, string> Text);
    private sealed record SourceFile(string File, string Sha256);
    private readonly Dictionary<string, Verse> verses;
    private readonly Dictionary<int, Verse[]> pages;
    private readonly Dictionary<string, Translation> translations;
    private readonly IReadOnlyDictionary<int, QuranSurah> surahs;
    private readonly HashSet<string> juzStarts = QuranPagination.Juzs.Select(juz => juz.VerseKey).ToHashSet();
    public QuranDirectory Directory { get; }

    public QuranDataset()
    {
        var sources = JsonSerializer.Deserialize<SourceFile[]>(ReadResource("manifest.json"),
            new JsonSerializerOptions(JsonSerializerDefaults.Web))
            ?? throw new InvalidDataException("The bundled Quran manifest is empty.");
        string[] expectedFiles = ["indopak.json", "uthmani.xml", "metadata.xml", "chapters.json",
            "ur.kanzuliman.txt", "en.ahmedraza.txt", "ur.qadri.txt"];
        Require(sources.Length == expectedFiles.Length &&
            sources.Select(source => source.File).ToHashSet().SetEquals(expectedFiles),
            "The bundled Quran manifest does not contain the expected editions.");
        var files = sources.ToDictionary(source => source.File, source =>
        {
            var bytes = ReadResource(source.File);
            Require(Convert.ToHexStringLower(SHA256.HashData(bytes)) == source.Sha256,
                $"The bundled Quran file {source.File} failed its SHA-256 check.");
            return bytes;
        });
        XDocument Xml(string file) => XDocument.Load(new MemoryStream(files[file]));
        var metadata = Xml("metadata.xml").Root ?? throw new InvalidDataException("Missing Quran metadata.");
        var chapters = metadata.Element("suras")!.Elements("sura").ToArray();
        Require(chapters.Length == 114, "Quran metadata must contain 114 Surahs.");
        var keys = chapters.SelectMany((chapter, index) =>
        {
            Require(Number(chapter, "index") == index + 1, "Quran Surahs are not in canonical order.");
            return Enumerable.Range(1, Number(chapter, "ayas")).Select(ayah => $"{index + 1}:{ayah}");
        }).ToArray();
        Require(keys.Length == 6236, "Quran metadata must contain 6,236 Ayahs.");
        var ordinals = keys.Select((key, index) => (key, index)).ToDictionary(item => item.key, item => item.index);
        int[] Partitions(string container, string element, int count)
        {
            var entries = metadata.Element(container)!.Elements(element).ToArray();
            Require(entries.Length == count, $"Incomplete Quran {container} metadata.");
            var starts = entries.Select((entry, index) =>
            {
                Require(Number(entry, "index") == index + 1, $"Invalid Quran {container} order.");
                return ordinals[$"{Number(entry, "sura")}:{Number(entry, "aya")}"];
            }).ToArray();
            Require(starts[0] == 0 && starts.Zip(starts.Skip(1)).All(pair => pair.First < pair.Second),
                $"Invalid Quran {container} boundaries.");
            return starts;
        }
        var pageStarts = Partitions("pages", "page", 604);
        var rukuStarts = Partitions("rukus", "ruku", 556);
        var juzOrdinals = QuranPagination.Juzs.Select(juz => ordinals[juz.VerseKey]).ToArray();
        var manzilStarts = Partitions("manzils", "manzil", 7);
        var sajdas = metadata.Element("sajdas")!.Elements("sajda")
            .Select(entry => $"{Number(entry, "sura")}:{Number(entry, "aya")}").ToHashSet();
        Require(sajdas.Count == 15 && sajdas.All(ordinals.ContainsKey), "Invalid Sajdah metadata.");
        int Partition(int[] starts, int index)
        {
            var match = Array.BinarySearch(starts, index);
            return match >= 0 ? match + 1 : ~match;
        }
        Dictionary<string, string> Text(string file)
        {
            var entries = file.EndsWith(".txt", StringComparison.Ordinal)
                ? Encoding.UTF8.GetString(files[file]).Split('\n').Select(line => line.TrimEnd('\r'))
                    .Where(line => line.Length > 0 && !line.StartsWith('#')).Select(line =>
                    {
                        var parts = line.Split('|', 3);
                        Require(parts.Length == 3, $"Invalid translation row in {file}.");
                        return (Key: $"{parts[0]}:{parts[1]}", Text: (string?)parts[2]);
                    }).ToArray()
                : Xml(file).Root!.Elements("sura").SelectMany(chapter =>
                chapter.Elements("aya").Select(ayah =>
                    (Key: $"{Number(chapter, "index")}:{Number(ayah, "index")}", Text: (string?)ayah.Attribute("text")))).ToArray();
            Require(entries.Length == keys.Length && entries.Select(entry => entry.Key).SequenceEqual(keys) &&
                entries.All(entry => !string.IsNullOrWhiteSpace(entry.Text)), $"Incomplete or unordered Quran edition: {file}.");
            return entries.ToDictionary(entry => entry.Key, entry => entry.Text!);
        }
        using var indoPakJson = JsonDocument.Parse(files["indopak.json"]);
        var indoPakEntries = indoPakJson.RootElement.GetProperty("verses").EnumerateArray().ToArray();
        Require(indoPakEntries.Length == keys.Length &&
            indoPakEntries.Select(entry => entry.GetProperty("verse_key").GetString()).SequenceEqual(keys),
            "Incomplete or unordered Indo-Pak Quran text.");
        var indoPak = indoPakEntries.ToDictionary(entry => entry.GetProperty("verse_key").GetString()!,
            entry => entry.GetProperty("text_indopak").GetString()!);
        Require(indoPak.Values.All(text => !string.IsNullOrWhiteSpace(text)), "Missing Indo-Pak Quran text.");
        var uthmani = Text("uthmani.xml");
        verses = keys.Select((key, index) =>
        {
            var parts = key.Split(':').Select(int.Parse).ToArray();
            var ruku = Partition(rukuStarts, index);
            var first = ordinals[$"{parts[0]}:1"];
            var juzStart = juzOrdinals[Partition(juzOrdinals, index) - 1];
            var rukuEnd = ruku < rukuStarts.Length ? rukuStarts[ruku] : keys.Length;
            var isEnd = index == keys.Length - 1 || (ruku < rukuStarts.Length && index + 1 == rukuStarts[ruku]) ||
                parts[1] == Number(chapters[parts[0] - 1], "ayas");
            return new Verse(key, parts[0], parts[1],
                QuranPagination.GetPage(key, Partition(pageStarts, index)), Partition(manzilStarts, index),
                ruku, ruku - Partition(rukuStarts, first) + 1,
                ruku - Partition(rukuStarts, juzStart) + 1, rukuEnd - rukuStarts[ruku - 1],
                isEnd, sajdas.Contains(key), indoPak[key], uthmani[key]);
        }).ToDictionary(verse => verse.Key);
        pages = verses.Values.GroupBy(verse => verse.Page).ToDictionary(group => group.Key, group => group.ToArray());
        Require(pages.Count == 604 && Enumerable.Range(1, 604).All(pages.ContainsKey),
            "The local Quran must contain all 604 reader pages.");
        using var chapterJson = JsonDocument.Parse(files["chapters.json"]);
        var chapterEntries = chapterJson.RootElement.GetProperty("chapters").EnumerateArray().ToArray();
        Require(chapterEntries.Length == 114, "Missing local Quran directory chapters.");
        var directory = chapterEntries.Select((chapter, index) =>
        {
            var number = chapter.GetProperty("id").GetInt32();
            var count = chapter.GetProperty("verses_count").GetInt32();
            Require(number == index + 1 && count == Number(chapters[index], "ayas"),
                "Quran directory Ayah counts disagree with the text.");
            return new QuranSurah(number, chapter.GetProperty("name_arabic").GetString()!,
                chapter.GetProperty("name_simple").GetString()!, chapter.GetProperty("revelation_place").GetString()!,
                count, Number(chapters[index], "rukus"), verses[$"{number}:1"].Page);
        }).ToArray();
        surahs = directory.ToDictionary(surah => surah.Number);
        Directory = new QuranDirectory(directory, QuranPagination.Juzs);
        translations = new()
        {
            ["kanzul-iman-ur"] = new("ur", Text("ur.kanzuliman.txt")),
            ["kanzul-iman-en"] = new("en", Text("en.ahmedraza.txt")),
            ["irfan-ul-quran-ur"] = new("ur", Text("ur.qadri.txt"))
        };
    }

    public void ValidateVerse(int surah, int ayah)
    {
        if (!surahs.TryGetValue(surah, out var chapter) || ayah < 1 || ayah > chapter.AyahCount)
            throw new ArgumentOutOfRangeException(nameof(ayah), "The requested Ayah does not exist.");
    }

    public int GetVersePage(int surah, int ayah)
    {
        ValidateVerse(surah, ayah);
        return verses[$"{surah}:{ayah}"].Page;
    }

    public QuranPage GetPage(int page, string translation, int lines)
    {
        if (page is < 1 or > 604 || lines is not (15 or 16))
            throw new ArgumentOutOfRangeException(nameof(page), "Page must be 1–604 and lines must be 15 or 16.");
        if (!translations.TryGetValue(translation, out var selected))
            throw new QuranOptionException(translation == "kanzul-iman-hi"
                ? "Kanzul Iman Hindi is unavailable until an authorized, verified dataset is supplied. Choose Kanzul Iman Urdu/English or Irfan-ul-Quran Urdu in Settings."
                : "This translation is no longer offered. Choose Kanzul Iman Urdu/English or Irfan-ul-Quran Urdu in Settings.");
        var source = pages[page];
        var segments = source.Select(verse => new QuranSegment(verse.Key, verse.Ayah, verse.Surah,
            verse.IndoPak, verse.Uthmani, true, verse.IsSajdah, verse.IsRukuEnd,
            verse.RukuInSurah, verse.Ruku, verse.RukuInJuz, verse.RukuAyahCount, selected.Text[verse.Key])).ToArray();
        var juz = QuranPagination.GetJuz(source[0].Key);
        return new QuranPage(page, juz.Number, juz.NameArabic, source[0].Manzil, selected.Language,
            selected.Text["1:1"], QuranPageLayout.Build(segments, surahs, juzStarts, lines));
    }

    private static byte[] ReadResource(string name)
    {
        using var stream = typeof(QuranDataset).Assembly.GetManifestResourceStream("QuranData." + name)
            ?? throw new InvalidDataException($"Bundled Quran data is missing: {name}.");
        using var buffer = new MemoryStream();
        stream.CopyTo(buffer);
        return buffer.ToArray();
    }

    private static int Number(XElement element, string attribute) => (int?)element.Attribute(attribute)
        ?? throw new InvalidDataException($"Missing Quran metadata attribute {attribute}.");

    private static void Require(bool condition, string message)
    {
        if (!condition) throw new InvalidDataException(message);
    }
}
