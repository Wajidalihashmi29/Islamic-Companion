namespace IslamicCompanion.Application.DTOs;

public sealed class HadithSearchResult
{
    public int TotalResults { get; set; }
    public bool HasMore { get; set; }
    public IReadOnlyList<HadithSearchItem> Items { get; set; } = [];
}

public sealed class HadithSearchItem
{
    public int HadithNumber { get; set; }
    public string BookName { get; set; } = string.Empty;
    public string Arabic { get; set; } = string.Empty;
    public string Translation { get; set; } = string.Empty;
    public string SourceUrl { get; set; } = string.Empty;
}

public sealed class HadithBook
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}
