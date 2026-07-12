export type SmartTvEditorialMix = 'balanced' | 'stay-on-topic' | 'explore';
export type SmartTvTransitionKind = 'same-topic' | 'discover' | 'new-angle' | 'best-available';

export interface SmartTvCandidate {
    chapterKey: string;
    score: number;
    videoRecommendationScore?: number;
    durationSeconds: number;
    videoKey: string;
    creatorKey?: string;
    sourceGroup?: string;
    publishedAt?: string;
    subjectText?: string;
    profileTopics?: string[];
    profileRelatedTopics?: string[];
    profileAngleLabels?: string[];
    angleSignal?: boolean;
}

export interface SmartTvSequencerSettings {
    targetSeconds: number;
    maxVideos: number;
    maxChapters: number;
    maxChaptersPerVideo: number;
    minimumScore: number;
    repeatVideoPenalty: number;
    creatorVarietyPenalty: number;
    editorialMix: SmartTvEditorialMix;
}

export interface SmartTvTransition {
    kind: SmartTvTransitionKind;
    label: string;
    similarity: number;
}

export interface SmartTvSequencedCandidate {
    candidate: SmartTvCandidate;
    transition?: SmartTvTransition;
}

interface RankedCandidate {
    candidate: SmartTvCandidate;
    transition: SmartTvTransition;
    rank: number;
}

const SAME_TOPIC_THRESHOLD = 0.25;
const DISCOVERY_THRESHOLD = 0.15;
const VIDEO_RECOMMENDATION_WEIGHT = 0.04;

const TRANSITION_LABELS: Record<SmartTvTransitionKind, string> = {
    'same-topic': 'Same topic',
    discover: 'Discover',
    'new-angle': 'New angle',
    'best-available': 'Best available',
};

