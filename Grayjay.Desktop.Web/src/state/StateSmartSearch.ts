import { createSignal } from "solid-js";
import { Backend } from "../backend/Backend";
import { SettingsBackend } from "../backend/SettingsBackend";
import { SmartSearchBackend, type ISmartSearchSession } from "../backend/SmartSearchBackend";
import {
    defaultSubtitleTranslationLanguages,
    normalizeSmartSearchLanguages,
    normalizeSubtitleTranslationLanguages
} from "../utils/smartSearchLanguagePreferences";

export type SmartSearchTitleDisplay = "both" | "translated";
export type SmartSearchResultLayout = "grouped" | "mixed";
export type SmartSearchMode = "standard" | "smart";

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
const DEFAULT_DISCOVERY_PARALLELISM = 3;
const MIN_DISCOVERY_PARALLELISM = 1;
const MAX_DISCOVERY_PARALLELISM = 32;

const [translatorCommand$, setTranslatorCommandSignal] = createSignal("");
const [smartSearchAutoStart$, setSmartSearchAutoStartSignal] = createSignal(false);
const [smartSearchLanguages$, setSmartSearchLanguagesSignal] = createSignal(DEFAULT_SMART_SEARCH_LANGUAGES);
const [smartSearchTitleDisplay$, setSmartSearchTitleDisplaySignal] = createSignal<SmartSearchTitleDisplay>("both");
const [smartSearchTranslateCreatorNames$, setSmartSearchTranslateCreatorNamesSignal] = createSignal(false);
const [smartSearchResultLayout$, setSmartSearchResultLayoutSignal] = createSignal<SmartSearchResultLayout>("grouped");
const [smartSearchPreferredMode$, setSmartSearchPreferredModeSignal] = createSignal<SmartSearchMode>("standard");
const [smartSearchDiscoveryParallelism$, setSmartSearchDiscoveryParallelismSignal] = createSignal(DEFAULT_DISCOVERY_PARALLELISM);
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
        if (settings?.preferredMode === "smart")
            setSmartSearchPreferredModeSignal("smart");
        setSmartSearchDiscoveryParallelismSignal(normalizeDiscoveryParallelism(settings?.discoveryParallelism));
    } catch {
        // Smart Search remains optional until configured.
    } finally {
        setSmartSearchSettingsReadySignal(true);
    }
})();

export { smartSearchAutoStart$, smartSearchDiscoveryParallelism$, smartSearchLanguages$, smartSearchLoading$, smartSearchPreferredMode$, smartSearchQuery$, smartSearchResultLayout$, smartSearchSession$, smartSearchSettingsReady$, smartSearchSubtitleTranslationLanguages$, smartSearchTitleDisplay$, smartSearchTranslatingTitles$, smartSearchTranslateCreatorNames$, smartSearchVisible$, translatorCommand$ };

function normalizeLanguages(languages: unknown[]) {
    const supported = new Set(SMART_SEARCH_LANGUAGE_OPTIONS.map(option => option.code));
    return normalizeSmartSearchLanguages(languages, supported, MAX_SMART_SEARCH_LANGUAGES);
}

function normalizeDiscoveryParallelism(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return DEFAULT_DISCOVERY_PARALLELISM;
    return Math.max(MIN_DISCOVERY_PARALLELISM, Math.min(MAX_DISCOVERY_PARALLELISM, parsed));
}

async function persistSmartSearchSettings() {
    await SettingsBackend.persistSet("smartSearch.settings", {
        autoStart: smartSearchAutoStart$(),
        languages: smartSearchLanguages$(),
        subtitleTranslationLanguages: smartSearchSubtitleTranslationLanguages$(),
        titleDisplay: smartSearchTitleDisplay$(),
        translateCreatorNames: smartSearchTranslateCreatorNames$(),
        resultLayout: smartSearchResultLayout$(),
        preferredMode: smartSearchPreferredMode$(),
        discoveryParallelism: smartSearchDiscoveryParallelism$()
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

export async function setSmartSearchPreferredMode(mode: SmartSearchMode) {
    setSmartSearchPreferredModeSignal(mode);
    await persistSmartSearchSettings();
}

export async function setSmartSearchDiscoveryParallelism(value: unknown) {
    setSmartSearchDiscoveryParallelismSignal(normalizeDiscoveryParallelism(value));
    await persistSmartSearchSettings();
}

function closeSmartSearchSession() {
    const sessionId = smartSearchSession$()?.sessionId;
    if (sessionId)
        void SmartSearchBackend.close(sessionId).catch(() => undefined);
}

export function beginSmartSearch(query: string, visible = true) {
    closeSmartSearchSession();
    const sessionId = "smart-" + Date.now().toString(36);
    setSmartSearchQuerySignal(query);
    setSmartSearchSessionSignal({ sessionId, variants: [] });
    setSmartSearchLoadingSignal(true);
    setSmartSearchTranslatingTitlesSignal(false);
    setSmartSearchVisibleSignal(visible);
    return sessionId;
}

export function clearSmartSearch() {
    closeSmartSearchSession();
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
