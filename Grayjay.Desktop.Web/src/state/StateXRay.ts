import { createSignal } from 'solid-js';
import { SettingsBackend } from '../backend/SettingsBackend';

export interface XRayState {
    opacity: number;
    fontSize: number;
    maxTheses: number;         // 0 = no limit
    globalSummaryChars: number; // 0 = no limit
    chapterSummaryChars: number; // 0 = no limit
    panelWidthPercent: number;  // largeur du volet en % de la largeur du player
    smartBlock: boolean;
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
    smartBlock: false,
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
        smartBlock:          xray?.smartBlock ?? false,
    });
}

export async function saveXRayPanelWidthPercent(percent: number) {
    setXRayState(prev => ({ ...prev, panelWidthPercent: percent }));
    await SettingsBackend.persistSet('xray.panelWidthPercent', percent);
}

// Échelle alignée sur les seuils des filtres. En dessous de "Smart" (< 0.55) =
// le filler "nul" : GRIS neutre (aucune couleur), nettement distinct du contenu
// retenu. À partir du seuil Smart, on colore vert -> jaune -> orange -> rouge.
// Pas de bleu (c'est l'accent de Grayjay). Le saut gris -> vert à 0.55 marque
// franchement la frontière entre "pas intéressant" et "intéressant".
//   < 0.55  = filler (gris, exclu par "Smart")
//   0.55    = vert vif (seuil "Smart")
//   ~0.86   = orange (seuil "Strong")
//   >= 0.93 = rouge  (seuil "Top")
const HEAT_STOPS: [number, [number, number, number]][] = [
    [0.15, [0x47, 0x4b, 0x4f]], // gris foncé neutre (filler bas)
    [0.53, [0x71, 0x76, 0x7a]], // gris moyen (filler juste sous le seuil)
    [0.55, [0x67, 0xc1, 0x6a]], // vert vif (seuil Smart) — saut gris -> vert
    [0.72, [0xd7, 0xcf, 0x3f]], // jaune
    [0.86, [0xf0, 0x8a, 0x24]], // orange
    [0.93, [0xe5, 0x3e, 0x3e]], // rouge (seuil Top)
];

export function scoreToRgb(score?: number | null): [number, number, number] {
    if (score == null) return HEAT_STOPS[0][1];
    const s = Math.max(0, Math.min(1, score));
    if (s <= HEAT_STOPS[0][0]) return HEAT_STOPS[0][1];
    for (let i = 1; i < HEAT_STOPS.length; i++) {
        const [p1, c1] = HEAT_STOPS[i - 1];
        const [p2, c2] = HEAT_STOPS[i];
        if (s <= p2) {
            const f = (s - p1) / (p2 - p1);
            return [
                Math.round(c1[0] + (c2[0] - c1[0]) * f),
                Math.round(c1[1] + (c2[1] - c1[1]) * f),
                Math.round(c1[2] + (c2[2] - c1[2]) * f),
            ];
        }
    }
    return HEAT_STOPS[HEAT_STOPS.length - 1][1];
}

export function scoreToColor(score?: number | null): string {
    const [r, g, b] = scoreToRgb(score);
    return `rgb(${r}, ${g}, ${b})`;
}

export function rgbString(c: [number, number, number]): string {
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export function mixRgb(a: [number, number, number], b: [number, number, number]): [number, number, number] {
    return [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2), Math.round((a[2] + b[2]) / 2)];
}
