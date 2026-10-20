import client from "./axiosClient";

export interface MetalPrices {
  currency: string;
  goldPerGram: number;
  silverPerGram: number;
  goldPerOunceUsd: number;
  silverPerOunceUsd: number;
  updatedAt: string;
  source: string;
}

export async function getMetalPrices(currency: string, signal?: AbortSignal) {
  const response = await client.get<MetalPrices>("/metal-prices", {
    params: { currency },
    signal,
  });
  return response.data;
}
