export interface SubtitleAppearance {
    fontSize: string;
    fontFamily: string;
    textColor: string;
    textShadow: string;
    textBackground: string;
    windowBackground: string;
    windowPadding: string;
}

const textSizes = ["18px", "24px", "30px", "36px"];
const fontFamilies = [
    "InterVariable, sans-serif",
    "Georgia, serif",
    "ui-monospace, SFMono-Regular, Menlo, monospace",
];
const textColors = ["#FFFFFF", "#F9E547", "#75D6FF", "#8BE28B"];
const shadowColors = ["#000000", "#FFFFFF"];
const textBackgrounds = ["transparent", "rgba(0, 0, 0, 0.5)", "rgba(0, 0, 0, 0.8)", "rgba(255, 255, 255, 0.7)"];
const windowBackgrounds = ["transparent", "rgba(0, 0, 0, 0.35)", "rgba(0, 0, 0, 0.65)", "rgba(255, 255, 255, 0.45)"];

function valueAt<T>(values: T[], index: unknown, fallback: T): T {
    return typeof index === "number" && values[index] !== undefined ? values[index] : fallback;
}

export function subtitleAppearance(playback: any): SubtitleAppearance {
    const settings = playback?.subtitleAppearance;
    const shadowColor = valueAt(shadowColors, settings?.shadowColor, shadowColors[0]);
    const textShadow = settings?.textShadow === 1
        ? `-1px -1px 0 ${shadowColor}, 1px -1px 0 ${shadowColor}, -1px 1px 0 ${shadowColor}, 1px 1px 0 ${shadowColor}`
        : settings?.textShadow === 2
            ? `0 2px 5px ${shadowColor}`
            : "none";
    const windowBackground = valueAt(windowBackgrounds, settings?.captionWindow, windowBackgrounds[0]);

    return {
        fontSize: valueAt(textSizes, settings?.textSize, textSizes[1]),
        fontFamily: valueAt(fontFamilies, settings?.font, fontFamilies[0]),
        textColor: valueAt(textColors, settings?.textColor, textColors[0]),
        textShadow,
        textBackground: valueAt(textBackgrounds, settings?.textBackground, textBackgrounds[1]),
        windowBackground,
        windowPadding: windowBackground === "transparent" ? "0" : "4px",
    };
}
