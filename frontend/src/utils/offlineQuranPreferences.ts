export interface OfflineQuranPreferenceSource {
  quran: {
    mushafLines: 16 | 15;
    preferredTranslation: string;
  };
  general: {
    appLanguage: string;
  };
}

export function getOfflineQuranPreferencePatch(source: OfflineQuranPreferenceSource) {
  return {
    quran: {
      mushafLines: source.quran.mushafLines,
      preferredTranslation: source.quran.preferredTranslation,
    },
    general: {
      appLanguage: source.general.appLanguage,
    },
  };
}
