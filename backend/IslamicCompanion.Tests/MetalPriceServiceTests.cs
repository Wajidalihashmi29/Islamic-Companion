using System.Net;
using System.Text;
using IslamicCompanion.Infrastructure.ExternalServices;
using Microsoft.Extensions.Caching.Memory;

namespace IslamicCompanion.Tests;

public class MetalPriceServiceTests
{
    [Fact]
    public async Task ConvertsLiveOuncePricesToLocalPerGramPrices()
    {
        var handler = new StubHttpHandler(request =>
        {
            var json = request.RequestUri!.Host switch
            {
                "standardbullion.com" => """
                    {"updated":"2026-10-20T06:49:58.822Z","metals":[
                      {"symbol":"XAU","ask":3100.00},
                      {"symbol":"XAG","ask":31.1034768}
                    ]}
                    """,
                "open.er-api.com" => """{"rates":{"INR":90.0}}""",
                _ => throw new InvalidOperationException(),
            };
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            };
        });
        using var http = new HttpClient(handler);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var service = new MetalPriceService(http, cache);

        var result = await service.GetCurrentPricesAsync("inr", CancellationToken.None);

        Assert.Equal("INR", result.Currency);
        Assert.Equal(8970.06m, result.GoldPerGram);
        Assert.Equal(90m, result.SilverPerGram);
        Assert.Equal("Standard Bullion", result.Source);
    }

    private sealed class StubHttpHandler(Func<HttpRequestMessage, HttpResponseMessage> responder) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken) =>
            Task.FromResult(responder(request));
    }
}
