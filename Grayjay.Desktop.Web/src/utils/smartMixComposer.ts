import type { IVideoHighlightMixProfile } from "../backend/models/highlights/IVideoHighlightMixProfile";
import type { IVideoHighlightSegment } from "../backend/models/highlights/IVideoHighlightSegment";
import type { IVideoHighlightThesis } from "../backend/models/highlights/IVideoHighlightThesis";

export type SmartMixCategory = "close" | "related" | "newAngle";

export interface SmartMixCandidate {
    videoUrl: string;
    updatedAt?: string;
    video?: {
        url?: string;
        duration?: number;
        dateTime?: string;
        author?: { url?: string };
    };
    mixProfile?: IVideoHighlightMixProfile;
    globalSummary?: string;
    theses?: IVideoHighlightThesis[];
    topScore?: number;
    averageScore?: number;
    segments: IVideoHighlightSegment[];
}

export interface SmartMixDistribution {
    close: number;
    related: number;
    newAngle: number;
}

export interface SmartMixSettings {
    maxVideos: number;
    targetSeconds: number;
    creatorVariety: boolean;
    distribution: SmartMixDistribution;
    watchedUrls?: ReadonlySet<string>;
}

export interface SmartMixEntry {
    candidate: SmartMixCandidate;
    category: SmartMixCategory;
    reason: "Same topic" | "Broaden the topic" | "New angle";
    relevantSegment?: IVideoHighlightSegment;
}

interface SmartMixProfile {
    topics: Set<string>;
    relatedTopics: Set<string>;
    angleLabels: Set<string>;
}

interface RankedCandidate {
    candidate: SmartMixCandidate;
    category: SmartMixCategory;
    relevantSegment?: IVideoHighlightSegment;
    rank: number;
    watched: boolean;
    creatorKey?: string;
    durationSeconds: number;
}

const CATEGORY_ORDER: SmartMixCategory[] = ["close", "related", "newAngle"];
const CATEGORY_REASONS: Record<SmartMixCategory, SmartMixEntry["reason"]> = {
    close: "Same topic",
    related: "Broaden the topic",
    newAngle: "New angle",
};
const DEFAULT_DISTRIBUTION: SmartMixDistribution = { close: 60, related: 25, newAngle: 15 };
const CLOSE_THRESHOLD = 0.3;
const RELATED_THRESHOLD = 0.2;

function tokenize(value?: string): Set<string> {
    const tokens = (value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .match(/[a-z0-9]+/g) ?? [];
    return new Set(tokens.filter(token => token.length >= 3));
}

function wordsFromLabels(labels?: string[]): Set<string> {
    const words = new Set<string>();
    for (const label of labels ?? []) {
        for (const token of tokenize(label)) words.add(token);
    }
    return words;
}

function mergeWords(...sets: ReadonlySet<string>[]): Set<string> {
    const merged = new Set<string>();
    for (const set of sets) {
        for (const value of set) merged.add(value);
    }
    return merged;
}

function similarity(first: ReadonlySet<string>, second: ReadonlySet<string>): number {
    if (first.size === 0 || second.size === 0) return 0;
    let intersection = 0;
    for (const value of first) {
        if (second.has(value)) intersection++;
    }
    return intersection / (first.size + second.size - intersection);
}

function fallbackWords(candidate: SmartMixCandidate): Set<string> {
    const parts = [
        candidate.globalSummary,
        ...(candidate.theses ?? []).map(thesis => thesis.statement),
        ...(candidate.segments ?? []).flatMap(segment => [segment.title, segment.summary]),
    ];
    return mergeWords(...parts.map(tokenize));
}

function profileFor(candidate: SmartMixCandidate): SmartMixProfile {
    const topics = wordsFromLabels(candidate.mixProfile?.topics);
    return {
        topics: topics.size > 0 ? topics : fallbackWords(candidate),
        relatedTopics: wordsFromLabels(candidate.mixProfile?.relatedTopics),
        angleLabels: wordsFromLabels(candidate.mixProfile?.angleLabels),
    };
}

function classifyCandidate(source: SmartMixProfile, candidate: SmartMixProfile): SmartMixCategory | undefined {
    const topicSimilarity = similarity(source.topics, candidate.topics);
    const relatedSimilarity = Math.max(
        similarity(source.relatedTopics, candidate.topics),
        similarity(source.topics, candidate.relatedTopics),
        similarity(source.relatedTopics, candidate.relatedTopics),
    );

    if (topicSimilarity >= CLOSE_THRESHOLD) {
        const hasDistinctAngle = source.angleLabels.size > 0
            && candidate.angleLabels.size > 0
            && similarity(source.angleLabels, candidate.angleLabels) < CLOSE_THRESHOLD;
        return hasDistinctAngle ? "newAngle" : "close";
    }
    return relatedSimilarity >= RELATED_THRESHOLD ? "related" : undefined;
}

function normalizedVideoKey(url: string): string {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, "");
        if (host === "youtu.be") {
            const id = parsed.pathname.split("/").filter(Boolean)[0];
            if (id) return `youtube:${id}`;
        }
        if (host.endsWith("youtube.com")) {
            const id = parsed.searchParams.get("v") ?? parsed.pathname.split("/").filter(Boolean).at(-1);
            if (id) return `youtube:${id}`;
        }
    } catch {
        // A stable trimmed URL remains a valid deduplication key.
    }
    return url.trim().replace(/\/+$/, "");
}

