import { type Component } from "solid-js";

import Toggle from "../../basics/inputs/Toggle";
import {
    setSmartPrefillSettings,
    smartPrefillSettings$,
} from "../../../state/StateSmartPrefill";
import styles from "./index.module.css";

const SmartPrefillSettings: Component = () => {
    const updateNumber = (key: "llmParallelism" | "maxCandidatesPerSource" | "preparationDepth" | "maxQueuedJobs", value: string) => {
        void setSmartPrefillSettings({ [key]: Number(value) });
    };

    return (
        <div class={styles.container}>
            <h1>Smart Prefill</h1>
            <div class={styles.settingRow}>
                <div>
                    <div class={styles.label}>Enable Smart Prefill</div>
                    <div class={styles.help}>Prepare likely next videos without delaying playback.</div>
                </div>
                <Toggle value={smartPrefillSettings$().enabled} onToggle={enabled => void setSmartPrefillSettings({ enabled })} />
            </div>
            <label class={styles.settingRow}>
                <span>
                    <span class={styles.label}>LLM parallelism</span>
                    <span class={styles.help}>Shared limit for BlueJay Smart Prefill jobs.</span>
                </span>
                <input class={styles.numberInput} type="number" min="1" max="32" step="1" value={smartPrefillSettings$().llmParallelism} onChange={event => updateNumber("llmParallelism", event.currentTarget.value)} />
            </label>
            <label class={styles.settingRow}>
                <span>
                    <span class={styles.label}>Subtitle probe candidates</span>
                    <span class={styles.help}>Maximum candidates inspected when a source becomes available.</span>
                </span>
                <input class={styles.numberInput} type="number" min="1" max="100" step="1" value={smartPrefillSettings$().maxCandidatesPerSource} onChange={event => updateNumber("maxCandidatesPerSource", event.currentTarget.value)} />
            </label>
            <label class={styles.settingRow}>
                <span>
                    <span class={styles.label}>Preparation depth</span>
                    <span class={styles.help}>Number of future videos prepared after the one currently playing.</span>
                </span>
                <input class={styles.numberInput} type="number" min="0" max="100" step="1" value={smartPrefillSettings$().preparationDepth} onChange={event => updateNumber("preparationDepth", event.currentTarget.value)} />
            </label>
            <label class={styles.settingRow}>
                <span>
                    <span class={styles.label}>Maximum queued analyses</span>
                    <span class={styles.help}>Automatic jobs waiting for an LLM slot; manual requests stay eligible.</span>
                </span>
                <input class={styles.numberInput} type="number" min="1" max="500" step="1" value={smartPrefillSettings$().maxQueuedJobs} onChange={event => updateNumber("maxQueuedJobs", event.currentTarget.value)} />
            </label>
            <div class={styles.sectionTitle}>Sources</div>
            <div class={styles.settingRow}>
                <span class={styles.label}>Smart Mix candidates</span>
                <Toggle value={smartPrefillSettings$().smartMix} onToggle={smartMix => void setSmartPrefillSettings({ smartMix })} />
            </div>
            <div class={styles.settingRow}>
                <span class={styles.label}>Next video in queue</span>
                <Toggle value={smartPrefillSettings$().nextInQueue} onToggle={nextInQueue => void setSmartPrefillSettings({ nextInQueue })} />
            </div>
            <div class={styles.settingRow}>
                <span class={styles.label}>Smart TV sessions</span>
                <Toggle value={smartPrefillSettings$().smartTv} onToggle={smartTv => void setSmartPrefillSettings({ smartTv })} />
            </div>
            <div class={styles.settingRow}>
                <span class={styles.label}>Watch now</span>
                <Toggle value={smartPrefillSettings$().watchNow} onToggle={watchNow => void setSmartPrefillSettings({ watchNow })} />
            </div>
            <div class={styles.settingRow}>
                <span>
                    <span class={styles.label}>Subscription groups</span>
                    <span class={styles.help}>Applies to videos exposed by your subscription-group rows.</span>
                </span>
                <Toggle value={smartPrefillSettings$().priorityGroup} onToggle={priorityGroup => void setSmartPrefillSettings({ priorityGroup })} />
            </div>
        </div>
    );
};

export default SmartPrefillSettings;
