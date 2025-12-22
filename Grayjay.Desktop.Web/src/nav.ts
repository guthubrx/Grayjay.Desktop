import { Accessor } from "solid-js";

export type PointerType = "pointerdown" | "pointerup" | "pointermove";
export type InputSource = "keyboard" | "pointer" | "gamepad";
export type Direction = "up" | "down" | "left" | "right" | "next" | "prev";
export type Press = "press" | "options" | "back" | "start" | "direction" | "action";
export type ScopeId = string;

export type NavAnchor =
  | "center"
  | "edges"
  | { x?: "left" | "center" | "right"; y?: "top" | "center" | "bottom" };

export interface FocusableOptions {
    disabled?: boolean;
    priority?: number;
    groupId?: string;
    groupType?: "grid" | "horizontal" | "vertical"; // required for 1D, inferred for 2D
    groupIndices?: (number | undefined)[]; // 1D: [i], grid: [r,c]
    groupEscapeDirs?: Direction[];
    groupEscapeTo?: Partial<Record<Direction, string[]>>;
    navAnchor?: NavAnchor;
    onPress?: (el: HTMLElement, inputSource: InputSource) => void;
    onPressLabel?: string;
    onOptions?: (el: HTMLElement, inputSource: InputSource) => void;
    onOptionsLabel?: string;
    onDirection?: (el: HTMLElement, direction: Direction, inputSource: InputSource) => boolean | undefined;
    onDirectionLabel?: string;
    onBack?: (el: HTMLElement, inputSource: InputSource) => boolean | undefined;
    onBackLabel?: string;
    onAction?: (el: HTMLElement, inputSource: InputSource) => void;
    onActionLabel?: string;
    getRect?: (el: HTMLElement) => DOMRect;
    focusInert?: Accessor<boolean>; //If true, don't claim focus by yourself
}

export type ScopeMode = 'off' | 'on' | 'trap';
export interface ScopeOptions {
    id?: ScopeId;
    initialMode?: ScopeMode; // defaults to 'on'
    defaultFocus?: () => HTMLElement | undefined;
}

export function isVisible(el: Element): boolean {
    if (!(el instanceof HTMLElement)) return false;
    if (el.hidden) return false;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

export function isFocusable(el: Element): el is HTMLElement {
    if (!(el instanceof HTMLElement)) return false;
    const tabIndex = el.tabIndex;
    const disabled = (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true";
    return !disabled && isVisible(el);
}

export function uid(prefix = "scope"): ScopeId {
    return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}