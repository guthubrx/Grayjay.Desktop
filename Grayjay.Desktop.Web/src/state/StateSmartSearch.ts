import { createSignal } from "solid-js";
import { Backend } from "../backend/Backend";
import { SettingsBackend } from "../backend/SettingsBackend";
import type { ISmartSearchSession } from "../backend/SmartSearchBackend";
import {
    defaultSubtitleTranslationLanguages,
    normalizeSmartSearchLanguages,
    normalizeSubtitleTranslationLanguages
} from "../utils/smartSearchLanguagePreferences";

export type SmartSearchTitleDisplay = "both" | "translated";
export type SmartSearchResultLayout = "grouped" | "mixed";

export const SMART_SEARCH_LANGUAGE_OPTIONS = [
    { code: "de", label: "Allemand" },
    { code: "en", label: "Anglais" },
    { code: "ar", label: "Arabe" },
    { code: "bn", label: "Bengali" },
    { code: "zh-Hans", label: "Chinois simplifie" },
    { code: "zh-Hant", label: "Chinois traditionnel" },
    { code: "ko", label: "Coreen" },
    { code: "da", label: "Danois" },
    { code: "es", label: "Espagnol" },
    { code: "fi", label: "Finnois" },
    { code: "el", label: "Grec" },
    { code: "he", label: "Hebreu" },
    { code: "hi", label: "Hindi" },
    { code: "hu", label: "Hongrois" },
    { code: "id", label: "Indonesien" },
    { code: "it", label: "Italien" },
    { code: "ja", label: "Japonais" },
    { code: "ms", label: "Malais" },
    { code: "nl", label: "Neerlandais" },
    { code: "nb", label: "Norvegien" },
    { code: "fa", label: "Persan" },
    { code: "pl", label: "Polonais" },
    { code: "pt", label: "Portugais" },
    { code: "ro", label: "Roumain" },
    { code: "ru", label: "Russe" },
    { code: "sv", label: "Suedois" },
    { code: "cs", label: "Tcheque" },
    { code: "th", label: "Thai" },
    { code: "tr", label: "Turc" },
    { code: "uk", label: "Ukrainien" },
    { code: "vi", label: "Vietnamien" }
];

const DEFAULT_SMART_SEARCH_LANGUAGES = ["ja", "zh-Hans", "ar", "ru"];
const MAX_SMART_SEARCH_LANGUAGES = 6;

const [translatorCommand$, setTranslatorCommandSignal] = createSignal("");
const [smartSearchAutoStart$, setSmartSearchAutoStartSignal] = createSignal(false);
const [smartSearchLanguages$, setSmartSearchLanguagesSignal] = createSignal(DEFAULT_SMART_SEARCH_LANGUAGES);
const [smartSearchTitleDisplay$, setSmartSearchTitleDisplaySignal] = createSignal<SmartSearchTitleDisplay>("both");
const [smartSearchTranslateCreatorNames$, setSmartSearchTranslateCreatorNamesSignal] = createSignal(false);
const [smartSearchResultLayout$, setSmartSearchResultLayoutSignal] = createSignal<SmartSearchResultLayout>("grouped");
const [smartSearchSubtitleTranslationLanguages$, setSmartSearchSubtitleTranslationLanguagesSignal] = createSignal<string[]>(defaultSubtitleTranslationLanguages(DEFAULT_SMART_SEARCH_LANGUAGES));
const [smartSearchSettingsReady$, setSmartSearchSettingsReadySignal] = createSignal(false);
const [smartSearchSession$, setSmartSearchSessionSignal] = createSignal<ISmartSearchSession>();
const [smartSearchQuery$, setSmartSearchQuerySignal] = createSignal<string>();
const [smartSearchLoading$, setSmartSearchLoadingSignal] = createSignal(false);
const [smartSearchTranslatingTitles$, setSmartSearchTranslatingTitlesSignal] = createSignal(false);
const [smartSearchVisible$, setSmartSearchVisibleSignal] = createSignal(false);

(async () => {
    try {
        const [raw, settingsRaw] = await Promise.all([
            Backend.GET("/settings/PersistGet?key=smartSearch.translatorCommand"),
            Backend.GET("/settings/PersistGet?key=smartSearch.settings")
        ]);
        const value: any = typeof raw === "string" ? JSON.parse(raw) : raw;
        const settings: any = typeof settingsRaw === "string" ? JSON.parse(settingsRaw) : settingsRaw;
        if (value && typeof value.command === "string")
            setTranslatorCommandSignal(value.command);
        if (typeof settings?.autoStart === "boolean")
            setSmartSearchAutoStartSignal(settings.autoStart);
        const languages = Array.isArray(settings?.languages)
            ? normalizeLanguages(settings.languages)
            : DEFAULT_SMART_SEARCH_LANGUAGES;
        if (languages.length > 0)
            setSmartSearchLanguagesSignal(languages);
        const translationLanguages = Array.isArray(settings?.subtitleTranslationLanguages)
            ? normalizeSubtitleTranslationLanguages(settings.subtitleTranslationLanguages, languages)
            : defaultSubtitleTranslationLanguages(languages);
        setSmartSearchSubtitleTranslationLanguagesSignal(translationLanguages);
        if (settings?.titleDisplay === "translated")
            setSmartSearchTitleDisplaySignal("translated");
        if (typeof settings?.translateCreatorNames === "boolean")
            setSmartSearchTranslateCreatorNamesSignal(settings.translateCreatorNames);
        if (settings?.resultLayout === "mixed")
            setSmartSearchResultLayoutSignal("mixed");
    } catch {
        // Smart Search remains optional until configured.
    } finally {
        setSmartSearchSettingsReadySignal(true);
    }
})();

