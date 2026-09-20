import { createSignal } from "solid-js";
import type { IPlatformVideo } from "../backend/models/content/IPlatformVideo";
import { HighlightsBackend, type HighlightPrefillPriority } from "../backend/HighlightsBackend";
import { Backend } from "../backend/Backend";
import { SettingsBackend } from "../backend/SettingsBackend";
import { configurePrefillParallelism, hasGeneratorCommand, prefillVideo } from "./StateHighlightsIndexer";
import { smartSearchSubtitleTranslationLanguages$ } from "./StateSmartSearch";
import {
    DEFAULT_SMART_PREFILL_SETTINGS,
    isSmartPrefillSourceEnabled,
    normalizeSmartPrefillSettings,
    type SmartPrefillSettings,
    type SmartPrefillSource,
    smartPrefillUrlKey,
    takePrefillCandidates,
    takePreparationWindow,
    takeUniquePrefillCandidates,
} from "../utils/smartPrefill";

const [smartPrefillSettings$, setSmartPrefillSettingsSignal] = createSignal<SmartPrefillSettings>(DEFAULT_SMART_PREFILL_SETTINGS);
const [smartPrefillSettingsReady$, setSmartPrefillSettingsReadySignal] = createSignal(false);
const scheduledUrls = new Set<string>();
const subtitleAvailability = new Map<string, boolean>();

(async () => {
    try {
        const raw: any = await Backend.GET("/settings/PersistGet?key=smartPrefill.settings");
        const value = typeof raw === "string" ? JSON.parse(raw) : raw;
        const settings = normalizeSmartPrefillSettings(value);
        setSmartPrefillSettingsSignal(settings);
        await configurePrefillParallelism(settings.llmParallelism, settings.maxQueuedJobs);
    } catch {
        // Smart Prefill reste une option ; le navigateur continue sans l'API locale.
    } finally {
        setSmartPrefillSettingsReadySignal(true);
    }
})();

export { smartPrefillSettings$, smartPrefillSettingsReady$ };

async function persist(settings: SmartPrefillSettings) {
    setSmartPrefillSettingsSignal(settings);
    await SettingsBackend.persistSet("smartPrefill.settings", settings);
    await configurePrefillParallelism(settings.llmParallelism, settings.maxQueuedJobs);
}

export async function setSmartPrefillSettings(next: Partial<SmartPrefillSettings>) {
    await persist(normalizeSmartPrefillSettings({ ...smartPrefillSettings$(), ...next }));
}

function canPrefill(source: SmartPrefillSource): boolean {
    const settings = smartPrefillSettings$();
    return smartPrefillSettingsReady$() && settings.enabled && isSmartPrefillSourceEnabled(settings, source) && hasGeneratorCommand();
}

export function smartMixCandidateScanLimit(minimum: number): number {
    return canPrefill("smart-mix") ? Math.max(minimum, smartPrefillSettings$().maxCandidatesPerSource) : minimum;
}

async function enqueuePrefillCandidates(
    source: SmartPrefillSource,
    videos: IPlatformVideo[],
    maximum: number,
    priorityForOffset: (offset: number) => HighlightPrefillPriority,
): Promise<void> {
    if (!canPrefill(source)) return;

    const candidates = takePrefillCandidates(videos, maximum, scheduledUrls)
        .map(video => ({ video, offset: videos.indexOf(video) }));
    await Promise.all(candidates.map(async ({ video, offset }) => {
        const url = video.url ?? video.backendUrl;
        if (!url) return;
        const key = smartPrefillUrlKey(url);
        try {
            const job = await prefillVideo(url, priorityForOffset(offset), source, smartSearchSubtitleTranslationLanguages$());
            if (job?.status === "skipped" && job.error === "Smart Prefill queue is full." && key)
                scheduledUrls.delete(key);
        } catch (error) {
            if (key) scheduledUrls.delete(key);
            console.warn("Smart Prefill enqueue failed", { source, url, error });
        }
    }));
}

export async function prefillVideos(source: SmartPrefillSource, videos: IPlatformVideo[]): Promise<void> {
    await enqueuePrefillCandidates(source, videos, smartPrefillSettings$().maxCandidatesPerSource, () => source);
}

export async function prefillPlaybackWindow(source: SmartPrefillSource, videos: IPlatformVideo[], currentIndex: number): Promise<void> {
    const window = takePreparationWindow(videos, currentIndex, smartPrefillSettings$().preparationDepth);
    await enqueuePrefillCandidates(source, window, window.length, offset => {
        if (offset === 0) return "current-video";
        return offset === 1 ? "next-in-queue" : source;
    });
}

export async function subtitleQualifiedSmartMixVideos(videos: IPlatformVideo[]): Promise<IPlatformVideo[]> {
    if (!canPrefill("smart-mix")) return videos;

    const candidates = takeUniquePrefillCandidates(videos, smartPrefillSettings$().maxCandidatesPerSource);
    const pending = candidates
        .map(video => video.url ?? video.backendUrl)
        .filter((url): url is string => Boolean(url))
        .filter(url => !subtitleAvailability.has(smartPrefillUrlKey(url) ?? url));
    if (pending.length > 0) {
        try {
            const results = await HighlightsBackend.probeSubtitles(pending);
            for (const result of results)
                subtitleAvailability.set(smartPrefillUrlKey(result.url) ?? result.url, result.available);
        } catch (error) {
            console.warn("Smart Mix subtitle probe failed", error);
            return [];
        }
    }
    return candidates.filter(video => {
        const url = video.url ?? video.backendUrl;
        return Boolean(url && subtitleAvailability.get(smartPrefillUrlKey(url) ?? url));
    });
}
