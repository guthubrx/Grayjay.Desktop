import { Component, For, JSX, Show, createEffect, createSignal } from 'solid-js'

import styles from './index.module.css';
import StateGlobal from '../../state/StateGlobal';
import { focusable } from "../../focusable";  void focusable;
import { Direction, FocusableOptions } from '../../nav';

export interface ToggleBigButtonGroupItemMulti {
    text: string;
    value: any;
    icon: string;
};

interface ToggleItemBigButtonGroupPropsMulti {
    defaultSelectedValues?: any[];
    items: ToggleBigButtonGroupItemMulti[];
    onValueChanged?: (items: any[]) => void;
    style?: JSX.CSSProperties;
    focusable?: boolean;
    onBack?: FocusableOptions["onBack"];
    focusableGroupOpts?: {
        groupId?: string;
        groupEscapeTo?: Partial<Record<Direction, string[]>>;
    };
};

const ToggleItemBigButtonGroupMulti: Component<ToggleItemBigButtonGroupPropsMulti> = (props) => {
    const [selectedItems, setSelectedItems] = createSignal<any[] | undefined>(props.defaultSelectedValues);
    createEffect(() => {
        setSelectedItems(props.defaultSelectedValues);
    });

    const selectItem = (item: ToggleBigButtonGroupItemMulti) => {
        const current = selectedItems() ?? [];
        const isSelected = current.some(v => v === item.value);
        const next = isSelected ? current.filter(v => v !== item.value) : [...current, item.value];
        setSelectedItems(next);
        props.onValueChanged?.(next);
    };

    return (
        <div class={styles.containerGroup}style={{ ... props.style }}>
            <For each={props.items}>{(item, i) =>
                <>
                    <div class={styles.containerButton} classList={{ [styles.active]: selectedItems()?.some(v => v === item.value) ?? false }} onClick={() => selectItem(item)} use:focusable={props.focusable ? {
                        onPress: () => selectItem(item),
                        onBack: props.onBack,
                        groupType: 'spatial',
                        groupIndices: [i()],
                        groupRememberLast: true,
                        groupEscapeDirs: ['up', 'down'],
                        ... props.focusableGroupOpts

                    } : undefined}>
                        <Show when={item.icon}>
                            <img src={item.icon} class={styles.icon} />
                        </Show>
                        <div style="margin-top: 6px;">{item.text}</div>
                    </div>
                </>
            }</For>
        </div>
    );
};

export default ToggleItemBigButtonGroupMulti;