export { smartSearchAutoStart$, smartSearchLanguages$, smartSearchLoading$, smartSearchQuery$, smartSearchResultLayout$, smartSearchSession$, smartSearchSettingsReady$, smartSearchSubtitleTranslationLanguages$, smartSearchTitleDisplay$, smartSearchTranslatingTitles$, smartSearchTranslateCreatorNames$, smartSearchVisible$, translatorCommand$ };

function normalizeLanguages(languages: unknown[]) {
    const supported = new Set(SMART_SEARCH_LANGUAGE_OPTIONS.map(option => option.code));
    return normalizeSmartSearchLanguages(languages, supported, MAX_SMART_SEARCH_LANGUAGES);
}

async function persistSmartSearchSettings() {
    await SettingsBackend.persistSet("smartSearch.settings", {
        autoStart: smartSearchAutoStart$(),
        languages: smartSearchLanguages$(),
        subtitleTranslationLanguages: smartSearchSubtitleTranslationLanguages$(),
        titleDisplay: smartSearchTitleDisplay$(),
        translateCreatorNames: smartSearchTranslateCreatorNames$(),
        resultLayout: smartSearchResultLayout$()
    });
}

export function hasTranslatorCommand() {
    return translatorCommand$().trim().length > 0;
}

export async function setTranslatorCommand(command: string) {
    const value = command.trim();
    setTranslatorCommandSignal(value);
    await SettingsBackend.persistSet("smartSearch.translatorCommand", { command: value });
}

export async function setSmartSearchAutoStart(autoStart: boolean) {
    setSmartSearchAutoStartSignal(autoStart);
    await persistSmartSearchSettings();
}

export async function setSmartSearchLanguages(languages: unknown[]) {
    const normalized = normalizeLanguages(languages);
    if (normalized.length === 0)
        return false;
    setSmartSearchLanguagesSignal(normalized);
    setSmartSearchSubtitleTranslationLanguagesSignal(normalizeSubtitleTranslationLanguages(smartSearchSubtitleTranslationLanguages$(), normalized));
    await persistSmartSearchSettings();
    return true;
}

export async function setSmartSearchSubtitleTranslationLanguage(language: string, enabled: boolean) {
    if (!smartSearchLanguages$().includes(language))
        return;

    const current = smartSearchSubtitleTranslationLanguages$();
    const next = enabled
        ? [...current, language]
        : current.filter(value => value !== language);
    setSmartSearchSubtitleTranslationLanguagesSignal(normalizeSubtitleTranslationLanguages(next, smartSearchLanguages$()));
    await persistSmartSearchSettings();
}

export async function setSmartSearchTitleDisplay(titleDisplay: SmartSearchTitleDisplay) {
    setSmartSearchTitleDisplaySignal(titleDisplay);
    await persistSmartSearchSettings();
}

export async function setSmartSearchTranslateCreatorNames(translateCreatorNames: boolean) {
    setSmartSearchTranslateCreatorNamesSignal(translateCreatorNames);
    await persistSmartSearchSettings();
}

export async function setSmartSearchResultLayout(resultLayout: SmartSearchResultLayout) {
    setSmartSearchResultLayoutSignal(resultLayout);
    await persistSmartSearchSettings();
}

export function beginSmartSearch(query: string, visible = true) {
    setSmartSearchQuerySignal(query);
    setSmartSearchSessionSignal(undefined);
    setSmartSearchLoadingSignal(true);
    setSmartSearchTranslatingTitlesSignal(false);
    setSmartSearchVisibleSignal(visible);
}

export function clearSmartSearch() {
    setSmartSearchQuerySignal(undefined);
    setSmartSearchSessionSignal(undefined);
    setSmartSearchLoadingSignal(false);
    setSmartSearchTranslatingTitlesSignal(false);
    setSmartSearchVisibleSignal(false);
}

export function hideSmartSearch() {
    setSmartSearchVisibleSignal(false);
}

export function isSmartSearchForQuery(query: string | undefined) {
    return !!query && smartSearchQuery$() === query;
}

export function setSmartSearchLoading(loading: boolean) {
    setSmartSearchLoadingSignal(loading);
}

export function setSmartSearchTranslatingTitles(translating: boolean) {
    setSmartSearchTranslatingTitlesSignal(translating);
}

export function setSmartSearchSession(session: ISmartSearchSession) {
    setSmartSearchSessionSignal(session);
}

export function showSmartSearch() {
    setSmartSearchVisibleSignal(true);
}
