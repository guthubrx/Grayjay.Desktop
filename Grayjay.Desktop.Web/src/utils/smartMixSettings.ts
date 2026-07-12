import type { SmartMixDistribution } from "./smartMixComposer";

export const DEFAULT_SMART_MIX_DISTRIBUTION: SmartMixDistribution = {
    close: 60,
    related: 25,
    newAngle: 15,
};

function isValidPercentage(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100 && value % 5 === 0;
}

export function normalizeSmartMixDistribution(value: unknown): SmartMixDistribution {
    if (!value || typeof value !== "object") return DEFAULT_SMART_MIX_DISTRIBUTION;
    const candidate = value as Partial<SmartMixDistribution>;
    if (!isValidPercentage(candidate.close) || !isValidPercentage(candidate.related) || !isValidPercentage(candidate.newAngle))
        return DEFAULT_SMART_MIX_DISTRIBUTION;
    if (candidate.close + candidate.related + candidate.newAngle !== 100)
        return DEFAULT_SMART_MIX_DISTRIBUTION;
    return {
        close: candidate.close,
        related: candidate.related,
        newAngle: candidate.newAngle,
    };
}

export function isValidSmartMixDistribution(value: unknown): value is SmartMixDistribution {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<SmartMixDistribution>;
    return isValidPercentage(candidate.close)
        && isValidPercentage(candidate.related)
        && isValidPercentage(candidate.newAngle)
        && candidate.close + candidate.related + candidate.newAngle === 100;
}
