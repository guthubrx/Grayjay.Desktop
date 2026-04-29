import { Component, For, Show, createMemo, createSignal } from 'solid-js';
import styles from './index.module.css';
import { getKeybinding, KEYBINDING_LABELS } from '../../state/StateKeybindings';
import ShortcutsCustomizeOverlay from '../ShortcutsCustomizeOverlay';

const KEY_DISPLAY: Record<string, string> = {
    "ArrowUp": "↑",
    "ArrowDown": "↓",
    "ArrowLeft": "←",
    "ArrowRight": "→",
    "Escape": "Esc",
};
const display = (k: string) => KEY_DISPLAY[k] ?? k;

interface ShortcutsOverlayProps {
    show: boolean;
    onClose: () => void;
}

const ShortcutsOverlay: Component<ShortcutsOverlayProps> = (props) => {
    const [showCustomize$, setShowCustomize] = createSignal(false);

    const rows = createMemo(() => [
        { keys: [display(getKeybinding("press"))], description: KEYBINDING_LABELS.press },
        { keys: [display(getKeybinding("back"))], description: KEYBINDING_LABELS.back },
        { keys: ["Tab"], description: "Focus next element" },
        { keys: ["Shift", "Tab"], description: "Focus previous element" },
        { keys: [display(getKeybinding("navUp")), display(getKeybinding("navDown")), display(getKeybinding("navLeft")), display(getKeybinding("navRight"))], description: "Navigate" },
        { keys: [display(getKeybinding("navUpAlt")), display(getKeybinding("navDownAlt")), display(getKeybinding("navLeftAlt")), display(getKeybinding("navRightAlt"))].map(k => k.toUpperCase()), description: "Navigate (alternative)" },
        { keys: [display(getKeybinding("options"))], description: KEYBINDING_LABELS.options },
        { keys: [display(getKeybinding("action"))], description: KEYBINDING_LABELS.action },
        { keys: [display(getKeybinding("showShortcuts"))], description: KEYBINDING_LABELS.showShortcuts },
    ]);

    return (
        <>
            <Show when={props.show}>
                <div class={styles.backdrop} onClick={() => props.onClose()}>
                    <div class={styles.overlay} onClick={(e) => e.stopPropagation()}>
                        <div class={styles.header}>
                            <div class={styles.title}>Keyboard Shortcuts</div>
                            <div class={styles.close} onClick={() => props.onClose()}>×</div>
                        </div>
                        <div class={styles.list}>
                            <For each={rows()}>{(s) => (
                                <div class={styles.row}>
                                    <div class={styles.keys}>
                                        <For each={s.keys}>{(k, i) => (
                                            <>
                                                <Show when={i() > 0}><span class={styles.plus}>+</span></Show>
                                                <kbd class={styles.kbd}>{k}</kbd>
                                            </>
                                        )}</For>
                                    </div>
                                    <div class={styles.description}>{s.description}</div>
                                </div>
                            )}</For>
                        </div>
                        <div class={styles.footer}>
                            <div class={styles.customizeLink} onClick={() => setShowCustomize(true)}>Customize…</div>
                        </div>
                    </div>
                </div>
            </Show>
            <ShortcutsCustomizeOverlay show={showCustomize$()} onClose={() => setShowCustomize(false)} />
        </>
    );
};

export default ShortcutsOverlay;
