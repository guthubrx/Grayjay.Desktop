import { Component, For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import styles from './index.module.css';
import {
    ActionId,
    DEFAULT_KEYBINDINGS,
    KEYBINDING_LABELS,
    keybindings,
    resetKeybindings,
    setKeybinding,
} from '../../state/StateKeybindings';

const KEY_DISPLAY: Record<string, string> = {
    "ArrowUp": "↑",
    "ArrowDown": "↓",
    "ArrowLeft": "←",
    "ArrowRight": "→",
    "Escape": "Esc",
};
const display = (k: string) => KEY_DISPLAY[k] ?? k;

interface ShortcutsCustomizeOverlayProps {
    show: boolean;
    onClose: () => void;
}

const ACTIONS: ActionId[] = [
    "press", "back", "options", "action",
    "navUp", "navDown", "navLeft", "navRight",
    "navUpAlt", "navDownAlt", "navLeftAlt", "navRightAlt",
    "theaterToggle", "windowMaximize", "speedUp", "speedDown",
    "showShortcuts",
];

const ShortcutsCustomizeOverlay: Component<ShortcutsCustomizeOverlayProps> = (props) => {
    const [capturing$, setCapturing] = createSignal<ActionId | null>(null);

    const conflicts = createMemo(() => {
        const counts: Record<string, number> = {};
        const map = keybindings();
        for (const a of ACTIONS) counts[map[a]] = (counts[map[a]] ?? 0) + 1;
        const dup = new Set<string>();
        for (const k in counts) if (counts[k] > 1) dup.add(k);
        return dup;
    });

    const onKeyDown = (e: KeyboardEvent) => {
        const action = capturing$();
        if (!action) return;
        if (e.key === "Escape") {
            setCapturing(null);
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        if (e.key === "Tab" || e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") return;
        setKeybinding(action, e.key);
        setCapturing(null);
        e.preventDefault();
        e.stopPropagation();
    };

    onMount(() => window.addEventListener("keydown", onKeyDown, true));
    onCleanup(() => window.removeEventListener("keydown", onKeyDown, true));

    return (
        <Show when={props.show}>
            <div class={styles.backdrop} onClick={() => { setCapturing(null); props.onClose(); }}>
                <div class={styles.overlay} onClick={(e) => e.stopPropagation()}>
                    <div class={styles.header}>
                        <div class={styles.title}>Customize Shortcuts</div>
                        <div class={styles.close} onClick={() => { setCapturing(null); props.onClose(); }}>×</div>
                    </div>
                    <div class={styles.list}>
                        <For each={ACTIONS}>{(a) => (
                            <div class={styles.row}>
                                <div class={styles.label}>{KEYBINDING_LABELS[a]}</div>
                                <div
                                    class={`${styles.keyButton} ${capturing$() === a ? styles.capturing : ""} ${conflicts().has(keybindings()[a]) ? styles.conflict : ""}`}
                                    onClick={() => setCapturing(a)}
                                >
                                    {capturing$() === a ? "Press a key…" : display(keybindings()[a])}
                                </div>
                            </div>
                        )}</For>
                    </div>
                    <Show when={conflicts().size > 0}>
                        <div class={styles.warning}>The same key is bound to multiple actions.</div>
                    </Show>
                    <div class={styles.footer}>
                        <div class={styles.resetLink} onClick={() => resetKeybindings()}>Reset to defaults</div>
                    </div>
                </div>
            </div>
        </Show>
    );
};

export default ShortcutsCustomizeOverlay;
