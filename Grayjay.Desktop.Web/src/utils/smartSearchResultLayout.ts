export interface SmartSearchContentLike {
    backendUrl?: string;
    url?: string;
    id?: {
        pluginID?: string;
        value?: string;
    };
}

export interface SmartSearchResultLike<T extends SmartSearchContentLike> {
    key: string;
    content: T;
    originalTitle: string;
    translatedTitle?: string;
    creatorKey?: string;
    originalCreatorName?: string;
    translatedCreatorName?: string;
    languages: string[];
}

export interface SmartSearchResultLane<T extends SmartSearchContentLike> {
    results: SmartSearchResultLike<T>[];
}

export const STANDARD_SMART_SEARCH_SOURCE = "standard";

export function smartSearchContentKey(content: SmartSearchContentLike): string {
    if (content.url)
        return content.url;
    if (content.backendUrl)
        return content.backendUrl;
    return `${content.id?.pluginID ?? ""}:${content.id?.value ?? ""}`;
}

function appendSources(current: string[], incoming: string[]): string[] {
    return [...current, ...incoming.filter(language => !current.includes(language))];
}

function mergeResult<T extends SmartSearchContentLike>(current: SmartSearchResultLike<T>, incoming: SmartSearchResultLike<T>): SmartSearchResultLike<T> {
    return {
        ...current,
        translatedTitle: current.translatedTitle ?? incoming.translatedTitle,
        creatorKey: current.creatorKey ?? incoming.creatorKey,
        originalCreatorName: current.originalCreatorName ?? incoming.originalCreatorName,
        translatedCreatorName: current.translatedCreatorName ?? incoming.translatedCreatorName,
        languages: appendSources(current.languages, incoming.languages)
    };
}

export function mixSmartSearchResultLanes<T extends SmartSearchContentLike>(lanes: SmartSearchResultLane<T>[], compare?: (first: SmartSearchResultLike<T>, second: SmartSearchResultLike<T>) => number): SmartSearchResultLike<T>[] {
    const merged = new Map<string, SmartSearchResultLike<T>>();
    for (const lane of lanes) {
        for (const result of lane.results) {
            const key = smartSearchContentKey(result.content);
            const current = merged.get(key);
            merged.set(key, current ? mergeResult(current, result) : { ...result, languages: [...result.languages] });
        }
    }

    const ordered: SmartSearchResultLike<T>[] = [];
    const seen = new Set<string>();
    const maxLength = Math.max(0, ...lanes.map(lane => lane.results.length));
    for (let index = 0; index < maxLength; index++) {
        for (const lane of lanes) {
            const result = lane.results[index];
            if (!result)
                continue;
            const key = smartSearchContentKey(result.content);
            if (seen.has(key))
                continue;
            seen.add(key);
            ordered.push(merged.get(key)!);
        }
    }

    return compare ? ordered.sort(compare) : ordered;
}
