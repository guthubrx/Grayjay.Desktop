import type { IPlatformVideo } from "../backend/models/content/IPlatformVideo";
import type { VideoQueueItemMeta } from "../contexts/VideoProvider";

export interface SmartMixQueueTail {
    queue: IPlatformVideo[];
    metadata: (VideoQueueItemMeta | undefined)[];
}

export function replaceUnplayedSmartMixTail(
    queue: readonly IPlatformVideo[] | undefined,
    metadata: readonly (VideoQueueItemMeta | undefined)[] | undefined,
    currentIndex: number | undefined,
    sessionId: string,
    nextVideos: readonly IPlatformVideo[],
    nextMetadata: readonly (VideoQueueItemMeta | undefined)[],
): SmartMixQueueTail | undefined {
    if (!queue || !metadata || currentIndex == null || currentIndex < 0 || currentIndex >= queue.length)
        return undefined;
    const currentMetadata = metadata[currentIndex];
    if (currentMetadata?.source !== "smart-mix" || currentMetadata.sessionId !== sessionId)
        return undefined;

    const prefixLength = currentIndex + 1;
    return {
        queue: [...queue.slice(0, prefixLength), ...nextVideos],
        metadata: [...metadata.slice(0, prefixLength), ...nextMetadata.slice(0, nextVideos.length)],
    };
}
