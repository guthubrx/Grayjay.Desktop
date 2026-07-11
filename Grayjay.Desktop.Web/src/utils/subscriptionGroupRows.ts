export interface SubscriptionGroupRowVideo {
    url?: string;
    dateTime?: string | number | Date;
}

export interface SubscriptionGroupRow<T extends SubscriptionGroupRowVideo> {
    name: string;
    videos: T[];
}

function videoTimestamp(video: SubscriptionGroupRowVideo): number {
    const timestamp = new Date(video.dateTime ?? 0).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
}

function mergeVideos<T extends SubscriptionGroupRowVideo>(existing: T[], incoming: T[], maxItems: number): T[] {
    const merged = new Map<string, T>();

    for (const video of [...existing, ...incoming]) {
        const key = video.url ?? `${videoTimestamp(video)}-${merged.size}`;
        merged.set(key, video);
    }

    return [...merged.values()]
        .sort((a, b) => videoTimestamp(b) - videoTimestamp(a))
        .slice(0, maxItems);
}

export function mergeSubscriptionGroupRows<T extends SubscriptionGroupRowVideo>(
    existing: SubscriptionGroupRow<T>[],
    incoming: SubscriptionGroupRow<T>[],
    maxItems: number
): SubscriptionGroupRow<T>[] {
    const rows = new Map(existing.map(row => [row.name, { ...row, videos: [...row.videos] }]));

    for (const row of incoming) {
        const previous = rows.get(row.name);
        rows.set(row.name, {
            name: row.name,
            videos: mergeVideos(previous?.videos ?? [], row.videos, maxItems)
        });
    }

    return [...rows.values()].filter(row => row.videos.length > 0);
}
