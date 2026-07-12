import { createSignal } from "solid-js";
import { Backend } from "../backend/Backend";
import { SettingsBackend } from "../backend/SettingsBackend";

const [translatorCommand$, setTranslatorCommandSignal] = createSignal("");

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

export { translatorCommand$ };

export function hasTranslatorCommand() {
    return translatorCommand$().trim().length > 0;
}

export async function setTranslatorCommand(command: string) {
    const value = command.trim();
    setTranslatorCommandSignal(value);
    await SettingsBackend.persistSet("smartSearch.translatorCommand", { command: value });
}
