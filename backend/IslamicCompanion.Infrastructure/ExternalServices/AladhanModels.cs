namespace IslamicCompanion.Infrastructure.ExternalServices;

public class AladhanResponse
{
    public AladhanData Data { get; set; } = new();
}

public class AladhanCalendarResponse
{
    public List<AladhanData> Data { get; set; } = [];
}

public class AladhanData
{
    public Dictionary<string, string> Timings { get; set; } = new();
    public AladhanDate Date { get; set; } = new();
    public AladhanMeta Meta { get; set; } = new();
}

public class AladhanMeta
{
    public string Timezone { get; set; } = string.Empty;
}

public class AladhanDate
{
    public string Readable { get; set; } = string.Empty;
    public AladhanHijri Hijri { get; set; } = new();
}

public class AladhanHijri
{
    public string Day { get; set; } = string.Empty;
    public string Year { get; set; } = string.Empty;
    public AladhanHijriMonth Month { get; set; } = new();
}

public class AladhanHijriMonth
{
    public string En { get; set; } = string.Empty;
}