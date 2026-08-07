import type { IPlatformVideo } from "../backend/models/content/IPlatformVideo";
import type { IVideoHighlightSegment } from "../backend/models/highlights/IVideoHighlightSegment";
import type { IVideoHighlightSet } from "../backend/models/highlights/IVideoHighlightSet";
import type { IVideoHighlightSummary } from "../backend/models/highlights/IVideoHighlightSummary";

export const INTEREST_MIN_SCORE = 0.55;
export const INTEREST_GOOD_SCORE = 0.72;
export const INTEREST_STRONG_SCORE = 0.88;
export const INTEREST_EXCELLENT_SCORE = 0.93;

export interface VideoInterest {
    score: number;
    stars: number;
    label: string;
    ratingText: string;
    ratingAriaLabel: string;
    usefulSegmentCount: number;
    strongSegmentCount: number;
    excellentSegmentCount: number;
    interestingDuration: number;
    density?: number;
    averageScore?: number;
    topScore?: number;
    hasChapterScores: boolean;
}

export interface HighlightInterestSummary {
    segmentCount?: number;
    totalDuration?: number;
    interestingDuration?: number;
    averageScore?: number;
    topScore?: number;
    strongSegmentCount?: number;
    excellentSegmentCount?: number;
    video?: IPlatformVideo;
}

interface InterestInput {
    videoDuration?: number;
    segmentCount?: number;
    totalDuration?: number;
    interestingDuration?: number;
    averageScore?: number;
    topScore?: number;
    strongSegmentCount?: number;
    excellentSegmentCount?: number;
}

export interface VideoInterestRating {
    stars: number;
    label: string;
    text: string;
    ariaLabel: string;
}

interface InterestRatingLevel {
    minimumScore: number;
    stars: number;
    label: string;
}

const INTEREST_RATING_LEVELS: readonly InterestRatingLevel[] = [
    { minimumScore: 0.91, stars: 5, label: "Passionnante" },
    { minimumScore: 0.82, stars: 4.5, label: "Excellente" },
    { minimumScore: 0.74, stars: 4, label: "Remarquable" },
    { minimumScore: 0.66, stars: 3.5, label: "Très intéressante" },
    { minimumScore: 0.57, stars: 3, label: "Intéressante" },
    { minimumScore: 0.48, stars: 2.5, label: "Utile" },
    { minimumScore: 0.39, stars: 2, label: "À picorer" },
    { minimumScore: 0.30, stars: 1.5, label: "Anecdotique" },
    { minimumScore: 0.15, stars: 1, label: "Faible" },
    { minimumScore: 0, stars: 0.5, label: "Très faible" },
];

function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
}

export function interestRatingFromScore(score: number): VideoInterestRating {
    const safeScore = clamp01(score);
    const level = INTEREST_RATING_LEVELS.find(candidate => safeScore >= candidate.minimumScore)
        ?? INTEREST_RATING_LEVELS[INTEREST_RATING_LEVELS.length - 1];
    const text = `${level.stars.toFixed(1).replace('.', ',')} / 5`;
    return {
        stars: level.stars,
        label: level.label,
        text,
        ariaLabel: `${text} étoiles sur 5 - ${level.label}`,
    };
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
            densitySignal * 0.16
        );
    } else {
        score = clamp01(
            usefulSignal * 0.45 +
            durationSignal * 0.325 +
            densitySignal * 0.225
        );
    }

    const rating = interestRatingFromScore(score);
    return {
        score,
        stars: rating.stars,
        label: rating.label,
        ratingText: rating.text,
        ratingAriaLabel: rating.ariaLabel,
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

export function interestFromSummary(summary?: HighlightInterestSummary, video?: IPlatformVideo): VideoInterest | undefined {
    if (!summary) return undefined;
    const sourceVideo = video ?? summary.video;
    return computeInterest({
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
