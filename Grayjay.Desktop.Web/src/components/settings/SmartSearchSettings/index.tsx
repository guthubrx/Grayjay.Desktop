import { Component, For, createEffect, createSignal } from "solid-js";

import Button from "../../buttons/Button";
import InputText from "../../basics/inputs/InputText";
import Toggle from "../../basics/inputs/Toggle";
import {
    SMART_SEARCH_LANGUAGE_OPTIONS,
    setSmartSearchAutoStart,
    setSmartSearchLanguages,
    setTranslatorCommand,
    smartSearchAutoStart$,
    smartSearchLanguages$,
    translatorCommand$
} from "../../../state/StateSmartSearch";
import styles from "./index.module.css";

const SmartSearchSettings: Component = () => {
    const [command$, setCommand] = createSignal(translatorCommand$());

    createEffect(() => setCommand(translatorCommand$()));

    const toggleLanguage = (language: string) => {
        const selected = smartSearchLanguages$();
        const next = selected.includes(language)
            ? selected.filter(value => value !== language)
            : [...selected, language];
        void setSmartSearchLanguages(next);
    };

    return (
        <div class={styles.container}>
            <h1>Smart Search</h1>
            <div class={styles.settingRow}>
                <div class={styles.label}>Start automatically</div>
                <Toggle value={smartSearchAutoStart$()} onToggle={value => void setSmartSearchAutoStart(value)} />
            </div>
            <div class={styles.field}>
                <div class={styles.label}>Search languages</div>
                <div class={styles.languageGrid}>
                    <For each={SMART_SEARCH_LANGUAGE_OPTIONS}>{option => {
                        const selected = () => smartSearchLanguages$().includes(option.code);
                        const disabled = () => !selected() && smartSearchLanguages$().length >= 4;
                        return (
                            <button
                                type="button"
                                class={styles.languageButton}
                                classList={{ [styles.selected]: selected(), [styles.disabled]: disabled() }}
                                disabled={disabled()}
                                onClick={() => toggleLanguage(option.code)}>
                                {option.label}
                            </button>
                        );
                    }}</For>
                </div>
            </div>
            <div class={styles.field}>
                <div class={styles.label}>Translator command</div>
                <div class={styles.commandRow}>
                    <InputText value={command$()} onTextChanged={setCommand} />
                    <Button text="Save" onClick={() => void setTranslatorCommand(command$())} />
                </div>
            </div>
        </div>
    );
};

export default SmartSearchSettings;