function interestScore(candidate: SmartMixCandidate): number {
    const raw = candidate.topScore ?? candidate.averageScore ?? 0;
    return Math.max(0, Math.min(1, Number.isFinite(raw) ? raw : 0));
}

function relevantSegment(source: SmartMixProfile, candidate: SmartMixCandidate): IVideoHighlightSegment | undefined {
    const candidateSegments = (candidate.segments ?? [])
        .filter(segment => segment.end > segment.start)
        .map(segment => {
            const subject = mergeWords(tokenize(segment.title), tokenize(segment.summary));
            const rank = (segment.score ?? interestScore(candidate)) + similarity(source.topics, subject) * 0.2;
            return { segment, rank };
        })
        .sort((first, second) => second.rank - first.rank || first.segment.start - second.segment.start || first.segment.title.localeCompare(second.segment.title));
    return candidateSegments[0]?.segment;
}

function normalizeDistribution(distribution: SmartMixDistribution): SmartMixDistribution {
    const values = CATEGORY_ORDER.map(category => Math.max(0, Math.min(100, Number(distribution[category]) || 0)));
    const total = values.reduce((sum, value) => sum + value, 0);
    if (total !== 100) return DEFAULT_DISTRIBUTION;
    return { close: values[0], related: values[1], newAngle: values[2] };
}

function quotas(maxVideos: number, distribution: SmartMixDistribution): Record<SmartMixCategory, number> {
    const normalized = normalizeDistribution(distribution);
    const quota = { close: 0, related: 0, newAngle: 0 };
    const fractions = CATEGORY_ORDER.map(category => {
        const exact = maxVideos * normalized[category] / 100;
        quota[category] = Math.floor(exact);
        return { category, fraction: exact - quota[category] };
    });

    let remaining = Math.max(0, maxVideos - CATEGORY_ORDER.reduce((sum, category) => sum + quota[category], 0));
    fractions.sort((first, second) => second.fraction - first.fraction || CATEGORY_ORDER.indexOf(first.category) - CATEGORY_ORDER.indexOf(second.category));
    for (const item of fractions) {
        if (remaining <= 0) break;
        quota[item.category]++;
        remaining--;
    }
    return quota;
}

