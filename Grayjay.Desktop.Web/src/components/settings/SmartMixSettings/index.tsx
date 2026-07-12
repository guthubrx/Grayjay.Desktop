import { type Component, createEffect, createMemo, createSignal, For } from "solid-js";
import {
    smartMixDistribution$,
    setSmartMixDistribution,
} from "../../../state/StateSmartMix";
import type { SmartMixDistribution } from "../../../utils/smartMixComposer";
import { isValidSmartMixDistribution } from "../../../utils/smartMixSettings";
import styles from "./index.module.css";

const SETTINGS: { key: keyof SmartMixDistribution; label: string }[] = [
    { key: "close", label: "Same topic" },
    { key: "related", label: "Broaden" },
    { key: "newAngle", label: "New angle" },
];

const SmartMixSettings: Component = () => {
    const [draft$, setDraft] = createSignal<SmartMixDistribution>(smartMixDistribution$());

    createEffect(() => setDraft(smartMixDistribution$()));

    const total$ = createMemo(() => draft$().close + draft$().related + draft$().newAngle);
    const valid$ = createMemo(() => isValidSmartMixDistribution(draft$()));

    const update = (key: keyof SmartMixDistribution, rawValue: string) => {
        const value = Number(rawValue);
        setDraft(previous => ({ ...previous, [key]: Number.isFinite(value) ? value : 0 }));
    };

    const save = () => {
        if (valid$()) void setSmartMixDistribution(draft$());
    };

    return (
        <div class={styles.container}>
            <h1>Smart Mix</h1>
            <div class={styles.percentageList}>
                <For each={SETTINGS}>{setting => (
                    <label class={styles.percentageRow}>
                        <span>{setting.label}</span>
                        <span class={styles.percentageField}>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="5"
                                value={draft$()[setting.key]}
                                onInput={event => update(setting.key, event.currentTarget.value)}
                            />
                            <span>%</span>
                        </span>
                    </label>
                )}</For>
            </div>
            <div class={styles.footer}>
                <span classList={{ [styles.invalid]: !valid$() }}>Total {total$()}%</span>
                <button type="button" disabled={!valid$()} onClick={save}>Save</button>
            </div>
        </div>
    );
};

export default SmartMixSettings;
