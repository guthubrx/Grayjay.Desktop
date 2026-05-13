import { createContext, useContext, JSX, ParentComponent, createSignal, Accessor, batch, createMemo, createEffect, onMount } from "solid-js";
import StateGlobal from "../state/StateGlobal";
import { range, shuffleArray } from "../utility";
import { IOrderedPlatformVideo, WatchLaterBackend } from "../backend/WatchLaterBackend";
import { IPlatformVideo } from "../backend/models/content/IPlatformVideo";
import { IPlatformContent } from "../backend/models/content/IPlatformContent";
import { ContentType } from "../backend/models/ContentType";
import { Duration } from "luxon";
import { SettingsBackend } from "../backend/SettingsBackend";
import StateWebsocket from "../state/StateWebsocket";
import { DetailsBackend } from "../backend/DetailsBackend";
import { Pager } from "../backend/models/pagers/Pager";

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

export interface VideoContextState {
    state: VideoState;
    index?: number;
    queue?: IPlatformVideo[];
};

export interface VideoContextValue {
    state: Accessor<VideoState>;
    index: Accessor<number | undefined>;
    queue: Accessor<IPlatformVideo[] | undefined>;
    watchLater: Accessor<IOrderedPlatformVideo[] | undefined>;
    video: Accessor<IPlatformVideo | undefined>;
    repeat: Accessor<boolean>;
    shuffle: Accessor<boolean>;
    startTime: Accessor<Duration | undefined>;
    desiredMode: Accessor<VideoMode>;
    theatrePinned: Accessor<boolean>;
    volume: Accessor<number>;
    bingeChannelUrl: Accessor<string | undefined>;
    //queueType watch later, playlist en queue of undefined
    actions: {
        openVideo: (video: IPlatformVideo, time?: Duration, videoState?: VideoState) => void;
        openVideoByUrl: (url: string, time?: Duration, videoState?: VideoState) => void;
        setQueue: (index: number, queue: IPlatformVideo[], repeat?: boolean, shuffle?: boolean, videoState?: VideoState) => void;
        addToQueue: (v: IPlatformVideo) => void;
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
    }
};

const VideoContext = createContext<VideoContextValue>();
export interface VideoContextProps {
    children: JSX.Element;
};