function publishedMillis(candidate: SmartMixCandidate): number {
    const timestamp = candidate.video?.dateTime
        ? Date.parse(candidate.video.dateTime)
        : candidate.updatedAt ? Date.parse(candidate.updatedAt) : Number.NaN;
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function candidateRank(candidate: SmartMixCandidate, newest: number, oldest: number): number {
    const timestamp = publishedMillis(candidate);
    const freshness = timestamp && newest > oldest ? (timestamp - oldest) / (newest - oldest) * 0.02 : 0;
    return interestScore(candidate) + freshness;
}

function isPlayable(candidate: SmartMixCandidate): boolean {
    return !!candidate.video?.url;
}

function compareRankedCandidates(first: RankedCandidate, second: RankedCandidate): number {
    if (first.watched !== second.watched) return first.watched ? 1 : -1;
    const rankDelta = second.rank - first.rank;
    if (rankDelta !== 0) return rankDelta;
    return first.candidate.videoUrl.localeCompare(second.candidate.videoUrl);
}

function chooseFromCategory(
    candidates: readonly RankedCandidate[],
    count: number,
    selectedKeys: ReadonlySet<string>,
    usedCreators: ReadonlySet<string>,
    settings: SmartMixSettings,
    totalSeconds: number,
): RankedCandidate[] {
    const available = candidates.filter(candidate => !selectedKeys.has(normalizedVideoKey(candidate.candidate.videoUrl)));
    const selected: RankedCandidate[] = [];
    const selectedCreators = new Set(usedCreators);
    let duration = totalSeconds;

    while (available.length > 0 && selected.length < count) {
        const preferredIndex = settings.creatorVariety
            ? available.findIndex(candidate => !candidate.creatorKey || !selectedCreators.has(candidate.creatorKey))
            : 0;
        const index = preferredIndex >= 0 ? preferredIndex : 0;
        const [candidate] = available.splice(index, 1);
        if (!candidate) break;
        const nextDuration = duration + candidate.durationSeconds;
        if (duration > 0 && nextDuration > settings.targetSeconds) continue;
        selected.push(candidate);
        duration = nextDuration;
        if (candidate.creatorKey) selectedCreators.add(candidate.creatorKey);
    }
    return selected;
}

function interleave(selected: Record<SmartMixCategory, RankedCandidate[]>, distribution: SmartMixDistribution): RankedCandidate[] {
    const normalized = normalizeDistribution(distribution);
    const consumed = { close: 0, related: 0, newAngle: 0 };
    const result: RankedCandidate[] = [];
    const queues = Object.fromEntries(CATEGORY_ORDER.map(category => [category, [...selected[category]]])) as Record<SmartMixCategory, RankedCandidate[]>;

    while (CATEGORY_ORDER.some(category => queues[category].length > 0)) {
        const nextCategory = CATEGORY_ORDER
            .filter(category => queues[category].length > 0)
            .sort((first, second) => {
                const firstDeficit = normalized[first] / 100 * (result.length + 1) - consumed[first];
                const secondDeficit = normalized[second] / 100 * (result.length + 1) - consumed[second];
                return secondDeficit - firstDeficit || CATEGORY_ORDER.indexOf(first) - CATEGORY_ORDER.indexOf(second);
            })[0];
        if (!nextCategory) break;
        const next = queues[nextCategory].shift();
        if (!next) break;
        result.push(next);
        consumed[nextCategory]++;
    }
    return result;
}

/**
 * Builds a fixed Smart Mix with O(n log n) work for n local candidates:
 * deduplication/classification are O(n), each category is sorted once, and
 * final consumption is bounded by maxVideos.
 */
export function composeSmartMix(
    sourceCandidate: SmartMixCandidate,
    candidates: readonly SmartMixCandidate[],
    settings: SmartMixSettings,
): SmartMixEntry[] {
    const sourceKey = normalizedVideoKey(sourceCandidate.videoUrl);
    const sourceProfile = profileFor(sourceCandidate);
    if (sourceProfile.topics.size === 0) return [];

    const deduped = new Map<string, SmartMixCandidate>();
    for (const candidate of candidates) {
        if (!candidate.videoUrl || !isPlayable(candidate)) continue;
        const key = normalizedVideoKey(candidate.videoUrl);
        if (key === sourceKey) continue;
        const existing = deduped.get(key);
        if (!existing || interestScore(candidate) > interestScore(existing) || (interestScore(candidate) === interestScore(existing) && candidate.videoUrl.localeCompare(existing.videoUrl) < 0))
            deduped.set(key, candidate);
    }

    const eligible = [...deduped.values()];
    const publications = eligible.map(publishedMillis).filter(value => value > 0);
    const newestPublication = publications.length > 0 ? Math.max(...publications) : 0;
    const oldestPublication = publications.length > 0 ? Math.min(...publications) : 0;
    const watchedUrls = new Set(
        [...(settings.watchedUrls ?? new Set<string>())]
            .flatMap(url => [url, normalizedVideoKey(url)])
    );
    const byCategory: Record<SmartMixCategory, RankedCandidate[]> = { close: [], related: [], newAngle: [] };

    for (const candidate of eligible) {
        const category = classifyCandidate(sourceProfile, profileFor(candidate));
        if (!category) continue;
        const videoKey = normalizedVideoKey(candidate.videoUrl);
        const creatorKey = candidate.video?.author?.url;
        byCategory[category].push({
            candidate,
            category,
            relevantSegment: relevantSegment(sourceProfile, candidate),
            rank: candidateRank(candidate, newestPublication, oldestPublication),
            watched: watchedUrls.has(candidate.videoUrl) || watchedUrls.has(videoKey),
            creatorKey,
            durationSeconds: Math.max(0, candidate.video?.duration ?? 0),
        });
    }

    for (const category of CATEGORY_ORDER) byCategory[category].sort(compareRankedCandidates);

    const targetCount = Math.max(0, Math.floor(settings.maxVideos));
    const targetQuotas = quotas(targetCount, settings.distribution);
    const selectedKeys = new Set<string>();
    const usedCreators = new Set<string>();
    const selected: Record<SmartMixCategory, RankedCandidate[]> = { close: [], related: [], newAngle: [] };
    let totalSeconds = 0;

    for (const category of CATEGORY_ORDER) {
        const entries = chooseFromCategory(byCategory[category], targetQuotas[category], selectedKeys, usedCreators, settings, totalSeconds);
        selected[category].push(...entries);
        for (const entry of entries) {
            selectedKeys.add(normalizedVideoKey(entry.candidate.videoUrl));
            if (entry.creatorKey) usedCreators.add(entry.creatorKey);
            totalSeconds += entry.durationSeconds;
        }
    }

    const unfilled = targetCount - CATEGORY_ORDER.reduce((sum, category) => sum + selected[category].length, 0);
    if (unfilled > 0) {
        const spillover = CATEGORY_ORDER
            .flatMap(category => byCategory[category])
            .filter(candidate => !selectedKeys.has(normalizedVideoKey(candidate.candidate.videoUrl)))
            .sort(compareRankedCandidates);
        const entries = chooseFromCategory(spillover, unfilled, selectedKeys, usedCreators, settings, totalSeconds);
        for (const entry of entries) selected[entry.category].push(entry);
    }

    return interleave(selected, settings.distribution).map(entry => ({
        candidate: entry.candidate,
        category: entry.category,
        reason: CATEGORY_REASONS[entry.category],
        relevantSegment: entry.relevantSegment,
    }));
}
