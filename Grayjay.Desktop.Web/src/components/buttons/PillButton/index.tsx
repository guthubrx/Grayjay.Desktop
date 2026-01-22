import { Component, JSX, createMemo } from 'solid-js';

import styles from './index.module.css';
import { focusable } from "../../../focusable"; void focusable;
import { FocusableOptions } from '../../../nav';

interface PillButtonProps {
    icon: string;
    text: string;
    onClick?: () => void;
    focusableOpts?: FocusableOptions;
    color?: string;
    focusColor?: string;
    textColor?: string;
    focusTextColor?: string;
    style?: JSX.CSSProperties;
}

const PillButton: Component<PillButtonProps> = (props) => {
    const style = createMemo(() => {
        const bg = props.color ?? '#212122';
        const bgFocus = props.focusColor ?? '#fff';
        const text = props.textColor ?? '#fff';
        const textFocus = props.focusTextColor ?? (props.focusColor ? text : '#141414');
        const iconFilterFocus = props.focusColor ? 'none' : 'brightness(0) saturate(100%)';

        return {
            ...props.style,
            '--pill-bg': bg,
            '--pill-bg-focus': bgFocus,
            '--pill-text': text,
            '--pill-text-focus': textFocus,
            '--pill-icon-filter-focus': iconFilterFocus,
        } as JSX.CSSProperties & Record<string, string>;
    });

    return (
        <div
            class={styles.container}
            style={style()}
            onClick={() => props.onClick?.()}
            use:focusable={props.focusableOpts}
        >
            <img class={styles.icon} src={props.icon} alt={props.text} />
            <div class={styles.text}>{props.text}</div>
        </div>
    );
};

export default PillButton;
