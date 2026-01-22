import { Component, JSX, Show, createMemo } from 'solid-js';

import styles from './index.module.css';
import { focusable } from "../../../focusable"; void focusable;
import { FocusableOptions } from '../../../nav';

interface CustomButtonProps {
  icon?: string;
  text: string;

  style?: JSX.CSSProperties;
  iconStyle?: JSX.CSSProperties;
  textStyle?: JSX.CSSProperties;

  background?: string;
  border?: string;
  focusColor?: string;
  textColor?: string;
  focusTextColor?: string;
  iconFilterFocus?: string;

  onClick?: (event: MouseEvent) => void;
  onMouseDown?: (event: MouseEvent) => void;
  focusableOpts?: FocusableOptions;
}

const CustomButton: Component<CustomButtonProps> = (props) => {
  const computedStyle = createMemo(() => {
    const raw = (props.style ?? {}) as Record<string, any>;

    const bg =
      props.background ??
      raw.background ??
      raw.backgroundColor ??
      raw['background-color'] ??
      '#212122';

    const border = props.border ?? raw.border ?? 'none';

    const text =
      props.textColor ??
      raw.color ??
      '#fff';

    const bgFocus = props.focusColor ?? '#fff';
    const textFocus = props.focusTextColor ?? (props.focusColor ? text : '#141414');
    const iconFilterFocus =
      props.iconFilterFocus ?? (props.focusColor ? 'none' : 'brightness(0) saturate(100%)');

    const rest = { ...raw };
    delete rest.background;
    delete rest.backgroundColor;
    delete rest['background-color'];
    delete rest.border;
    delete rest.color;

    return {
      ...rest,
      '--cb-bg': bg,
      '--cb-bg-focus': bgFocus,
      '--cb-border': border,
      '--cb-text': text,
      '--cb-text-focus': textFocus,
      '--cb-icon-filter-focus': iconFilterFocus,
    } as JSX.CSSProperties & Record<string, string>;
  });

  const cleanedTextStyle = createMemo(() => {
    const raw = (props.textStyle ?? {}) as Record<string, any>;
    const rest = { ...raw };
    delete rest.color;
    return rest as JSX.CSSProperties;
  });

  return (
    <div
      class={styles.container}
      style={computedStyle()}
      onClick={props.onClick}
      onMouseDown={props.onMouseDown}
      use:focusable={props.focusableOpts}
    >
      <Show when={props.icon}>
        <img src={props.icon} class={styles.icon} alt={props.text} style={props.iconStyle} />
      </Show>
      <div class={styles.text} style={cleanedTextStyle()}>{props.text}</div>
    </div>
  );
};

export default CustomButton;
