export const SMART_PREFILL_SOURCES = [
    "smart-mix",
    "next-in-queue",
    "smart-tv",
    "watch-now",
    "priority-group",
] as const;

export type SmartPrefillSource = typeof SMART_PREFILL_SOURCES[number];

export interface SmartPrefillSettings {
    enabled: boolean;
    llmParallelism: number;
    maxCandidatesPerSource: number;
    preparationDepth: number;
    maxQueuedJobs: number;
    smartMix: boolean;
    nextInQueue: boolean;
    smartTv: boolean;
    watchNow: boolean;
    priorityGroup: boolean;
}

export const DEFAULT_SMART_PREFILL_SETTINGS: SmartPrefillSettings = {
    enabled: false,
    llmParallelism: 3,
    maxCandidatesPerSource: 12,
    preparationDepth: 1,
    maxQueuedJobs: 24,
    smartMix: true,
    nextInQueue: true,
    smartTv: true,
    watchNow: true,
    priorityGroup: true,
};

export interface PrefillVideoCandidate {
    url?: string;
    backendUrl?: string;
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
}

export function normalizeSmartPrefillSettings(value: unknown): SmartPrefillSettings {
    const settings = value && typeof value === "object" ? value as Partial<SmartPrefillSettings> : {};
    return {
        enabled: typeof settings.enabled === "boolean" ? settings.enabled : DEFAULT_SMART_PREFILL_SETTINGS.enabled,
        llmParallelism: clampInteger(settings.llmParallelism, DEFAULT_SMART_PREFILL_SETTINGS.llmParallelism, 1, 32),
        maxCandidatesPerSource: clampInteger(settings.maxCandidatesPerSource, DEFAULT_SMART_PREFILL_SETTINGS.maxCandidatesPerSource, 1, 100),
        preparationDepth: clampInteger(settings.preparationDepth, DEFAULT_SMART_PREFILL_SETTINGS.preparationDepth, 0, 100),
        maxQueuedJobs: clampInteger(settings.maxQueuedJobs, DEFAULT_SMART_PREFILL_SETTINGS.maxQueuedJobs, 1, 500),
        smartMix: typeof settings.smartMix === "boolean" ? settings.smartMix : DEFAULT_SMART_PREFILL_SETTINGS.smartMix,
        nextInQueue: typeof settings.nextInQueue === "boolean" ? settings.nextInQueue : DEFAULT_SMART_PREFILL_SETTINGS.nextInQueue,
        smartTv: typeof settings.smartTv === "boolean" ? settings.smartTv : DEFAULT_SMART_PREFILL_SETTINGS.smartTv,
        watchNow: typeof settings.watchNow === "boolean" ? settings.watchNow : DEFAULT_SMART_PREFILL_SETTINGS.watchNow,
        priorityGroup: typeof settings.priorityGroup === "boolean" ? settings.priorityGroup : DEFAULT_SMART_PREFILL_SETTINGS.priorityGroup,
    };
}

export function isSmartPrefillSourceEnabled(settings: SmartPrefillSettings, source: SmartPrefillSource): boolean {
    return source === "smart-mix" ? settings.smartMix
        : source === "next-in-queue" ? settings.nextInQueue
        : source === "smart-tv" ? settings.smartTv
        : source === "watch-now" ? settings.watchNow
        : settings.priorityGroup;
}

export function smartPrefillUrlKey(url: string | undefined): string | undefined {
    if (!url?.trim()) return undefined;
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
        if (host.endsWith("youtube.com")) {
            const id = parsed.searchParams.get("v");
            if (id) return `youtube:${id}`;
        }
        if (host === "youtu.be") {
            const id = parsed.pathname.split("/").filter(Boolean)[0];
            if (id) return `youtube:${id}`;
        }
        return `${host}${parsed.pathname}${parsed.search}`.toLowerCase();
    } catch {
        return url.trim().replace(/\/+$/, "").toLowerCase();
    }
}

export function takePrefillCandidates<T extends PrefillVideoCandidate>(
    candidates: T[],
    maximum: number,
    scheduled: Set<string>,
): T[] {
    const selected: T[] = [];
    for (const candidate of candidates) {
        if (selected.length >= maximum) break;
        const url = candidate.url ?? candidate.backendUrl;
        const key = smartPrefillUrlKey(url);
        if (!key || scheduled.has(key)) continue;
        scheduled.add(key);
        selected.push(candidate);
    }
    return selected;
}

export function takeUniquePrefillCandidates<T extends PrefillVideoCandidate>(candidates: T[], maximum: number): T[] {
    const selected: T[] = [];
    const seen = new Set<string>();
    for (const candidate of candidates) {
        if (selected.length >= maximum) break;
        const key = smartPrefillUrlKey(candidate.url ?? candidate.backendUrl);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        selected.push(candidate);
    }
    return selected;
}

export function takePreparationWindow<T>(videos: T[], currentIndex: number, depth: number): T[] {
    const start = Math.max(0, currentIndex);
    return videos.slice(start, start + Math.max(0, depth) + 1);
}
