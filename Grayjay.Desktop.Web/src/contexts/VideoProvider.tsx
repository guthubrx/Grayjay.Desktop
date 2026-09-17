import { createContext, useContext, JSX, ParentComponent, createSignal, Accessor, batch, createMemo, createEffect, onMount } from "solid-js";
import StateGlobal from "../state/StateGlobal";
import { IOrderedPlatformVideo, WatchLaterBackend } from "../backend/WatchLaterBackend";
import { IPlatformVideo } from "../backend/models/content/IPlatformVideo";
import { IPlatformContent } from "../backend/models/content/IPlatformContent";
import { ContentType } from "../backend/models/ContentType";
import { Duration } from "luxon";
import { SettingsBackend } from "../backend/SettingsBackend";
import StateWebsocket from "../state/StateWebsocket";
import { DetailsBackend } from "../backend/DetailsBackend";
import { Pager } from "../backend/models/pagers/Pager";
import { WindowBackend } from "../backend/WindowBackend";
import { replaceUnplayedSmartMixTail } from "../utils/smartMixQueue";

export enum VideoState {
    Closed = 0,
    Maximized = 1,
    Minimized,
    Fullscreen
};

export enum VideoMode {
    Standard = 0,
    Theatre
};

export interface VideoQueueItemMeta {
    source?: string;
    sessionId?: string;
    sessionTitle?: string;
    title?: string;
    summary?: string;
    globalSummary?: string;
    transitionKind?: 'same-topic' | 'discover' | 'new-angle' | 'best-available';
    transitionLabel?: string;
    channelName?: string;
    channelThumbnail?: string;
    startSeconds?: number;
    endSeconds?: number;
}

export interface VideoContextState {
    state: VideoState;
    index?: number;
    queue?: IPlatformVideo[];
};

export interface VideoContextValue {
    id: string;
    state: Accessor<VideoState>;
    index: Accessor<number | undefined>;
    queue: Accessor<IPlatformVideo[] | undefined>;
    queueMetadata: Accessor<(VideoQueueItemMeta | undefined)[] | undefined>;
    watchLater: Accessor<IOrderedPlatformVideo[] | undefined>;
    video: Accessor<IPlatformVideo | undefined>;
    repeat: Accessor<boolean>;
    shuffle: Accessor<boolean>;
    startTime: Accessor<Duration | undefined>;
    desiredMode: Accessor<VideoMode>;
    theatrePinned: Accessor<boolean>;
    volume: Accessor<number>;
    bingeChannelUrl: Accessor<string | undefined>;
    minimizedVideos: Accessor<VideoContextValue[]>;
    activePlaybackVideoId: Accessor<string | undefined>;
    actions: {
        openVideo: (video: IPlatformVideo, time?: Duration, videoState?: VideoState) => void;
        openVideoByUrl: (url: string, time?: Duration, videoState?: VideoState) => void;
        setQueue: (index: number, queue: IPlatformVideo[], repeat?: boolean, shuffle?: boolean, videoState?: VideoState, time?: Duration, startTimes?: (Duration | undefined)[], metadata?: (VideoQueueItemMeta | undefined)[]) => void;
        addToQueue: (v: IPlatformVideo) => void;
        replaceUnplayedSmartMixTail: (sessionId: string, queue: IPlatformVideo[], metadata: (VideoQueueItemMeta | undefined)[]) => boolean;
        setIndex: (index: number) => void;
        consumeAndSetIndex: (index: number) => void;
        setRepeat: (value: boolean) => void;
        setShuffle: (value: boolean) => void;
        closeVideo: () => void;
        setState: (videoState: VideoState) => void;
        refetchWatchLater: () => void;
        setDesiredMode: (mode: VideoMode) => void;
        setTheatrePinned: (pinned: boolean) => void;
        setVolume: (volume: number) => void;
        setStartTime: (startTime: Duration | undefined) => void;
        startBinge: (channelUrl: string, videos: IPlatformVideo[], pager: Pager<IPlatformContent>) => void;
        stopBinge: () => void;
        requestPlayback: () => void;
    }
};

const VideoContext = createContext<VideoContextValue>();
export interface VideoContextProps {
    children: JSX.Element;
};

const noopBingeChannelUrl: Accessor<string | undefined> = () => undefined;

