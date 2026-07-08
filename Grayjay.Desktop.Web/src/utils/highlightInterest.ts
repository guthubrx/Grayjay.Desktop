import { IPlatformVideo } from "../backend/models/content/IPlatformVideo";
import { IVideoHighlightSegment } from "../backend/models/highlights/IVideoHighlightSegment";
import { IVideoHighlightSet } from "../backend/models/highlights/IVideoHighlightSet";
import { IVideoHighlightSummary } from "../backend/models/highlights/IVideoHighlightSummary";

export const INTEREST_MIN_SCORE = 0.55;
export const INTEREST_GOOD_SCORE = 0.72;
export const INTEREST_STRONG_SCORE = 0.88;
export const INTEREST_EXCELLENT_SCORE = 0.93;

export interface VideoInterest {
    score: number;
    stars: number;
    label: string;
    usefulSegmentCount: number;
    strongSegmentCount: number;
    excellentSegmentCount: number;
    interestingDuration: number;
    density?: number;
    averageScore?: number;
    topScore?: number;
    hasChapterScores: boolean;
}

interface InterestInput {
    updatedAt?: string;
    videoDateTime?: string;
    videoDuration?: number;
    segmentCount?: number;
    totalDuration?: number;
    interestingDuration?: number;
    averageScore?: number;
    topScore?: number;
    strongSegmentCount?: number;
    excellentSegmentCount?: number;
}

function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
}

function millisFromDate(value?: string): number {
    if (!value) return 0;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
}

function freshnessScore(videoDateTime?: string, fallbackUpdatedAt?: string): number {
    const newest = millisFromDate(videoDateTime) || millisFromDate(fallbackUpdatedAt);
    const ageDays = newest > 0 ? Math.max(0, (Date.now() - newest) / 86400000) : 30;
    return 1 / (1 + ageDays / 14);
}

function starsFromScore(score: number): number {
    if (score >= 0.82) return 5;
    if (score >= 0.66) return 4;
    if (score >= 0.48) return 3;
    if (score >= 0.30) return 2;
    return 1;
}

function labelFromStars(stars: number): string {
    if (stars >= 5) return "Exceptional";
    if (stars >= 4) return "Very interesting";
    if (stars >= 3) return "Interesting";
    if (stars >= 2) return "Occasional signal";
    return "Low signal";
}

export function starsText(stars: number): string {
    const full = Math.max(0, Math.min(5, Math.round(stars)));
    return `${"★".repeat(full)}${"☆".repeat(5 - full)}`;
}

