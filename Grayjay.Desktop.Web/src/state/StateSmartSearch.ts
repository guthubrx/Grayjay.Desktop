import { createSignal } from "solid-js";
import { Backend } from "../backend/Backend";
import { SettingsBackend } from "../backend/SettingsBackend";
import type { ISmartSearchSession } from "../backend/SmartSearchBackend";

export const SMART_SEARCH_LANGUAGE_OPTIONS = [
    { code: "ja", label: "Japonais" },
    { code: "zh-Hans", label: "Chinois simplifie" },
    { code: "ar", label: "Arabe" },
    { code: "ru", label: "Russe" },
    { code: "uk", label: "Ukrainien" },
    { code: "vi", label: "Vietnamien" },
    { code: "he", label: "Hebreu" },
    { code: "en", label: "Anglais" }
];

const DEFAULT_SMART_SEARCH_LANGUAGES = ["ja", "zh-Hans", "ar", "ru"];
const MAX_SMART_SEARCH_LANGUAGES = 4;

const [translatorCommand$, setTranslatorCommandSignal] = createSignal("");
const [smartSearchAutoStart$, setSmartSearchAutoStartSignal] = createSignal(false);
const [smartSearchLanguages$, setSmartSearchLanguagesSignal] = createSignal(DEFAULT_SMART_SEARCH_LANGUAGES);
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
        if (Array.isArray(settings?.languages)) {
            const languages = normalizeLanguages(settings.languages);
            if (languages.length > 0)
                setSmartSearchLanguagesSignal(languages);
        }
    } catch {
        // Smart Search remains optional until configured.
    } finally {
        setSmartSearchSettingsReadySignal(true);
    }
})();

export { smartSearchAutoStart$, smartSearchLanguages$, smartSearchLoading$, smartSearchQuery$, smartSearchSession$, smartSearchSettingsReady$, smartSearchTranslatingTitles$, smartSearchVisible$, translatorCommand$ };

function normalizeLanguages(languages: unknown[]) {
    const supported = new Set(SMART_SEARCH_LANGUAGE_OPTIONS.map(option => option.code));
    return languages
        .filter((language): language is string => typeof language === "string" && supported.has(language))
        .filter((language, index, selected) => selected.indexOf(language) === index)
        .slice(0, MAX_SMART_SEARCH_LANGUAGES);
}

async function persistSmartSearchSettings() {
    await SettingsBackend.persistSet("smartSearch.settings", {
        autoStart: smartSearchAutoStart$(),
        languages: smartSearchLanguages$()
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
    await persistSmartSearchSettings();
    return true;
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
