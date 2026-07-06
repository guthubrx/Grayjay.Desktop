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

// Dégradé thermique continu : froid (bleu = peu intéressant) -> chaud (rouge =
// passionnant). Remplace les 4 paliers pour donner du relief continu. La plage
// réellement utilisée par le modèle (~0.45-0.95) est étirée sur tout le spectre
// pour maximiser le contraste.
const HEAT_STOPS: [number, [number, number, number]][] = [
    [0.00, [0x01, 0x9B, 0xE8]], // bleu froid
    [0.28, [0x1f, 0xb6, 0xa6]], // cyan / teal
    [0.50, [0x7f, 0xb0, 0x8f]], // vert
    [0.68, [0xf4, 0xd0, 0x3f]], // jaune
    [0.84, [0xf0, 0x8a, 0x24]], // orange
    [1.00, [0xe5, 0x3e, 0x3e]], // rouge chaud
];

export function scoreToColor(score?: number | null): string {
    if (score == null) return "#019BE8";
    let t = (score - 0.45) / (0.95 - 0.45);
    t = Math.max(0, Math.min(1, t));
    for (let i = 1; i < HEAT_STOPS.length; i++) {
        const [p1, c1] = HEAT_STOPS[i - 1];
        const [p2, c2] = HEAT_STOPS[i];
        if (t <= p2) {
            const f = (t - p1) / (p2 - p1);
            const r = Math.round(c1[0] + (c2[0] - c1[0]) * f);
            const g = Math.round(c1[1] + (c2[1] - c1[1]) * f);
            const b = Math.round(c1[2] + (c2[2] - c1[2]) * f);
            return `rgb(${r}, ${g}, ${b})`;
        }
    }
    return "#e53e3e";
}
