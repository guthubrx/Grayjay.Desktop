import { Component, For, createEffect, createSignal } from "solid-js";

import Button from "../../buttons/Button";
import Dropdown from "../../basics/inputs/Dropdown";
import InputText from "../../basics/inputs/InputText";
import Toggle from "../../basics/inputs/Toggle";
import {
    SMART_SEARCH_LANGUAGE_OPTIONS,
    setSmartSearchAutoStart,
    setSmartSearchLanguages,
    setSmartSearchResultLayout,
    setSmartSearchTitleDisplay,
    setSmartSearchTranslateCreatorNames,
    setTranslatorCommand,
    smartSearchAutoStart$,
    smartSearchLanguages$,
    smartSearchResultLayout$,
    smartSearchTitleDisplay$,
    smartSearchTranslateCreatorNames$,
    translatorCommand$
} from "../../../state/StateSmartSearch";
import styles from "./index.module.css";

const SmartSearchSettings: Component = () => {
    const [command$, setCommand] = createSignal(translatorCommand$());

    createEffect(() => setCommand(translatorCommand$()));

    const updateLanguage = (slot: number, language: string) => {
        const selected = smartSearchLanguages$();
        const next = selected
            .filter((_, index) => index !== slot)
            .filter(value => value !== language);
        if (language)
            next.splice(slot, 0, language);
        void setSmartSearchLanguages(next);
    };

    const languageOptions = (slot: number) => {
        const selected = smartSearchLanguages$();
        const selectedLanguage = selected[slot];
        return [
            { code: "", label: "No language" },
            ...SMART_SEARCH_LANGUAGE_OPTIONS.filter(option => option.code === selectedLanguage || !selected.includes(option.code))
        ];
    };

    return (
        <div class={styles.container}>
            <h1>Smart Search</h1>
            <div class={styles.settingRow}>
                <div class={styles.label}>Start automatically</div>
                <Toggle value={smartSearchAutoStart$()} onToggle={value => void setSmartSearchAutoStart(value)} />
            </div>
            <div class={styles.settingRow}>
                <div class={styles.label}>Title display</div>
                <Dropdown
                    options={["Original + translation", "Translated title only"]}
                    value={smartSearchTitleDisplay$() === "translated" ? 1 : 0}
                    onSelectedChanged={index => void setSmartSearchTitleDisplay(index === 1 ? "translated" : "both")}
                    style={{ width: "260px" }}
                />
            </div>
            <div class={styles.settingRow}>
                <div class={styles.label}>Translate channel names</div>
                <Toggle value={smartSearchTranslateCreatorNames$()} onToggle={value => void setSmartSearchTranslateCreatorNames(value)} />
            </div>
            <div class={styles.settingRow}>
                <div class={styles.label}>Result layout</div>
                <Dropdown
                    options={["Group by language", "Mix all results"]}
                    value={smartSearchResultLayout$() === "mixed" ? 1 : 0}
                    onSelectedChanged={index => void setSmartSearchResultLayout(index === 1 ? "mixed" : "grouped")}
                    style={{ width: "260px" }}
                />
            </div>
            <div class={styles.field}>
                <div class={styles.label}>Search languages</div>
                <div class={styles.languageList}>
                    <For each={[0, 1, 2, 3, 4, 5]}>{slot => {
                        const options = () => languageOptions(slot);
                        const selectedIndex = () => options().findIndex(option => option.code === smartSearchLanguages$()[slot]);
                        return (
                            <Dropdown
                                label={`Language ${slot + 1}`}
                                options={options().map(option => option.label)}
                                value={Math.max(0, selectedIndex())}
                                onSelectedChanged={index => updateLanguage(slot, options()[index]?.code ?? "")}
                                style={{ width: "100%" }}
                            />
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
