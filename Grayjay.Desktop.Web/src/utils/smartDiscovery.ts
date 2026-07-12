import type { IPlatformVideo } from "../backend/models/content/IPlatformVideo";
import type { ISmartSearchDiscoveryRequest, ISmartSearchSession } from "../backend/SmartSearchBackend";
import type { IVideoHighlightDiscoveryProfile } from "../backend/models/highlights/IVideoHighlightDiscoveryProfile";
import type { IVideoHighlightMixProfile } from "../backend/models/highlights/IVideoHighlightMixProfile";
import { rankRecommendationCandidates } from "./recommendationRanking";

const DISCOVERY_AXIS_IDS = ["core", "context", "impact", "debate"] as const;
const AXIS_RELEVANCE: Record<string, number> = {
    core: 0.95,
    context: 0.82,
    impact: 0.76,
    debate: 0.70,
};

function firstUsefulLine(value?: string): string | undefined {
    const line = value?.split(/\r?\n/).map(part => part.trim()).find(Boolean);
    if (!line) return undefined;
    if (line.length <= 180) return line;

    const shortened = line.slice(0, 180);
    const clauseBreak = Math.max(shortened.lastIndexOf(','), shortened.lastIndexOf(';'), shortened.lastIndexOf(':'));
    if (clauseBreak >= 60)
        return shortened.slice(0, clauseBreak).trim();

    const wordBreak = shortened.lastIndexOf(' ');
    return shortened.slice(0, wordBreak > 0 ? wordBreak : shortened.length).trim();
}

function normalizedUrl(url?: string): string | undefined {
    if (!url) return undefined;
    try {
        const parsed = new URL(url);
        if (parsed.hostname.replace(/^www\./, '').endsWith('youtube.com')) {
            const id = parsed.searchParams.get('v');
            if (id) return `youtube:${id}`;
        }
        if (parsed.hostname.replace(/^www\./, '') === 'youtu.be') {
            const id = parsed.pathname.split('/').filter(Boolean)[0];
            if (id) return `youtube:${id}`;
        }
    } catch {}
    return url.trim().replace(/\/+$/, '');
}

export function smartDiscoveryQuery(profile?: IVideoHighlightMixProfile, globalSummary?: string): string | undefined {
    const labels = [
        ...(profile?.topics ?? []),
        ...(profile?.relatedTopics ?? []),
    ].map(value => value.trim()).filter(Boolean);
    return [firstUsefulLine(globalSummary), ...labels.slice(0, 3)].filter(Boolean).join(' ') || undefined;
}

export function smartDiscoveryUserLanguage(value: string | undefined = typeof navigator === "undefined" ? undefined : navigator.language): string {
    const language = (value ?? "en").trim().replace("_", "-");
    const lowered = language.toLowerCase();
    if (lowered === "zh-hans" || lowered === "zh-cn" || lowered === "zh-sg") return "zh-Hans";
    if (lowered === "zh-hant" || lowered === "zh-tw" || lowered === "zh-hk") return "zh-Hant";
    const match = lowered.match(/^[a-z]{2,3}/);
    return match?.[0] ?? "en";
}

export function smartDiscoveryPlan(profile: IVideoHighlightDiscoveryProfile | undefined, userLanguage?: string): ISmartSearchDiscoveryRequest | undefined {
    if (profile?.version !== 1 || profile.axes?.length !== DISCOVERY_AXIS_IDS.length)
        return undefined;

    const axes = profile.axes.map(axis => ({
        id: axis.id.trim().toLowerCase(),
        label: axis.label.trim(),
        queries: Object.fromEntries(Object.entries(axis.queries ?? {}).filter(([, query]) => typeof query === "string" && query.trim().length > 0)),
    }));
    if (!axes.every(axis => DISCOVERY_AXIS_IDS.includes(axis.id as typeof DISCOVERY_AXIS_IDS[number])) || new Set(axes.map(axis => axis.id)).size !== DISCOVERY_AXIS_IDS.length || axes.some(axis => !axis.label || !axis.queries.en))
        return undefined;

    return {
        userLanguage: smartDiscoveryUserLanguage(userLanguage),
        axes: DISCOVERY_AXIS_IDS.map(id => axes.find(axis => axis.id === id)!),
    };
}

export function smartDiscoveryVideos(session: ISmartSearchSession, sourceUrl: string, maxVideos: number): IPlatformVideo[] {
    const sourceKey = normalizedUrl(sourceUrl);
    const candidates = new Map<string, {
        key: string;
        fallbackOrder: number;
        publishedAt?: string;
        viewCount?: number;
        semanticRelevance?: number;
        video: IPlatformVideo;
    }>();
    let fallbackOrder = 0;
    for (const variant of session.variants) {
        for (const result of variant.results) {
            const video = result.content as IPlatformVideo;
            const key = normalizedUrl(video.backendUrl ?? video.url);
            if (!key || key === sourceKey) continue;
            const relevance = AXIS_RELEVANCE[variant.axis ?? ""];
            const existing = candidates.get(key);
            if (existing) {
                existing.semanticRelevance = Math.max(existing.semanticRelevance ?? 0, relevance ?? 0);
                continue;
            }
            candidates.set(key, {
                key,
                fallbackOrder: fallbackOrder++,
                publishedAt: video.dateTime,
                viewCount: video.viewCount,
                semanticRelevance: relevance,
                video,
            });
        }
    }
    return rankRecommendationCandidates([...candidates.values()])
        .slice(0, Math.max(0, maxVideos))
        .map(entry => entry.candidate.video);
}
