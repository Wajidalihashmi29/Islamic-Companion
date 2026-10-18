$ErrorActionPreference = 'Stop'
$destination = Join-Path $PSScriptRoot '..\backend\IslamicCompanion.Infrastructure\Data\Quran'
[void](New-Item -ItemType Directory -Force -Path $destination)
$sources = @(
    @{ File = 'indopak.json'; Url = 'https://api.quran.com/api/v4/quran/verses/indopak'; Source = 'Quran.com / QuranWBW'; Terms = 'Non-commercial use with source credits; see SOURCES.txt' },
    @{ File = 'uthmani.xml'; Url = 'https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=xml&marks=true&sajdah=true&rub=true&alef=true&tatweel=true&agree=true'; Source = 'Tanzil Project'; Terms = 'CC BY 3.0; verbatim text only; embedded copyright notice retained' },
    @{ File = 'metadata.xml'; Url = 'https://tanzil.net/res/text/metadata/quran-data.xml'; Source = 'Tanzil Project'; Terms = 'CC BY; source attribution required' },
    @{ File = 'chapters.json'; Url = 'https://api.quran.com/api/v4/chapters'; Source = 'Quran.com'; Terms = 'Chapter metadata; source attribution' },
    @{ File = 'ur.kanzuliman.txt'; Url = 'https://tanzil.net/trans/ur.kanzuliman?type=txt-2'; Source = 'Tanzil / Ahmed Raza Khan'; Terms = 'Non-commercial use only: https://tanzil.net/trans/' },
    @{ File = 'en.ahmedraza.txt'; Url = 'https://tanzil.net/trans/en.ahmedraza?type=txt-2'; Source = 'Tanzil / Ahmed Raza Khan (English edition)'; Terms = 'Non-commercial use only: https://tanzil.net/trans/' },
    @{ File = 'ur.qadri.txt'; Url = 'https://tanzil.net/trans/ur.qadri?type=txt-2'; Source = 'Tanzil / Tahir ul Qadri'; Terms = 'Non-commercial use only: https://tanzil.net/trans/' }
)
$manifest = foreach ($source in $sources) {
    $path = Join-Path $destination $source.File
    Invoke-WebRequest -Uri $source.Url -OutFile $path -TimeoutSec 120
    if ($source.File -eq 'indopak.json') {
        $data = Get-Content -Raw -Encoding utf8 $path | ConvertFrom-Json
        if ($data.verses.Count -ne 6236) { throw 'Incomplete Indo-Pak export.' }
    } elseif ($source.File -eq 'chapters.json') {
        $data = Get-Content -Raw -Encoding utf8 $path | ConvertFrom-Json
        if ($data.chapters.Count -ne 114) { throw 'Incomplete chapter export.' }
    } elseif ($source.File.EndsWith('.txt')) {
        $entries = @(Get-Content -Encoding utf8 $path | Where-Object { $_ -match '^\d+\|\d+\|' })
        if ($entries.Count -ne 6236) { throw "Incomplete translation: $($source.File)" }
    } else {
        $data = [xml](Get-Content -Raw -Encoding utf8 $path)
        if ($source.File -eq 'metadata.xml') {
            if ($data.quran.pages.page.Count -ne 604) { throw 'Incomplete page metadata.' }
        } elseif ($data.SelectNodes('/quran/sura/aya').Count -ne 6236) {
            throw "Incomplete verse export: $($source.File)"
        }
    }
    [ordered]@{
        file = $source.File
        url = $source.Url
        source = $source.Source
        terms = $source.Terms
        retrievedUtc = [DateTime]::UtcNow.ToString('o')
        sha256 = (Get-FileHash -Algorithm SHA256 $path).Hash.ToLowerInvariant()
    }
    Write-Host "Verified $($source.File)"
}
$manifest | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 (Join-Path $destination 'manifest.json')
