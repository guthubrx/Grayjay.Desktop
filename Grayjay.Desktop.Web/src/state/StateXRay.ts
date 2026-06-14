import { createSignal } from 'solid-js';
import { SettingsBackend } from '../backend/SettingsBackend';

export interface XRayState {
    opacity: number;
    fontSize: number;
    maxTheses: number;         // 0 = no limit
    globalSummaryChars: number; // 0 = no limit
    chapterSummaryChars: number; // 0 = no limit
    panelWidthPercent: number;  // largeur du volet en % de la largeur du player
}

const OPACITY_MAP    = [0.30, 0.45, 0.55, 0.68, 0.80, 0.92];
const FONT_SIZE_MAP  = Array.from({ length: 26 }, (_, i) => 5 + i); // 5px .. 30px
const FONT_SIZE_DEFAULT_INDEX = 9; // 14px
const GLOBAL_SUMMARY_MAP  = [0, 100, 200, 350, 500];
const CHAPTER_SUMMARY_MAP = [0, 80, 150, 250, 400];

export const MIN_WIDTH_PCT = 15;
export const MAX_WIDTH_PCT = 55;

const DEFAULTS: XRayState = {
    opacity: 0.68,
    fontSize: 14,
    maxTheses: 0,
    globalSummaryChars: 0,
    chapterSummaryChars: 150,
    panelWidthPercent: 25,
};

const [xRayState$, setXRayState] = createSignal<XRayState>({ ...DEFAULTS });

Promise.all([
    SettingsBackend.settings(),
    SettingsBackend.persistGet('xray.panelWidthPercent', null),
]).then(([settings, width]) => {
    applyXRayFromSettings(settings?.object, width);
}).catch(() => {});

export { xRayState$ };

export function applyXRayFromSettings(obj: any, panelWidthPercent?: any) {
    const xray = obj?.xrayPanel;
    const validPct = typeof panelWidthPercent === 'number'
        && panelWidthPercent >= MIN_WIDTH_PCT
        && panelWidthPercent <= MAX_WIDTH_PCT;
    setXRayState({
        opacity:             OPACITY_MAP[xray?.opacity ?? 3] ?? 0.68,
        fontSize:            FONT_SIZE_MAP[xray?.fontSize ?? FONT_SIZE_DEFAULT_INDEX] ?? 14,
        maxTheses:           xray?.maxTheses ?? 0,
        globalSummaryChars:  GLOBAL_SUMMARY_MAP[xray?.globalSummaryChars ?? 0] ?? 0,
        chapterSummaryChars: CHAPTER_SUMMARY_MAP[xray?.chapterSummaryChars ?? 2] ?? 150,
        panelWidthPercent:   validPct ? panelWidthPercent : xRayState$().panelWidthPercent,
    });
}

export async function saveXRayPanelWidthPercent(percent: number) {
    setXRayState(prev => ({ ...prev, panelWidthPercent: percent }));
    await SettingsBackend.persistSet('xray.panelWidthPercent', percent);
}
