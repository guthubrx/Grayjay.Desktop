import { Component, For, Show } from 'solid-js';
import styles from './index.module.css';

interface ShortcutEntry {
    keys: string[];
    description: string;
}

const shortcuts: ShortcutEntry[] = [
    { keys: ["Enter"], description: "Activate focused element" },
    { keys: ["Esc"], description: "Go back / close overlay" },
    { keys: ["Tab"], description: "Focus next element" },
    { keys: ["Shift", "Tab"], description: "Focus previous element" },
    { keys: ["↑", "↓", "←", "→"], description: "Navigate" },
    { keys: ["W", "A", "S", "D"], description: "Navigate (alternative)" },
    { keys: ["O"], description: "Open options menu" },
    { keys: ["P"], description: "Action on focused element" },
    { keys: ["?"], description: "Show this overlay" },
];

interface ShortcutsOverlayProps {
    show: boolean;
    onClose: () => void;
}

const ShortcutsOverlay: Component<ShortcutsOverlayProps> = (props) => {
    return (
        <Show when={props.show}>
            <div class={styles.backdrop} onClick={() => props.onClose()}>
                <div class={styles.overlay} onClick={(e) => e.stopPropagation()}>
                    <div class={styles.header}>
                        <div class={styles.title}>Keyboard Shortcuts</div>
                        <div class={styles.close} onClick={() => props.onClose()}>×</div>
                    </div>
                    <div class={styles.list}>
                        <For each={shortcuts}>{(s) => (
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
                </div>
            </div>
        </Show>
    );
};

export default ShortcutsOverlay;
