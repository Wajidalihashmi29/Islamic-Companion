using System.Globalization;
using System.Text.Json;
using IslamicCompanion.Application.DTOs;
using IslamicCompanion.Application.Interfaces;
using Microsoft.Extensions.Caching.Memory;

namespace IslamicCompanion.Infrastructure.ExternalServices;

public sealed class MetalPriceService(HttpClient http, IMemoryCache cache) : IMetalPriceService
{
    private const decimal GramsPerTroyOunce = 31.1034768m;
    private static readonly HashSet<string> SupportedCurrencies =
        ["USD", "GBP", "EUR", "INR", "PKR", "BDT", "AED", "SAR", "CAD", "AUD"];

    public async Task<MetalPriceResult> GetCurrentPricesAsync(
        string currency,
        CancellationToken cancellationToken)
    {
        currency = currency.Trim().ToUpperInvariant();
        if (!SupportedCurrencies.Contains(currency))
            throw new ArgumentException("The selected currency is unavailable.", nameof(currency));

        return await cache.GetOrCreateAsync($"metal-prices:{currency}", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(15);

            using var metalsResponse = await http.GetAsync(
                "https://standardbullion.com/spot-prices.json", cancellationToken);
            metalsResponse.EnsureSuccessStatusCode();
            using var metalsJson = JsonDocument.Parse(
                await metalsResponse.Content.ReadAsStringAsync(cancellationToken));

            var goldOunce = ReadMetalAsk(metalsJson.RootElement, "XAU");
            var silverOunce = ReadMetalAsk(metalsJson.RootElement, "XAG");
            var updated = DateTimeOffset.Parse(
                metalsJson.RootElement.GetProperty("updated").GetString()!,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal);

            var exchangeRate = 1m;
            if (currency != "USD")
            {
                using var exchangeResponse = await http.GetAsync(
                    "https://open.er-api.com/v6/latest/USD", cancellationToken);
                exchangeResponse.EnsureSuccessStatusCode();
                using var exchangeJson = JsonDocument.Parse(
                    await exchangeResponse.Content.ReadAsStringAsync(cancellationToken));
                exchangeRate = exchangeJson.RootElement.GetProperty("rates").GetProperty(currency).GetDecimal();
            }

            return new MetalPriceResult
            {
                Currency = currency,
                GoldPerGram = decimal.Round(goldOunce * exchangeRate / GramsPerTroyOunce, 2),
                SilverPerGram = decimal.Round(silverOunce * exchangeRate / GramsPerTroyOunce, 2),
                GoldPerOunceUsd = goldOunce,
                SilverPerOunceUsd = silverOunce,
                UpdatedAt = updated,
                Source = "Standard Bullion",
            };
        }) ?? throw new InvalidOperationException("Metal prices could not be loaded.");
    }

    private static decimal ReadMetalAsk(JsonElement root, string symbol)
    {
        foreach (var metal in root.GetProperty("metals").EnumerateArray())
        {
            if (metal.GetProperty("symbol").GetString() == symbol)
                return metal.GetProperty("ask").GetDecimal();
        }

        throw new InvalidOperationException($"{symbol} was missing from the metal price response.");
    }
}
