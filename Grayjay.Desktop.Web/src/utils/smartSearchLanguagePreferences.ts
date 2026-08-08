export function normalizeSmartSearchLanguages(languages: unknown[], supportedCodes: Set<string>, maxLanguages: number): string[] {
    return languages
        .filter((language): language is string => typeof language === "string" && supportedCodes.has(language))
        .filter((language, index, selected) => selected.indexOf(language) === index)
        .slice(0, maxLanguages);
}