export function formatInterestDuration(seconds: number): string {
    const safeSeconds = Math.max(0, Math.round(seconds));
    const h = Math.floor(safeSeconds / 3600);
    const m = Math.floor((safeSeconds % 3600) / 60);
    const s = safeSeconds % 60;
    return h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${m}:${String(s).padStart(2, '0')}`;
}

export function interestDetailText(interest: VideoInterest): string {
    const parts: string[] = [];
    if (interest.strongSegmentCount > 0)
        parts.push(`${interest.strongSegmentCount} strong`);
    else if (interest.usefulSegmentCount > 0)
        parts.push(`${interest.usefulSegmentCount} useful`);
    if (interest.interestingDuration > 0)
        parts.push(`${formatInterestDuration(interest.interestingDuration)} useful`);
    if (interest.density != null && interest.density > 0)
        parts.push(`${Math.round(interest.density * 100)}% dense`);
    return parts.join(' · ');
}

function computeInterest(input: InterestInput): VideoInterest | undefined {
    const segmentCount = Math.max(0, input.segmentCount ?? 0);
    const totalDuration = Math.max(0, input.totalDuration ?? 0);
    const interestingDuration = Math.max(0, input.interestingDuration ?? totalDuration);
    const averageScore = input.averageScore;
    const topScore = input.topScore;
    const hasChapterScores = averageScore != null || topScore != null;
    if (segmentCount === 0 && interestingDuration === 0 && !hasChapterScores) return undefined;
    const strongSegmentCount = Math.max(0, input.strongSegmentCount ?? 0);
    const excellentSegmentCount = Math.max(0, input.excellentSegmentCount ?? 0);
    const usefulSegmentCount = segmentCount;
    const durationSignal = clamp01(interestingDuration / 900);
    const density = input.videoDuration && input.videoDuration > 0
        ? clamp01(interestingDuration / input.videoDuration)
        : undefined;
    const densitySignal = density != null ? clamp01(density / 0.28) : durationSignal;
    const freshness = freshnessScore(input.videoDateTime, input.updatedAt);
    const usefulSignal = clamp01(usefulSegmentCount / 8);

    let score: number;
    if (hasChapterScores) {
        const qualitySignal = averageScore != null
            ? clamp01((averageScore - INTEREST_MIN_SCORE) / (INTEREST_EXCELLENT_SCORE - INTEREST_MIN_SCORE))
            : clamp01(((topScore ?? INTEREST_MIN_SCORE) - INTEREST_GOOD_SCORE) / (INTEREST_EXCELLENT_SCORE - INTEREST_GOOD_SCORE));
        const topSignal = topScore != null ? clamp01((topScore - INTEREST_STRONG_SCORE) / (1 - INTEREST_STRONG_SCORE)) : 0;
        const strongSignal = clamp01(strongSegmentCount / 4);
        const excellentSignal = clamp01(excellentSegmentCount / 2);
        score = clamp01(
            qualitySignal * 0.34 +
            topSignal * 0.08 +
            strongSignal * 0.20 +
            excellentSignal * 0.10 +
            durationSignal * 0.12 +
            densitySignal * 0.10 +
            freshness * 0.06
        );
    } else {
        score = clamp01(
            usefulSignal * 0.36 +
            durationSignal * 0.26 +
            densitySignal * 0.18 +
            freshness * 0.20
        );
    }

    const stars = starsFromScore(score);
    return {
        score,
        stars,
        label: labelFromStars(stars),
        usefulSegmentCount,
        strongSegmentCount,
        excellentSegmentCount,
        interestingDuration,
        density,
        averageScore,
        topScore,
        hasChapterScores,
    };
}

export function interestFromSummary(summary?: IVideoHighlightSummary, video?: IPlatformVideo): VideoInterest | undefined {
    if (!summary) return undefined;
    const sourceVideo = video ?? summary.video;
    return computeInterest({
        updatedAt: summary.updatedAt,
        videoDateTime: sourceVideo?.dateTime,
        videoDuration: sourceVideo?.duration,
        segmentCount: summary.segmentCount,
        totalDuration: summary.totalDuration,
        interestingDuration: summary.interestingDuration,
        averageScore: summary.averageScore,
        topScore: summary.topScore,
        strongSegmentCount: summary.strongSegmentCount,
        excellentSegmentCount: summary.excellentSegmentCount,
    });
}

export function interestFromSet(set?: IVideoHighlightSet, video?: IPlatformVideo): VideoInterest | undefined {
    if (!set) return undefined;
    const segments = set.segments ?? [];
    const scored = segments.filter(segment => segment.score != null);
    const usefulSegments = segments.filter(segment => (segment.score ?? INTEREST_MIN_SCORE) >= INTEREST_MIN_SCORE);
    const totalDuration = segments.reduce((total, segment) => total + Math.max(0, segment.end - segment.start), 0);
    const interestingDuration = scored.length
        ? usefulSegments.reduce((total, segment) => total + Math.max(0, segment.end - segment.start), 0)
        : totalDuration;
    return computeInterest({
        updatedAt: set.updatedAt,
        videoDateTime: (video ?? set.video)?.dateTime,
        videoDuration: (video ?? set.video)?.duration,
        segmentCount: scored.length ? usefulSegments.length : segments.length,
        totalDuration,
        interestingDuration,
        averageScore: scored.length ? scored.reduce((total, segment) => total + (segment.score ?? 0), 0) / scored.length : undefined,
        topScore: scored.length ? Math.max(...scored.map(segment => segment.score ?? 0)) : undefined,
        strongSegmentCount: scored.filter(segment => (segment.score ?? 0) >= INTEREST_STRONG_SCORE).length,
        excellentSegmentCount: scored.filter(segment => (segment.score ?? 0) >= INTEREST_EXCELLENT_SCORE).length,
    });
}

export function interestScoreFromSummary(summary?: IVideoHighlightSummary, video?: IPlatformVideo): number {
    return interestFromSummary(summary, video)?.score ?? 0;
}