export const VideoProvider: ParentComponent<VideoContextProps> = (props) => {
    const [queue, setQueue] = createSignal<IPlatformVideo[] | undefined>();
    const [index, setIndex] = createSignal<number | undefined>();
    const [startTime, setStartTime] = createSignal<Duration | undefined>();
    const [state, setState] = createSignal<VideoState>(VideoState.Closed);
    const [repeat, setRepeat] = createSignal<boolean>(false);
    const [shuffle, setShuffle] = createSignal<boolean>(false);
    const [desiredMode, setDesiredModeInternal] = createSignal<VideoMode>(VideoMode.Theatre);
    const [theatrePinned, setTheatrePinnedInternal] = createSignal<boolean>(true);
    const [volume, setVolumeInternal] = createSignal<number>(1);
    const [bingePager, setBingePager] = createSignal<Pager<IPlatformContent> | undefined>();
    const [bingeChannelUrl, setBingeChannelUrl] = createSignal<string | undefined>();
    const [bingeLoading, setBingeLoading] = createSignal<boolean>(false);
    let bingePagerConsumed = 0;
    const video = createMemo(() => {
        const q = queue();
        const i = index();
        if (!q || i === undefined || i < 0 || i >= q.length) {
            return undefined;
        }

        return q[i];
    })

    const openVideo = (v: IPlatformVideo, time?: Duration, videoState?: VideoState) => { 
        const desiredVideoState = videoState ?? VideoState.Maximized;
        batch(() => {
            setIndex(0);
            setStartTime(time);
            setQueue([ v ]);
            if (state() !== desiredVideoState)
                setState(desiredVideoState);
        });
    };
    const openVideoByUrl = async (url: string, time?: Duration, videoState?: VideoState) => { 
        const desiredVideoState = videoState ?? VideoState.Maximized;
        if (state() !== desiredVideoState)
            setState(desiredVideoState);
        const videoLoadResult = await DetailsBackend.videoLoad(url);
        batch(() => {
            setIndex(0);
            setStartTime(time);
            setQueue([ videoLoadResult.video ]);

        });
    };
    const sq = (index: number, queue: IPlatformVideo[], repeat?: boolean, shuffle?: boolean, videoState?: VideoState) => { 
        if (index < 0 || index >= queue.length) {
            console.error("index not valid for queue", {index, queue});
            return;
        }

        const desiredVideoState = videoState ?? VideoState.Maximized;
        batch(() => {
            setIndex(index);
            setQueue(queue);
            setStartTime(undefined);
            if (repeat !== undefined)
                setRepeat(repeat);
            if (shuffle !== undefined)
                setShuffle(shuffle);
            if (state() !== desiredVideoState)
                setState(desiredVideoState);
        });
    };
    const addToQueue = (video: IPlatformVideo) => { 
        if (index() === undefined) {
            openVideo(video);
            return;
        }

        setQueue([ ... (queue() ?? []), video ]);
    };
    const consumeAndSetIndex = (targetIndex: number) => {
        const currentIndex = index();
        const currentQueue = queue();
        if (currentIndex === undefined || !currentQueue || targetIndex === currentIndex) return;
        const newQueue = currentQueue.filter((_, i) => i !== currentIndex);
        const newIndex = targetIndex > currentIndex ? targetIndex - 1 : targetIndex;
        batch(() => {
            setQueue(newQueue);
            setIndex(Math.max(0, Math.min(newIndex, newQueue.length - 1)));
            setStartTime(undefined);
        });
    };

    const stopBinge = () => {
        batch(() => {
            setBingeChannelUrl(undefined);
            setBingePager(undefined);
        });
        bingePagerConsumed = 0;
    };

    const startBinge = (channelUrl: string, videos: IPlatformVideo[], pager: Pager<IPlatformContent>) => {
        if (videos.length === 0) return;
        bingePagerConsumed = pager.data.length;
        batch(() => {
            setBingeChannelUrl(channelUrl);
            setBingePager(pager);
            sq(0, videos);
        });
    };

    // Auto-extend the queue when fewer than 5 videos remain ahead in a binge session.
    // Tracks consumed pager offset separately from queue length so non-video items (posts,
    // playlists) filtered out of the queue do not corrupt subsequent slice boundaries.
    createEffect(() => {
        const q = queue();
        const i = index();
        const pager = bingePager();
        if (!q || i === undefined || !pager || bingeLoading()) return;
        if (q.length - 1 - i >= 5) return;
        if (!pager.hasMore) return;
        setBingeLoading(true);
        const beforeLength = pager.data.length;
        pager.nextPage()
            .then(() => {
                // The user may have closed the video or started a different binge while the
                // page was loading. In both cases the captured pager is no longer current.
                if (bingePager() !== pager || queue() === undefined) return;
                const newItems = (pager.data as IPlatformContent[]).slice(bingePagerConsumed);
                bingePagerConsumed = pager.data.length;
                if (pager.data.length === beforeLength) return;
                const videos = newItems.filter((v): v is IPlatformVideo => v?.contentType === ContentType.MEDIA);
                if (videos.length > 0) {
                    setQueue([...(queue() ?? []), ...videos]);
                }
            })
            .catch(() => {})
            .finally(() => setBingeLoading(false));
    });


    const closeVideo = () => {
        batch(()=>{
            setIndex(undefined);
            setQueue(undefined);
            setStartTime(undefined);
            setState(VideoState.Closed);
            setBingeChannelUrl(undefined);
            setBingePager(undefined);
        });
    };

    const refetchWatchLater = async () => {
        const videos = await WatchLaterBackend.getAll();
        setWatchLater(videos);
    }
    const [watchLater, setWatchLater] = createSignal<IOrderedPlatformVideo[]>();
    onMount(async () => {
        await refetchWatchLater();
    });

    const setDesiredMode = (mode: VideoMode) => {
        setDesiredModeInternal(mode);
        SettingsBackend.persistSet("desiredMode", mode);
    };

    const setTheatrePinned = (pinned: boolean) => {
        setTheatrePinnedInternal(pinned);
        SettingsBackend.persistSet("theatrePinned", pinned);
    };

    const setVolume = (volume: number) => {
        setVolumeInternal(volume);
        SettingsBackend.persistSet("volume", volume);
    };

    StateWebsocket.registerHandlerNew("WatchLaterChanged", (packet)=>{
        refetchWatchLater();
    }, "videoProvider");
    
    const value: VideoContextValue = {
        index,
        queue,
        watchLater,
        state,
        repeat,
        shuffle,
        video,
        startTime,
        desiredMode,
        theatrePinned,
        volume,
        bingeChannelUrl,
        actions: {
            setIndex: (i: number) => {
                batch(() => {
                    setIndex(i);
                    setStartTime(undefined);
                });
            },
            consumeAndSetIndex,
            openVideo,
            openVideoByUrl,
            setQueue: sq,
            closeVideo,
            addToQueue,
            setState: (videoState: VideoState) => {
                setState(videoState);
            },
            setRepeat,
            setShuffle,
            setDesiredMode,
            setTheatrePinned,
            setVolume,
            refetchWatchLater,
            setStartTime,
            startBinge,
            stopBinge
        }
    };

    SettingsBackend.persistGet("desiredMode", VideoMode.Theatre).then((r: VideoMode) => setDesiredModeInternal(r)).catch(e => console.error("Failed to get persistent setting 'desiredMode'.", e));
    SettingsBackend.persistGet("theatrePinned", true).then((r: boolean) => setTheatrePinnedInternal(r)).catch(e => console.error("Failed to get persistent setting 'theatrePinned'.", e));
    SettingsBackend.persistGet("volume", 1).then((r: number) => setVolumeInternal(r)).catch(e => console.error("Failed to get persistent setting 'volume'.", e));

    SettingsBackend.persistGet("playQueue", null).then((r: any) => {
        if (StateGlobal.settings$()?.object?.playback?.persistQueue === false) return;
        if (!r || !Array.isArray(r.queue) || r.queue.length === 0) return;
        batch(() => {
            setQueue(r.queue);
            setIndex(typeof r.index === 'number' ? r.index : 0);
            if (typeof r.repeat === 'boolean') setRepeat(r.repeat);
            if (typeof r.shuffle === 'boolean') setShuffle(r.shuffle);
        });
    }).catch(e => console.error("Failed to get persistent setting 'playQueue'.", e));

    createEffect(() => {
        const q = queue();
        const i = index();
        const r = repeat();
        const s = shuffle();
        if (StateGlobal.settings$()?.object?.playback?.persistQueue === false) return;
        const payload = (q && q.length > 0) ? { queue: q, index: i, repeat: r, shuffle: s } : null;
        SettingsBackend.persistSet("playQueue", payload).catch(e => console.warn("Failed to persist playQueue", e));
    });

    return (
        <VideoContext.Provider value={value}>
            {props.children}
        </VideoContext.Provider>
    );
}

export function useVideo() { return useContext(VideoContext); }