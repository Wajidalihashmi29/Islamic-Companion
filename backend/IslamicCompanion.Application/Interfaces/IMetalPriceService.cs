using IslamicCompanion.Application.DTOs;

namespace IslamicCompanion.Application.Interfaces;

public interface IMetalPriceService
{
    Task<MetalPriceResult> GetCurrentPricesAsync(string currency, CancellationToken cancellationToken);
}
