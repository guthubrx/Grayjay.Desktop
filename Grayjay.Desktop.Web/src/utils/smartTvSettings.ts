import type { SmartTvEditorialMix, SmartTvSequencerSettings } from "./smartTvSequencer";

const SMART_TV_TARGET_SECONDS = [15, 30, 45, 60, 90, 120, 180, 240, 360].map(minutes => minutes * 60);
const SMART_TV_MAX_VIDEOS = [3, 5, 8, 12, 16, 24, 32, 50];
const SMART_TV_MAX_CHAPTERS = [5, 8, 12, 16, 24, 36, 50, 75, 100];
const SMART_TV_MAX_CHAPTERS_PER_VIDEO = [1, 2, 3, 4, 5, Number.POSITIVE_INFINITY];
const SMART_TV_MIN_SCORE = [0, 0.45, 0.55, 0.65, 0.75, 0.85, 0.92];
const SMART_TV_CANDIDATE_VIDEOS = [12, 24, 40, 60, 100];
const SMART_TV_REPEAT_VIDEO_PENALTY = [0, 0.04, 0.08, 0.14];
const SMART_TV_CREATOR_VARIETY_PENALTY = [0, 0.03, 0.06, 0.1];
const SMART_TV_EDITORIAL_MIXES: SmartTvEditorialMix[] = ["balanced", "stay-on-topic", "explore"];
const SMART_TV_TILE_PREVIEW_THUMBNAILS = [0, 1, 2, 3, 4];

const DEFAULT_SMART_TV_SETTINGS = {
    targetSeconds: 60 * 60,
    maxVideos: 8,
    maxChapters: 12,
    maxChaptersPerVideo: 2,
    minimumScore: 0.55,
    candidateVideos: 24,
    repeatVideoPenalty: 0.04,
    creatorVarietyPenalty: 0.06,
    editorialMix: "balanced" as SmartTvEditorialMix,
    tilePreviewThumbnails: 4,
};

export interface SmartTvResolvedSettings extends SmartTvSequencerSettings {
    candidateVideos: number;
    tilePreviewThumbnails: number;
}

function indexedSetting<T>(values: T[], index: unknown, fallback: T): T {
    return typeof index === "number" && Number.isFinite(index) ? (values[index] ?? fallback) : fallback;
}

export function smartTvSettingsFromObject(settingsObject: any): SmartTvResolvedSettings {
    const smartTv = settingsObject?.xrayPanel?.smartTv;
    return {
        targetSeconds: indexedSetting(SMART_TV_TARGET_SECONDS, smartTv?.targetDuration, DEFAULT_SMART_TV_SETTINGS.targetSeconds),
        maxVideos: indexedSetting(SMART_TV_MAX_VIDEOS, smartTv?.maxVideos, DEFAULT_SMART_TV_SETTINGS.maxVideos),
        maxChapters: indexedSetting(SMART_TV_MAX_CHAPTERS, smartTv?.maxChapters, DEFAULT_SMART_TV_SETTINGS.maxChapters),
        maxChaptersPerVideo: indexedSetting(SMART_TV_MAX_CHAPTERS_PER_VIDEO, smartTv?.maxChaptersPerVideo, DEFAULT_SMART_TV_SETTINGS.maxChaptersPerVideo),
        minimumScore: indexedSetting(SMART_TV_MIN_SCORE, smartTv?.minimumScore, DEFAULT_SMART_TV_SETTINGS.minimumScore),
        candidateVideos: indexedSetting(SMART_TV_CANDIDATE_VIDEOS, smartTv?.candidateVideos, DEFAULT_SMART_TV_SETTINGS.candidateVideos),
        repeatVideoPenalty: indexedSetting(SMART_TV_REPEAT_VIDEO_PENALTY, smartTv?.repeatVideoPenalty, DEFAULT_SMART_TV_SETTINGS.repeatVideoPenalty),
        creatorVarietyPenalty: indexedSetting(SMART_TV_CREATOR_VARIETY_PENALTY, smartTv?.creatorVariety, DEFAULT_SMART_TV_SETTINGS.creatorVarietyPenalty),
        editorialMix: indexedSetting(SMART_TV_EDITORIAL_MIXES, smartTv?.editorialMix, DEFAULT_SMART_TV_SETTINGS.editorialMix),
        tilePreviewThumbnails: indexedSetting(SMART_TV_TILE_PREVIEW_THUMBNAILS, smartTv?.tilePreviewThumbnails, DEFAULT_SMART_TV_SETTINGS.tilePreviewThumbnails),
    };
}
