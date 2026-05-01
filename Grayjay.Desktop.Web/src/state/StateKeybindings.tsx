import { createSignal } from "solid-js";
import { SettingsBackend } from "../backend/SettingsBackend";

export type ActionId =
    | "press" | "back" | "options" | "action"
    | "navUp" | "navDown" | "navLeft" | "navRight"
    | "navUpAlt" | "navDownAlt" | "navLeftAlt" | "navRightAlt"
    | "theaterToggle" | "windowMaximize" | "speedUp" | "speedDown"
    | "showShortcuts";

export const KEYBINDING_LABELS: Record<ActionId, string> = {
    press: "Activate focused element",
    back: "Go back / close overlay",
    options: "Open options menu",
    action: "Action on focused element",
    navUp: "Navigate up",
    navDown: "Navigate down",
    navLeft: "Navigate left",
    navRight: "Navigate right",
    navUpAlt: "Navigate up (alternative)",
    navDownAlt: "Navigate down (alternative)",
    navLeftAlt: "Navigate left (alternative)",
    navRightAlt: "Navigate right (alternative)",
    theaterToggle: "Toggle theater mode",
    windowMaximize: "Maximize video to fill the window",
    speedUp: "Increase playback speed (+0.25)",
    speedDown: "Decrease playback speed (-0.25)",
    showShortcuts: "Show shortcuts overlay",
};

export const DEFAULT_KEYBINDINGS: Record<ActionId, string> = {
    press: "Enter",
    back: "Escape",
    options: "o",
    action: "p",
    navUp: "ArrowUp",
    navDown: "ArrowDown",
    navLeft: "ArrowLeft",
    navRight: "ArrowRight",
    navUpAlt: "w",
    navDownAlt: "s",
    navLeftAlt: "a",
    navRightAlt: "d",
    theaterToggle: "t",
    windowMaximize: "v",
    speedUp: "x",
    speedDown: "z",
    showShortcuts: "?",
};

const [keybindings$, setKeybindingsInternal] = createSignal<Record<ActionId, string>>(DEFAULT_KEYBINDINGS);

SettingsBackend.persistGet("keyboardShortcuts", DEFAULT_KEYBINDINGS)
    .then((r: Partial<Record<ActionId, string>>) => setKeybindingsInternal({ ...DEFAULT_KEYBINDINGS, ...(r ?? {}) }))
    .catch(e => console.error("Failed to get persistent setting 'keyboardShortcuts'.", e));

export function keybindings() {
    return keybindings$();
}

export function getKeybinding(action: ActionId): string {
    return keybindings$()[action];
}

export function setKeybinding(action: ActionId, key: string) {
    const next = { ...keybindings$(), [action]: key };
    setKeybindingsInternal(next);
    SettingsBackend.persistSet("keyboardShortcuts", next);
}

export function resetKeybindings() {
    setKeybindingsInternal(DEFAULT_KEYBINDINGS);
    SettingsBackend.persistSet("keyboardShortcuts", DEFAULT_KEYBINDINGS);
}