export const VideoProvider: ParentComponent<VideoContextProps> = (props) => {
    const [watchLater, setWatchLater] = createSignal<IOrderedPlatformVideo[]>();
    const [minimizedVideos, setMinimizedVideos] = createSignal<VideoContextValue[]>([]);
    const [activePlaybackVideoId, setActivePlaybackVideoId] = createSignal<string | undefined>();
    const [bingePager, setBingePager] = createSignal<Pager<IPlatformContent> | undefined>();
    const [bingeChannelUrl, setBingeChannelUrl] = createSignal<string | undefined>();
    const [bingeLoading, setBingeLoading] = createSignal<boolean>(false);
    let bingePagerConsumed = 0;
    let minimizedVideoId = 0;
    let mainVideo: VideoContextValue;
    let extendMainQueue: ((videos: IPlatformVideo[]) => void) | undefined;

    const contextInternals = new Map<string, {
        queueStartTimes: Accessor<(Duration | undefined)[] | undefined>;
    }>();

    const refetchWatchLater = async () => {
        const videos = await WatchLaterBackend.getAll();
        setWatchLater(videos);
    };

    const removeMinimizedVideo = (id: string) => {
        setMinimizedVideos(videos => videos.filter(v => v.id !== id));
        contextInternals.delete(id);
        if (activePlaybackVideoId() === id) {
            setActivePlaybackVideoId(undefined);
        }
    };

    const stopBinge = () => {
        batch(() => {
            setBingeChannelUrl(undefined);
            setBingePager(undefined);
        });
        bingePagerConsumed = 0;
    };

    const createVideoContext = (options: {
        id: string;
        initialState?: VideoState;
        initialIndex?: number;
        initialQueue?: IPlatformVideo[];
        initialStartTime?: Duration;
        initialQueueStartTimes?: (Duration | undefined)[];
        initialQueueMetadata?: (VideoQueueItemMeta | undefined)[];
        initialRepeat?: boolean;
        initialShuffle?: boolean;
        initialDesiredMode?: VideoMode;
        initialTheatrePinned?: boolean;
        initialVolume?: number;
        beforeReplace?: () => void;
        onClose?: (id: string) => void;
        onSetState?: (id: string, videoState: VideoState) => boolean;
        persistSettings?: boolean;
        isMain?: boolean;
    }): VideoContextValue => {
        const [queue, setQueue] = createSignal<IPlatformVideo[] | undefined>(options.initialQueue);
        const [queueStartTimes, setQueueStartTimes] = createSignal<(Duration | undefined)[] | undefined>(options.initialQueueStartTimes);
        const [queueMetadata, setQueueMetadata] = createSignal<(VideoQueueItemMeta | undefined)[] | undefined>(options.initialQueueMetadata);
        const [index, setIndex] = createSignal<number | undefined>(options.initialIndex);
        const [startTime, setStartTime] = createSignal<Duration | undefined>(options.initialStartTime);
        const [state, setState] = createSignal<VideoState>(options.initialState ?? VideoState.Closed);
        const [repeat, setRepeat] = createSignal<boolean>(options.initialRepeat ?? false);
        const [shuffle, setShuffle] = createSignal<boolean>(options.initialShuffle ?? false);
        const [desiredMode, setDesiredModeInternal] = createSignal<VideoMode>(options.initialDesiredMode ?? VideoMode.Theatre);
        const [theatrePinned, setTheatrePinnedInternal] = createSignal<boolean>(options.initialTheatrePinned ?? true);
        const [volume, setVolumeInternal] = createSignal<number>(options.initialVolume ?? 1);

        contextInternals.set(options.id, { queueStartTimes });

        const video = createMemo(() => {
            const q = queue();
            const i = index();
            if (!q || i === undefined || i < 0 || i >= q.length) {
                return undefined;
            }

            return q[i];
        });

        const setVideoState = (videoState: VideoState) => {
            if (options.onSetState?.(options.id, videoState)) {
                return;
            }

            setState(videoState);
        };

        const openVideo = (v: IPlatformVideo, time?: Duration, videoState?: VideoState) => {
            if (WindowBackend.consumeCmdClick() && v.url) {
                WindowBackend.openInNewWindow({ url: v.url })
                    .catch(e => console.warn("Failed to open video in new window", e));
                return;
            }
            options.beforeReplace?.();
            const desiredVideoState = videoState ?? VideoState.Maximized;
            batch(() => {
                setIndex(0);
                setStartTime(time);
                setQueueStartTimes(time ? [time] : undefined);
                setQueueMetadata(undefined);
                setQueue([ v ]);
                if (state() !== desiredVideoState)
                    setVideoState(desiredVideoState);
            });
        };

        const openVideoByUrl = async (url: string, time?: Duration, videoState?: VideoState) => {
            if (WindowBackend.consumeCmdClick() && url) {
                WindowBackend.openInNewWindow({ url })
                    .catch(e => console.warn("Failed to open video in new window", e));
                return;
            }
            options.beforeReplace?.();
            const desiredVideoState = videoState ?? VideoState.Maximized;
            if (state() !== desiredVideoState)
                setVideoState(desiredVideoState);
            const videoLoadResult = await DetailsBackend.videoLoad(url);
            batch(() => {
                setIndex(0);
                setStartTime(time);
                setQueueStartTimes(time ? [time] : undefined);
                setQueueMetadata(undefined);
                setQueue([ videoLoadResult.video ]);
            });
        };

        const sq = (targetIndex: number, nextQueue: IPlatformVideo[], nextRepeat?: boolean, nextShuffle?: boolean, videoState?: VideoState, time?: Duration, startTimes?: (Duration | undefined)[], metadata?: (VideoQueueItemMeta | undefined)[]) => {
            if (targetIndex < 0 || targetIndex >= nextQueue.length) {
                console.error("index not valid for queue", { index: targetIndex, queue: nextQueue });
                return;
            }

            options.beforeReplace?.();
            const desiredVideoState = videoState ?? VideoState.Maximized;
            const normalizedStartTimes = startTimes?.slice(0, nextQueue.length);
            const normalizedMetadata = metadata?.slice(0, nextQueue.length);
            batch(() => {
                setIndex(targetIndex);
                setQueue(nextQueue);
                setQueueStartTimes(normalizedStartTimes);
                setQueueMetadata(normalizedMetadata);
                setStartTime(normalizedStartTimes?.[targetIndex] ?? time);
                if (nextRepeat !== undefined)
                    setRepeat(nextRepeat);
                if (nextShuffle !== undefined)
                    setShuffle(nextShuffle);
                if (state() !== desiredVideoState)
                    setVideoState(desiredVideoState);
            });
        };

        const addToQueue = (nextVideo: IPlatformVideo) => {
            if (index() === undefined) {
                openVideo(nextVideo);
                return;
            }

            batch(() => {
                setQueue([ ... (queue() ?? []), nextVideo ]);
                setQueueStartTimes(prev => prev ? [...prev, undefined] : undefined);
                setQueueMetadata(prev => prev ? [...prev, undefined] : undefined);
            });
        };

        const replaceSmartMixTail = (sessionId: string, nextQueue: IPlatformVideo[], nextMetadata: (VideoQueueItemMeta | undefined)[]) => {
            const replacement = replaceUnplayedSmartMixTail(queue(), queueMetadata(), index(), sessionId, nextQueue, nextMetadata);
            if (!replacement) return false;
            batch(() => {
                setQueue(replacement.queue);
                setQueueMetadata(replacement.metadata);
            });
            return true;
        };

        const consumeAndSetIndex = (targetIndex: number) => {
            const currentIndex = index();
            const currentQueue = queue();
            if (currentIndex === undefined || !currentQueue || targetIndex === currentIndex) return;
            const newQueue = currentQueue.filter((_, i) => i !== currentIndex);
            const newIndex = targetIndex > currentIndex ? targetIndex - 1 : targetIndex;
            const newStartTimes = queueStartTimes()?.filter((_, i) => i !== currentIndex);
            const newMetadata = queueMetadata()?.filter((_, i) => i !== currentIndex);
            const resolvedIndex = Math.max(0, Math.min(newIndex, newQueue.length - 1));
            batch(() => {
                setQueue(newQueue);
                setIndex(resolvedIndex);
                setQueueStartTimes(newStartTimes);
                setQueueMetadata(newMetadata);
                setStartTime(newStartTimes?.[resolvedIndex]);
            });
        };

        const closeVideo = () => {
            batch(() => {
                setIndex(undefined);
                setQueue(undefined);
                setQueueStartTimes(undefined);
                setQueueMetadata(undefined);
                setStartTime(undefined);
                setState(VideoState.Closed);
                if (activePlaybackVideoId() === options.id) {
                    setActivePlaybackVideoId(undefined);
                }
                if (options.isMain) {
                    stopBinge();
                }
                options.onClose?.(options.id);
            });
        };

        const setDesiredMode = (mode: VideoMode) => {
            setDesiredModeInternal(mode);
            if (options.persistSettings) {
                SettingsBackend.persistSet("desiredMode", mode);
            }
        };

        const setTheatrePinned = (pinned: boolean) => {
            setTheatrePinnedInternal(pinned);
            if (options.persistSettings) {
                SettingsBackend.persistSet("theatrePinned", pinned);
            }
        };

        const setVolume = (nextVolume: number) => {
            setVolumeInternal(nextVolume);
            if (options.persistSettings) {
                SettingsBackend.persistSet("volume", nextVolume);
            }
        };

        const startBinge = (channelUrl: string, videos: IPlatformVideo[], pager: Pager<IPlatformContent>) => {
            if (!options.isMain || videos.length === 0) return;
            bingePagerConsumed = pager.data.length;
            batch(() => {
                setBingeChannelUrl(channelUrl);
                setBingePager(pager);
                sq(0, videos);
            });
        };

        if (options.isMain) {
            extendMainQueue = (videos: IPlatformVideo[]) => {
                batch(() => {
                    setQueue(prev => [ ...(prev ?? []), ...videos ]);
                    setQueueStartTimes(prev => prev ? [ ...prev, ...videos.map(() => undefined) ] : undefined);
                    setQueueMetadata(prev => prev ? [ ...prev, ...videos.map(() => undefined) ] : undefined);
                });
            };
        }

        return {
            id: options.id,
            index,
            queue,
            queueMetadata,
            watchLater,
            state,
            repeat,
            shuffle,
            video,
            startTime,
            desiredMode,
            theatrePinned,
            volume,
            bingeChannelUrl: options.isMain ? bingeChannelUrl : noopBingeChannelUrl,
            minimizedVideos,
            activePlaybackVideoId,
            actions: {
                setIndex: (i: number) => {
                    batch(() => {
                        setIndex(i);
                        setStartTime(queueStartTimes()?.[i]);
                    });
                },
                consumeAndSetIndex,
                openVideo,
                openVideoByUrl,
                setQueue: sq,
                closeVideo,
                addToQueue,
                replaceUnplayedSmartMixTail: replaceSmartMixTail,
                setState: setVideoState,
                setRepeat,
                setShuffle,
                setDesiredMode,
                setTheatrePinned,
                setVolume,
                refetchWatchLater,
                setStartTime,
                startBinge,
                stopBinge: options.isMain ? stopBinge : () => {},
                requestPlayback: () => setActivePlaybackVideoId(options.id)
            }
        };
    };

    const promoteMinimizedVideo = (id: string, videoState: VideoState) => {
        const minimizedVideo = minimizedVideos().find(v => v.id === id);
        const q = minimizedVideo?.queue();
        const i = minimizedVideo?.index();
        if (!minimizedVideo || !q || i === undefined) {
            return false;
        }

        const internals = contextInternals.get(id);
        batch(() => {
            mainVideo.actions.setDesiredMode(minimizedVideo.desiredMode());
            mainVideo.actions.setTheatrePinned(minimizedVideo.theatrePinned());
            mainVideo.actions.setVolume(minimizedVideo.volume());
            mainVideo.actions.setQueue(
                i,
                q,
                minimizedVideo.repeat(),
                minimizedVideo.shuffle(),
                videoState,
                minimizedVideo.startTime(),
                internals?.queueStartTimes(),
                minimizedVideo.queueMetadata()
            );
            removeMinimizedVideo(id);
        });
        return true;
    };

    const archiveMainVideoIfMinimized = () => {
        if (!mainVideo || mainVideo.state() !== VideoState.Minimized) {
            return;
        }

        const q = mainVideo.queue();
        const i = mainVideo.index();
        if (!q || i === undefined) {
            return;
        }

        const mainInternals = contextInternals.get("main");
        const id = `minimized-${++minimizedVideoId}`;
        const minimizedVideo = createVideoContext({
            id,
            initialState: VideoState.Minimized,
            initialIndex: i,
            initialQueue: [ ... q ],
            initialStartTime: mainVideo.startTime(),
            initialQueueStartTimes: mainInternals?.queueStartTimes() ? [ ... mainInternals.queueStartTimes()! ] : undefined,
            initialQueueMetadata: mainVideo.queueMetadata() ? [ ... mainVideo.queueMetadata()! ] : undefined,
            initialRepeat: mainVideo.repeat(),
            initialShuffle: mainVideo.shuffle(),
            initialDesiredMode: mainVideo.desiredMode(),
            initialTheatrePinned: mainVideo.theatrePinned(),
            initialVolume: mainVideo.volume(),
            onClose: removeMinimizedVideo,
            onSetState: (minimizedId, nextState) => {
                if (nextState === VideoState.Maximized || nextState === VideoState.Fullscreen) {
                    return promoteMinimizedVideo(minimizedId, nextState);
                }
                return false;
            }
        });
        setMinimizedVideos(videos => [ ... videos, minimizedVideo ]);
    };

    mainVideo = createVideoContext({
        id: "main",
        beforeReplace: archiveMainVideoIfMinimized,
        persistSettings: true,
        isMain: true
    });

    createEffect(() => {
        const q = mainVideo.queue();
        const i = mainVideo.index();
        const pager = bingePager();
        if (!q || i === undefined || !pager || bingeLoading()) return;
        if (q.length - 1 - i >= 5) return;
        if (!pager.hasMore) return;
        setBingeLoading(true);
        const beforeLength = pager.data.length;
        pager.nextPage()
            .then(() => {
                if (bingePager() !== pager || mainVideo.queue() === undefined) return;
                const newItems = (pager.data as IPlatformContent[]).slice(bingePagerConsumed);
                bingePagerConsumed = pager.data.length;
                if (pager.data.length === beforeLength) return;
                const videos = newItems.filter((v): v is IPlatformVideo => v?.contentType === ContentType.MEDIA);
                if (videos.length > 0) {
                    extendMainQueue?.(videos);
                }
            })
            .catch(() => {})
            .finally(() => setBingeLoading(false));
    });

    onMount(async () => {
        await refetchWatchLater();
    });

    StateWebsocket.registerHandlerNew("WatchLaterChanged", () => {
        refetchWatchLater();
    }, "videoProvider");

    SettingsBackend.persistGet("desiredMode", VideoMode.Theatre).then((r: VideoMode) => mainVideo.actions.setDesiredMode(r)).catch(e => console.error("Failed to get persistent setting 'desiredMode'.", e));
    SettingsBackend.persistGet("theatrePinned", true).then((r: boolean) => mainVideo.actions.setTheatrePinned(r)).catch(e => console.error("Failed to get persistent setting 'theatrePinned'.", e));
    SettingsBackend.persistGet("volume", 1).then((r: number) => mainVideo.actions.setVolume(r)).catch(e => console.error("Failed to get persistent setting 'volume'.", e));

    SettingsBackend.persistGet("playQueue", null).then((r: any) => {
        if (StateGlobal.settings$()?.object?.playback?.persistQueue === false) return;
        if (!r || !Array.isArray(r.queue) || r.queue.length === 0) return;
        mainVideo.actions.setQueue(
            typeof r.index === 'number' ? r.index : 0,
            r.queue,
            typeof r.repeat === 'boolean' ? r.repeat : undefined,
            typeof r.shuffle === 'boolean' ? r.shuffle : undefined
        );
    }).catch(e => console.error("Failed to get persistent setting 'playQueue'.", e));

    createEffect(() => {
        const q = mainVideo.queue();
        const i = mainVideo.index();
        const r = mainVideo.repeat();
        const s = mainVideo.shuffle();
        if (StateGlobal.settings$()?.object?.playback?.persistQueue === false) return;
        const payload = (q && q.length > 0) ? { queue: q, index: i, repeat: r, shuffle: s } : null;
        SettingsBackend.persistSet("playQueue", payload).catch(e => console.warn("Failed to persist playQueue", e));
    });

    return (
        <VideoContext.Provider value={mainVideo}>
            {props.children}
        </VideoContext.Provider>
    );
}

export function useVideo() { return useContext(VideoContext); }
