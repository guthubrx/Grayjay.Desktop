import { Component, JSX, createMemo } from 'solid-js';

import styles from './index.module.css';
import { focusable } from "../../../focusable"; void focusable;
import { FocusableOptions } from '../../../nav';

type IconButtonVariant = 'solid' | 'ghost' | 'none';
type IconButtonShape = 'circle' | 'rounded';

interface IconButtonProps {
    icon: string;
    alt?: string;
    onClick?: (event: MouseEvent) => void;
    ref?: HTMLDivElement | undefined;
    style?: JSX.CSSProperties;
    focusableOpts?: FocusableOptions;
    width?: string;
    height?: string;
    iconPadding?: string;
    iconInset?: string;
    variant?: IconButtonVariant;
    shape?: IconButtonShape;
    focusColor?: string;
    iconFilterFocus?: string;
}

const IconButton: Component<IconButtonProps> = (props) => {
    const variant = () => props.variant ?? 'solid';
    const shape = () => props.shape ?? 'circle';

    const computedStyle = createMemo(() => {
        const bgFocus = props.focusColor ?? '#fff';
        const iconFilterFocus =
            props.iconFilterFocus ??
            (props.focusColor ? 'none' : 'brightness(0) saturate(100%)');

        return {
            ...props.style,
            width: props.width || '32px',
            height: props.height || '32px',
            padding: props.iconPadding || '0px',
            '--ib-inset': props.iconInset || '4px',
            '--ib-bg-focus': bgFocus,
            '--ib-icon-filter-focus': iconFilterFocus,
        } as JSX.CSSProperties & Record<string, string>;
    });

    return (
        <div
            classList={{
                [styles.container]: true,
                [styles.solid]: variant() === 'solid',
                [styles.ghost]: variant() === 'ghost',
                [styles.none]: variant() === 'none',
                [styles.circle]: shape() === 'circle',
                [styles.rounded]: shape() === 'rounded',
            }}
            ref={props.ref}
            style={computedStyle()}
            onClick={(ev) => props.onClick?.(ev)}
            use:focusable={props.focusableOpts}
        >
            <img class={styles.icon} src={props.icon} alt={props.alt || 'icon'} />
        </div>
    );
};

export default IconButton;
