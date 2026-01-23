import { Component, For, JSX, Show, createEffect, createMemo, createSignal } from 'solid-js'

import { focusable } from "../../focusable";  void focusable;
import styles from './index.module.css';
import { Direction, FocusableOptions } from '../../nav';

export interface ToggleButtonGroupItem {
    text: string;
    value: any;
    icon?: string;
};

interface ToggleItemButtonGroupProps {
    defaultSelectedValue?: any;
    items?: ToggleButtonGroupItem[];
    onValueChanged?: (item: any) => void;
    style?: JSX.CSSProperties;
    focusable?: boolean;
    onBack?: FocusableOptions["onBack"];
    focusableGroupOpts?: {
        groupId?: string;
        groupEscapeTo?: Partial<Record<Direction, string[]>>;
    };
};

const ToggleItemButtonGroup: Component<ToggleItemButtonGroupProps> = (props) => {
    const [selectedItem, setSelectedItem] = createSignal<any | undefined>(props.defaultSelectedValue);
    createEffect(() => {
        setSelectedItem(props.defaultSelectedValue);
    });

    const toggleItem = (item: ToggleButtonGroupItem) => {
        const next = selectedItem() !== item.value ? item.value : undefined;
        setSelectedItem(next);
        props.onValueChanged?.(next);
    };

    return (
        <div class={styles.containerGroup} style={{ ... props.style }}>
            <For each={props.items}>{(item, i) =>
                <>
                    <Show when={i() > 0}>
                        <div style="height: 100%; width: 1px; background-color: #454545;"></div>
                    </Show>
                    <div class={styles.containerButton} classList={{ [styles.active]: item.value == selectedItem() }} onClick={() => toggleItem(item)} use:focusable={props.focusable ? {
                        onPress: () => toggleItem(item),
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
                        <div>{item.text}</div>
                    </div>
                </>
            }</For>
        </div>
    );
};

export default ToggleItemButtonGroup;