using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using IslamicCompanion.Infrastructure.Quran;

if (args.Length != 2)
    throw new ArgumentException("Usage: dotnet run --project scripts\\Import-TafseerData -- <repository root> <resume directory>");
var root = Path.GetFullPath(args[0]);
var resume = Path.GetFullPath(args[1]);
Directory.CreateDirectory(resume);
var quran = Path.Combine(root, "backend", "IslamicCompanion.Infrastructure", "Data", "Quran");
using var chapters = JsonDocument.Parse(File.ReadAllBytes(Path.Combine(quran, "chapters.json")));
var counts = chapters.RootElement.GetProperty("chapters").EnumerateArray()
    .Select(chapter => chapter.GetProperty("verses_count").GetInt32()).ToArray();
using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
http.DefaultRequestHeaders.UserAgent.ParseAdd("IslamicCompanion-AuthorizedDataImport/1.0");
var options = new JsonSerializerOptions(JsonSerializerDefaults.Web) { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
var results = new Dictionary<string, string>[114];
await Parallel.ForEachAsync(Enumerable.Range(1, 114), new ParallelOptions { MaxDegreeOfParallelism = 8 },
    async (surah, token) =>
{
    var checkpoint = Path.Combine(resume, $"{surah:000}.json");
    var entries = File.Exists(checkpoint)
        ? JsonSerializer.Deserialize<Dictionary<string, string>>(await File.ReadAllBytesAsync(checkpoint, token), options)!
        : new Dictionary<string, string>();
    for (var ayah = 1; ayah <= counts[surah - 1]; ayah++)
    {
        if (entries.TryGetValue($"{surah}:{ayah}", out var saved) && !string.IsNullOrWhiteSpace(saved)) continue;
        var url = SiratUlJinan.SourceUrl(surah, ayah);
        string? html = null;
        for (var attempt = 0; attempt < 4; attempt++)
        {
            try
            {
                using var response = await http.GetAsync(url, token);
                if ((int)response.StatusCode == 429 || (int)response.StatusCode >= 500)
                    throw new HttpRequestException($"Source returned {response.StatusCode}.", null, response.StatusCode);
                response.EnsureSuccessStatusCode();
                html = await response.Content.ReadAsStringAsync(token);
                break;
            }
            catch (HttpRequestException) when (attempt < 3)
            {
                await Task.Delay(TimeSpan.FromSeconds(2 << attempt), token);
            }
        }
        var text = TafseerHtml.ReadText(html!, url);
        var group = Regex.Match(html!, "data-ayat-number=\"(?<numbers>\\d+(?:-\\d+)*)\"");
        if (!group.Success) throw new InvalidDataException($"Missing Ayah identity: {url}");
        var numbers = group.Groups["numbers"].Value.Split('-').Select(int.Parse).ToArray();
        var sourceAyah = surah == 1 ? ayah - 1 : ayah;
        if (!numbers.Contains(sourceAyah))
            throw new InvalidDataException($"Different Ayah returned: {url}");
        foreach (var number in numbers)
        {
            var covered = surah == 1 ? number + 1 : number;
            if (covered >= 1 && covered <= counts[surah - 1]) entries[$"{surah}:{covered}"] = text;
        }
        await File.WriteAllBytesAsync(checkpoint, JsonSerializer.SerializeToUtf8Bytes(entries, options), token);
    }
    if (entries.Count != counts[surah - 1]) throw new InvalidDataException($"Incomplete Surah {surah}.");
    results[surah - 1] = entries;
    Console.WriteLine($"Imported Surah {surah}/114 ({entries.Count} Ayahs).");
});
var all = results.SelectMany(entries => entries).ToDictionary(entry => entry.Key, entry => entry.Value);
if (all.Count != 6236 || all.Values.Any(string.IsNullOrWhiteSpace))
    throw new InvalidDataException("Tafseer must cover all 6,236 canonical Ayahs.");
var destination = Path.Combine(root, "backend", "IslamicCompanion.Infrastructure", "Data", "Tafseer");
Directory.CreateDirectory(destination);
var bytes = JsonSerializer.SerializeToUtf8Bytes(all, options);
var archive = Path.Combine(destination, "sirat-ul-jinan.json.gz");
await using (var file = File.Create(archive + ".tmp"))
await using (var gzip = new GZipStream(file, CompressionLevel.SmallestSize))
    await gzip.WriteAsync(bytes);
File.Move(archive + ".tmp", archive, true);
await File.WriteAllBytesAsync(Path.Combine(destination, "manifest.json"), JsonSerializer.SerializeToUtf8Bytes(new
{
    file = "sirat-ul-jinan.json.gz",
    sha256 = Convert.ToHexStringLower(SHA256.HashData(await File.ReadAllBytesAsync(archive))),
    source = "Dawat-e-Islami / Mufti Muhammad Qasim Attari",
    sourceUrl = SiratUlJinan.SourceUrl(1, 1),
    authorization = "Project owner confirmed authorized use. Publisher rights and attribution retained.",
    retrievedUtc = DateTime.UtcNow,
    ayahCount = all.Count
}, new JsonSerializerOptions(options) { WriteIndented = true }));
Console.WriteLine($"Verified and bundled {all.Count} Ayahs ({new FileInfo(archive).Length:N0} compressed bytes).");
