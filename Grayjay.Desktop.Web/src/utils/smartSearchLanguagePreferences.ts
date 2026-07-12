const EXCLUDED_DEFAULT_TRANSLATION_LANGUAGES = new Set(["en", "fr"]);

export function normalizeSmartSearchLanguages(languages: unknown[], supportedCodes: Set<string>, maxLanguages: number): string[] {
    return languages
        .filter((language): language is string => typeof language === "string" && supportedCodes.has(language))
        .filter((language, index, selected) => selected.indexOf(language) === index)
        .slice(0, maxLanguages);
}

export function defaultSubtitleTranslationLanguages(languages: string[]): string[] {
    return languages.filter(language => !EXCLUDED_DEFAULT_TRANSLATION_LANGUAGES.has(language));
}

export function normalizeSubtitleTranslationLanguages(languages: unknown[], selectedLanguages: string[]): string[] {
    return languages
        .filter((language): language is string => typeof language === "string" && selectedLanguages.includes(language))
        .filter((language, index, selected) => selected.indexOf(language) === index);
}
