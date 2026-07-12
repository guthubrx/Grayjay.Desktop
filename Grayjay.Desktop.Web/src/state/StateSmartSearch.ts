import { createSignal } from "solid-js";
import { Backend } from "../backend/Backend";
import { SettingsBackend } from "../backend/SettingsBackend";
import type { ISmartSearchSession } from "../backend/SmartSearchBackend";

const [translatorCommand$, setTranslatorCommandSignal] = createSignal("");
const [smartSearchSession$, setSmartSearchSessionSignal] = createSignal<ISmartSearchSession>();
const [smartSearchQuery$, setSmartSearchQuerySignal] = createSignal<string>();
const [smartSearchLoading$, setSmartSearchLoadingSignal] = createSignal(false);
const [smartSearchVisible$, setSmartSearchVisibleSignal] = createSignal(false);

(async () => {
    try {
        const raw: any = await Backend.GET("/settings/PersistGet?key=smartSearch.translatorCommand");
        const value = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (value && typeof value.command === "string")
            setTranslatorCommandSignal(value.command);
    } catch {
        // Smart Search remains optional until configured.
    }
})();

export { smartSearchLoading$, smartSearchQuery$, smartSearchSession$, smartSearchVisible$, translatorCommand$ };

export function hasTranslatorCommand() {
    return translatorCommand$().trim().length > 0;
}

export async function setTranslatorCommand(command: string) {
    const value = command.trim();
    setTranslatorCommandSignal(value);
    await SettingsBackend.persistSet("smartSearch.translatorCommand", { command: value });
}

export function beginSmartSearch(query: string) {
    setSmartSearchQuerySignal(query);
    setSmartSearchSessionSignal(undefined);
    setSmartSearchLoadingSignal(true);
    setSmartSearchVisibleSignal(true);
}

export function clearSmartSearch() {
    setSmartSearchQuerySignal(undefined);
    setSmartSearchSessionSignal(undefined);
    setSmartSearchLoadingSignal(false);
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

export function setSmartSearchSession(session: ISmartSearchSession) {
    setSmartSearchSessionSignal(session);
}

export function showSmartSearch() {
    setSmartSearchVisibleSignal(true);
}