function subjectTokens(subjectText?: string): Set<string> {
    const tokens = (subjectText ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .match(/[a-z0-9]+/g) ?? [];

    return new Set(tokens.filter(token => token.length >= 3));
}

function subjectSimilarity(first?: string, second?: string): number {
    const firstTokens = subjectTokens(first);
    const secondTokens = subjectTokens(second);
    if (firstTokens.size === 0 || secondTokens.size === 0) return 0;

    let intersection = 0;
    for (const token of firstTokens) {
        if (secondTokens.has(token)) intersection++;
    }
    return intersection / (firstTokens.size + secondTokens.size - intersection);
}

function profileLabels(candidate: SmartTvCandidate): Set<string> {
    return new Set([
        ...(candidate.profileTopics ?? []),
        ...(candidate.profileRelatedTopics ?? []),
        ...(candidate.profileAngleLabels ?? []),
    ].map(label => label.trim().toLowerCase()).filter(Boolean));
}

function semanticSimilarity(first: SmartTvCandidate, second: SmartTvCandidate): number {
    const firstLabels = profileLabels(first);
    const secondLabels = profileLabels(second);
    if (firstLabels.size > 0 && secondLabels.size > 0) {
        let intersection = 0;
        for (const label of firstLabels) {
            if (secondLabels.has(label)) intersection++;
        }
        if (intersection > 0)
            return intersection / (firstLabels.size + secondLabels.size - intersection);
    }
    return subjectSimilarity(first.subjectText, second.subjectText);
}

function publishedMillis(candidate: SmartTvCandidate): number {
    const timestamp = candidate.publishedAt ? Date.parse(candidate.publishedAt) : Number.NaN;
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function freshnessBonus(candidate: SmartTvCandidate, oldestPublication: number, newestPublication: number): number {
    const publishedAt = publishedMillis(candidate);
    if (!publishedAt || oldestPublication === newestPublication) return 0;
    return ((publishedAt - oldestPublication) / (newestPublication - oldestPublication)) * 0.02;
}

function videoRecommendationBonus(candidate: SmartTvCandidate): number {
    const score = candidate.videoRecommendationScore;
    if (score == null || !Number.isFinite(score)) return 0;
    return Math.max(0, Math.min(1, score)) * VIDEO_RECOMMENDATION_WEIGHT;
}

function transitionFor(previous: SmartTvCandidate, candidate: SmartTvCandidate, mix: SmartTvEditorialMix): SmartTvTransition {
    const similarity = semanticSimilarity(previous, candidate);
    const differentCreator = Boolean(candidate.creatorKey && previous.creatorKey && candidate.creatorKey !== previous.creatorKey);

    let kind: SmartTvTransitionKind;
    if (candidate.angleSignal && similarity >= SAME_TOPIC_THRESHOLD) {
        kind = 'new-angle';
    } else if (mix === 'explore' && differentCreator && similarity >= SAME_TOPIC_THRESHOLD) {
        kind = 'discover';
    } else if (similarity >= SAME_TOPIC_THRESHOLD) {
        kind = 'same-topic';
    } else if (differentCreator && similarity >= DISCOVERY_THRESHOLD) {
        kind = 'discover';
    } else {
        kind = 'best-available';
    }

    return { kind, label: TRANSITION_LABELS[kind], similarity };
}

function transitionBonus(transition: SmartTvTransition, mix: SmartTvEditorialMix): number {
    switch (mix) {
        case 'stay-on-topic':
            if (transition.kind === 'same-topic') return transition.similarity * 0.16;
            if (transition.kind === 'new-angle') return 0.04 + transition.similarity * 0.05;
            if (transition.kind === 'discover') return 0.02 + transition.similarity * 0.04;
            return 0;
        case 'explore':
            if (transition.kind === 'discover') return 0.12 + transition.similarity * 0.1;
            if (transition.kind === 'new-angle') return 0.09 + transition.similarity * 0.05;
            if (transition.kind === 'same-topic') return transition.similarity * 0.04;
            return 0;
        default:
            if (transition.kind === 'new-angle') return 0.08 + transition.similarity * 0.06;
            if (transition.kind === 'discover') return 0.04 + transition.similarity * 0.07;
            if (transition.kind === 'same-topic') return transition.similarity * 0.1;
            return 0;
    }
}

function acceptedByHardConstraints(
    candidate: SmartTvCandidate,
    selected: SmartTvSequencedCandidate[],
    videoCounts: Map<string, number>,
    selectedVideos: Set<string>,
    totalSeconds: number,
    settings: SmartTvSequencerSettings
): boolean {
    const alreadySelectedFromVideo = videoCounts.get(candidate.videoKey) ?? 0;
    const wouldAddVideo = !selectedVideos.has(candidate.videoKey);
    const duration = Math.max(0, candidate.durationSeconds);
    return candidate.score >= settings.minimumScore
        && alreadySelectedFromVideo < settings.maxChaptersPerVideo
        && (!wouldAddVideo || selectedVideos.size < settings.maxVideos)
        && (selected.length === 0 || totalSeconds + duration <= settings.targetSeconds);
}

function candidateRank(
    candidate: SmartTvCandidate,
    previous: SmartTvCandidate,
    selected: SmartTvSequencedCandidate[],
    videoCounts: Map<string, number>,
    newestPublication: number,
    oldestPublication: number,
    settings: SmartTvSequencerSettings
): RankedCandidate {
    const transition = transitionFor(previous, candidate, settings.editorialMix);
    const repeatedVideoPenalty = (videoCounts.get(candidate.videoKey) ?? 0) * settings.repeatVideoPenalty;
    const repeatedCreatorCount = candidate.creatorKey
        ? selected.filter(item => item.candidate.creatorKey === candidate.creatorKey).length
        : 0;
    const repeatedGroupCount = candidate.sourceGroup
        ? selected.filter(item => item.candidate.sourceGroup === candidate.sourceGroup).length
        : 0;
    const sameTopicCount = selected.filter(item => semanticSimilarity(item.candidate, candidate) >= SAME_TOPIC_THRESHOLD).length;
    const repeatedTransitionCount = selected.slice(-2).filter(item => item.transition?.kind === transition.kind).length;
    const topicalPenalty = sameTopicCount > 1 ? (sameTopicCount - 1) * 0.045 : 0;
    const groupPenalty = repeatedGroupCount * settings.creatorVarietyPenalty * 0.35;
    const rank = candidate.score
        + videoRecommendationBonus(candidate)
        + transitionBonus(transition, settings.editorialMix)
        + freshnessBonus(candidate, oldestPublication, newestPublication)
        - repeatedVideoPenalty
        - repeatedCreatorCount * settings.creatorVarietyPenalty
        - groupPenalty
        - topicalPenalty
        - repeatedTransitionCount * 0.02;

    return { candidate, transition, rank };
}

function compareCandidates(first: RankedCandidate, second: RankedCandidate): number {
    const rankDelta = second.rank - first.rank;
    if (rankDelta !== 0) return rankDelta;
    const scoreDelta = second.candidate.score - first.candidate.score;
    if (scoreDelta !== 0) return scoreDelta;
    return first.candidate.chapterKey.localeCompare(second.candidate.chapterKey);
}

/**
 * Returns a fixed, deterministic Smart TV session. The function never mutates
 * candidates or settings, so Home can persist the returned snapshot directly.
 */
export function sequenceSmartTvCandidates(
    candidates: readonly SmartTvCandidate[],
    playedChapterKeys: ReadonlySet<string>,
    settings: SmartTvSequencerSettings
): SmartTvSequencedCandidate[] {
    const available = candidates
        .filter(candidate => candidate.chapterKey && candidate.videoKey && !playedChapterKeys.has(candidate.chapterKey))
        .slice()
        .sort((first, second) => {
            const scoreDelta = second.score - first.score;
            if (scoreDelta !== 0) return scoreDelta;
            const recommendationDelta = videoRecommendationBonus(second) - videoRecommendationBonus(first);
            if (recommendationDelta !== 0) return recommendationDelta;
            return first.chapterKey.localeCompare(second.chapterKey);
        });
    const publications = available.map(publishedMillis).filter(value => value > 0);
    const newestPublication = publications.length > 0 ? Math.max(...publications) : 0;
    const oldestPublication = publications.length > 0 ? Math.min(...publications) : 0;
    const selected: SmartTvSequencedCandidate[] = [];
    const videoCounts = new Map<string, number>();
    const selectedVideos = new Set<string>();
    let totalSeconds = 0;

    while (available.length > 0 && selected.length < settings.maxChapters) {
        const accepted = available.filter(candidate => acceptedByHardConstraints(
            candidate,
            selected,
            videoCounts,
            selectedVideos,
            totalSeconds,
            settings
        ));
        if (accepted.length === 0) break;

        const previous = selected.at(-1)?.candidate;
        const ranked = previous
            ? accepted.map(candidate => candidateRank(
                candidate,
                previous,
                selected,
                videoCounts,
                newestPublication,
                oldestPublication,
                settings
            )).sort(compareCandidates)
            : accepted.map(candidate => ({
                candidate,
                transition: undefined,
                rank: candidate.score + videoRecommendationBonus(candidate) + freshnessBonus(candidate, oldestPublication, newestPublication),
            })).sort((first, second) => {
                const rankDelta = second.rank - first.rank;
                if (rankDelta !== 0) return rankDelta;
                return first.candidate.chapterKey.localeCompare(second.candidate.chapterKey);
            });
        const next = ranked[0];
        if (!next) break;

        const index = available.findIndex(candidate => candidate.chapterKey === next.candidate.chapterKey);
        if (index < 0) break;
        available.splice(index, 1);
        selected.push({ candidate: next.candidate, transition: next.transition });
        selectedVideos.add(next.candidate.videoKey);
        videoCounts.set(next.candidate.videoKey, (videoCounts.get(next.candidate.videoKey) ?? 0) + 1);
        totalSeconds += Math.max(0, next.candidate.durationSeconds);
    }

    return selected;
}
