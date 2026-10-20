import { normalizeInterfaceLanguage } from "./interfaceTranslations.ts";

export type ReligiousContentLanguage = "en" | "ur";

export function getReligiousContentLanguage(interfaceLanguage: string): ReligiousContentLanguage {
  return normalizeInterfaceLanguage(interfaceLanguage) === "en" ? "en" : "ur";
}

export function getHadithEditionPrefix(interfaceLanguage: string): "eng" | "urd" {
  return getReligiousContentLanguage(interfaceLanguage) === "en" ? "eng" : "urd";
}

export function getContentLocale(interfaceLanguage: string): string {
  return getReligiousContentLanguage(interfaceLanguage) === "en" ? "en" : "ur";
}
