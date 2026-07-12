import type { IPlatformVideo } from "../backend/models/content/IPlatformVideo";
import type { ISmartSearchSession } from "../backend/SmartSearchBackend";
import type { IVideoHighlightMixProfile } from "../backend/models/highlights/IVideoHighlightMixProfile";

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

export function smartDiscoveryVideos(session: ISmartSearchSession, sourceUrl: string, maxVideos: number): IPlatformVideo[] {
    const sourceKey = normalizedUrl(sourceUrl);
    const seen = new Set<string>();
    const videos: IPlatformVideo[] = [];
    for (const result of session.variants.flatMap(variant => variant.results)) {
        const video = result.content as IPlatformVideo;
        const key = normalizedUrl(video.backendUrl ?? video.url);
        if (!key || key === sourceKey || seen.has(key)) continue;
        seen.add(key);
        videos.push(video);
        if (videos.length >= maxVideos) break;
    }
    return videos;
}
