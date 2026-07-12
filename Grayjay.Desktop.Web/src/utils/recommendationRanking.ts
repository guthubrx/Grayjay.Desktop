export interface RecommendationCandidate {
    key: string;
    fallbackOrder?: number;
    publishedAt?: string | number | Date;
    viewCount?: number;
    contentInterest?: number;
    semanticRelevance?: number;
}

export interface RecommendationSignals {
    popularity?: number;
    freshness?: number;
    contentInterest?: number;
    semanticRelevance?: number;
}

export interface RankedRecommendation<T extends RecommendationCandidate> {
    candidate: T;
    score: number;
    signals: RecommendationSignals;
}

const WEIGHTS = {
    semanticRelevance: 0.45,
    contentInterest: 0.30,
    freshness: 0.15,
    popularity: 0.10,
} as const;

function clamp01(value: number | undefined): number | undefined {
    if (value == null || !Number.isFinite(value)) return undefined;
    return Math.max(0, Math.min(1, value));
}

function timestamp(value: RecommendationCandidate['publishedAt']): number | undefined {
    if (value == null) return undefined;
    const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : undefined;
}

function freshness(value: RecommendationCandidate['publishedAt'], now: number): number | undefined {
    const publishedAt = timestamp(value);
    if (publishedAt == null) return undefined;
    const ageDays = Math.max(0, (now - publishedAt) / 86_400_000);
    return 1 / (1 + ageDays / 21);
}

function popularityByKey<T extends RecommendationCandidate>(candidates: readonly T[]): Map<string, number> {
    const known = candidates
        .map(candidate => ({ candidate, views: candidate.viewCount ?? 0 }))
        .filter(({ views }) => Number.isFinite(views) && views > 0)
        .map(({ candidate, views }) => ({ key: candidate.key, value: Math.log1p(views) }));
    if (known.length === 0) return new Map();

    const lowest = Math.min(...known.map(item => item.value));
    const highest = Math.max(...known.map(item => item.value));
    return new Map(known.map(item => [
        item.key,
        highest === lowest ? 0.5 : (item.value - lowest) / (highest - lowest),
    ]));
}

function weightedScore(signals: RecommendationSignals): number {
    let total = 0;
    let weight = 0;
    for (const [name, signal] of Object.entries(signals) as [keyof RecommendationSignals, number | undefined][]) {
        if (signal == null) continue;
        const signalWeight = WEIGHTS[name];
        total += signal * signalWeight;
        weight += signalWeight;
    }
    return weight > 0 ? total / weight : 0;
}

export function rankRecommendationCandidates<T extends RecommendationCandidate>(
    candidates: readonly T[],
    now: number = Date.now(),
): RankedRecommendation<T>[] {
    const popularity = popularityByKey(candidates);
    return candidates
        .map(candidate => {
            const signals: RecommendationSignals = {
                popularity: popularity.get(candidate.key),
                freshness: freshness(candidate.publishedAt, now),
                contentInterest: clamp01(candidate.contentInterest),
                semanticRelevance: clamp01(candidate.semanticRelevance),
            };
            return { candidate, signals, score: weightedScore(signals) };
        })
        .sort((first, second) => {
            const scoreDifference = second.score - first.score;
            if (scoreDifference !== 0) return scoreDifference;
            const fallbackDifference = (first.candidate.fallbackOrder ?? 0) - (second.candidate.fallbackOrder ?? 0);
            if (fallbackDifference !== 0) return fallbackDifference;
            return first.candidate.key.localeCompare(second.candidate.key);
        });
}
