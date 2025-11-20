import { Component, JSX } from 'solid-js'

import styles from './index.module.css';
import { focusable } from '../../../focusable'; void focusable;
import { FocusableOptions } from '../../../nav';

interface TransparentIconButtonProps {
    icon: string;
    alt?: string;
    onClick?: (event: MouseEvent) => void;
    ref?: HTMLDivElement | undefined
    style?: JSX.CSSProperties
    focusableOpts?: FocusableOptions;
}

const TransparentIconButton: Component<TransparentIconButtonProps> = (props) => {
    const handleClick = (event: MouseEvent) => {
        if (props.onClick) {
            props.onClick(event);
        }
    };

    return (
        <div class={styles.containerTransparentButton} ref={props.ref} style={{
            ... props.style,
            width: props.style?.width ?? '48px',
            height: props.style?.height ?? '48px'
        }} onClick={handleClick} use:focusable={props.focusableOpts}>
            <img
                class={styles.icon}
                src={props.icon}
                alt={props.alt || 'icon'}
            />
        </div>
    );
};

export default TransparentIconButton;