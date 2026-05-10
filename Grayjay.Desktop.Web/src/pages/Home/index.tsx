import { createResource, type Component, Show, For, onMount, onCleanup } from 'solid-js';

import styles from './index.module.css';
import { HistoryBackend } from '../../backend/HistoryBackend';
import { WatchLaterBackend } from '../../backend/WatchLaterBackend';
import { SubscriptionsBackend } from '../../backend/SubscriptionsBackend';
import NavigationBar from '../../components/topbars/NavigationBar';
import ScrollContainer from '../../components/containers/ScrollContainer';
import StateGlobal from '../../state/StateGlobal';
import IconButton from '../../components/buttons/IconButton';
import { getKeybinding } from '../../state/StateKeybindings';
import { useNavigate } from '@solidjs/router';
import EmptyContentView from '../../components/EmptyContentView';
import HomeCarousel from '../../components/containers/HomeCarousel';
import HeroBanner from '../../components/home/HeroBanner';
import VideoThumbnailView from '../../components/content/VideoThumbnailView';
import { IPlatformVideo } from '../../backend/models/content/IPlatformVideo';
import { IHistoryVideo } from '../../backend/models/content/IHistoryVideo';
import { useVideo } from '../../contexts/VideoProvider';

import iconRefresh from "../../assets/icons/icon_reload_temp.svg";
import iconHome from "../../assets/icons/icon_nav_home.svg";
import iconSources from "../../assets/icons/ic_circles.svg";

const THUMB_STYLE = { width: '280px', "flex-shrink": '0' };
const MAX_CAROUSEL_ITEMS = 20;
const MIN_WATCH_POSITION = 30;
const HERO_COUNT = 5;
const MAX_CHANNEL_CAROUSELS = 10;

const MIN_CHANNEL_VIDEOS = 3;

interface ChannelGroup {
    author: IPlatformVideo['author'];
    videos: IPlatformVideo[];
}

const HomePage: Component = () => {
    const homePager = StateGlobal.home$;
    const video = useVideo();
    const nav = useNavigate();

    const lastHomeMillis = Math.abs(StateGlobal.lastHomeTime$()?.diffNow().toMillis() ?? 0);
    if (lastHomeMillis > 2 * 60 * 1000) {
        StateGlobal.reloadHome();
    }

    const onKeyDown = (e: KeyboardEvent) => {
        const t = e.target as HTMLElement | null;
        if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.isContentEditable) return;
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        if (e.key === getKeybinding("reload")) {
            StateGlobal.reloadHome();
            e.preventDefault();
        }
    };
    onMount(() => window.addEventListener("keydown", onKeyDown));
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));

    const [historyItems] = createResource(async () => {
        try {
            const pager = await HistoryBackend.historyPager();
            return pager.data
                .filter((h: IHistoryVideo) => h.position > MIN_WATCH_POSITION)
                .slice(0, MAX_CAROUSEL_ITEMS);
        } catch {
            return [] as IHistoryVideo[];
        }
    });

    const [watchLaterItems] = createResource(async () => {
        try {
            return await WatchLaterBackend.getAll();
        } catch {
            return [] as IPlatformVideo[];
        }
    });

    // Per-channel carousels from subscriptions cache
    const [channelCarousels] = createResource(async (): Promise<{ dedicated: ChannelGroup[], misc: IPlatformVideo[] }> => {
        try {
            const result = await SubscriptionsBackend.subscriptionsCacheLoad();
            const groups = new Map<string, ChannelGroup>();
            for (const video of result.results as IPlatformVideo[]) {
                const key = video.author?.url ?? video.author?.name ?? 'unknown';
                if (!groups.has(key)) groups.set(key, { author: video.author, videos: [] });
                groups.get(key)!.videos.push(video);
            }
            const sorted = [...groups.values()].sort((a, b) => {
                const da = new Date(a.videos[0]?.dateTime ?? 0).getTime();
                const db = new Date(b.videos[0]?.dateTime ?? 0).getTime();
                return db - da;
            });
            // Channels with enough videos get their own carousel
            const dedicated = sorted
                .filter(g => g.videos.length >= MIN_CHANNEL_VIDEOS)
                .slice(0, MAX_CHANNEL_CAROUSELS);
            // Channels with too few videos are aggregated
            const misc = sorted
                .filter(g => g.videos.length < MIN_CHANNEL_VIDEOS)
                .flatMap(g => g.videos)
                .slice(0, MAX_CAROUSEL_ITEMS);
            return { dedicated, misc };
        } catch {
            return { dedicated: [], misc: [] };
        }
    });

    function openVideo(v: IPlatformVideo) {
        video?.actions.openVideo(v);
    }

    // First N videos for the hero slider — available as soon as pager starts loading
    const heroVideos = () => homePager()?.data?.slice(0, HERO_COUNT) ?? [];

    // Recommended = everything after the hero videos
    const recommendedItems = () => homePager()?.data?.slice(HERO_COUNT) ?? [];

    return (
        <div class={styles.container}>
            <NavigationBar isRoot={true} childrenAfter={
                <IconButton
                    icon={iconRefresh}
                    variant="none"
                    shape="circle"
                    width="30px"
                    height="30px"
                    iconInset="0px"
                    style={{ "margin-left": "24px" }}
                    onClick={() => StateGlobal.reloadHome()}
                    focusableOpts={{
                        groupId: 'nav-bar',
                        groupIndices: [1],
                        groupType: 'horizontal',
                        onPress: () => StateGlobal.reloadHome(),
                    }}
                />
            } />

            {/* Page is always visible — each section appears as data arrives */}
            <ScrollContainer>
                <Show when={heroVideos().length > 0}>
                    <HeroBanner
                        videos={heroVideos()}
                        onPlay={openVideo}
                        intervalMs={10000}
                    />
                </Show>

                <Show when={(historyItems()?.length ?? 0) > 0}>
                    <HomeCarousel
                        title="Continue watching"
                        items={historyItems()!}
                        builder={(_, item: IHistoryVideo) => (
                            <VideoThumbnailView
                                style={THUMB_STYLE}
                                video={{ ...item.video, metadata: { position: item.position } } as any}
                                onClick={() => openVideo(item.video)}
                            />
                        )}
                    />
                </Show>

                <Show when={(watchLaterItems()?.length ?? 0) > 0}>
                    <HomeCarousel
                        title="Watch later"
                        items={watchLaterItems()!}
                        builder={(_, item: IPlatformVideo) => (
                            <VideoThumbnailView
                                style={THUMB_STYLE}
                                video={item}
                                onClick={() => openVideo(item)}
                            />
                        )}
                    />
                </Show>

                {/* Per-channel carousels — only channels with enough videos */}
                <Show when={(channelCarousels()?.dedicated?.length ?? 0) > 0}>
                    <For each={channelCarousels()!.dedicated}>
                        {(group) => (
                            <HomeCarousel
                                title={group.author?.name ?? 'Unknown channel'}
                                items={group.videos.slice(0, MAX_CAROUSEL_ITEMS)}
                                builder={(_, item: IPlatformVideo) => (
                                    <VideoThumbnailView
                                        style={THUMB_STYLE}
                                        video={item}
                                        onClick={() => openVideo(item)}
                                    />
                                )}
                            />
                        )}
                    </For>
                </Show>

                {/* Aggregate carousel for channels with few videos */}
                <Show when={(channelCarousels()?.misc?.length ?? 0) > 0}>
                    <HomeCarousel
                        title="From your subscriptions"
                        items={channelCarousels()!.misc}
                        builder={(_, item: IPlatformVideo) => (
                            <VideoThumbnailView
                                style={THUMB_STYLE}
                                video={item}
                                onClick={() => openVideo(item)}
                            />
                        )}
                    />
                </Show>

                {/* Recommended — fallback/complement from home pager */}
                <Show when={recommendedItems().length > 0}>
                    <HomeCarousel
                        title="Recommended"
                        items={recommendedItems()}
                        builder={(_, item: IPlatformVideo) => (
                            <VideoThumbnailView
                                style={THUMB_STYLE}
                                video={item}
                                onClick={() => openVideo(item)}
                            />
                        )}
                    />
                </Show>

                {/* Empty state — only when pager is done and truly empty */}
                <Show when={homePager.state === 'ready' && (homePager()?.data?.length ?? 0) === 0}>
                    <EmptyContentView
                        icon={iconHome}
                        title='No home results'
                        description='Install, configure, or enable more sources'
                        actions={[
                            {
                                icon: iconSources,
                                title: "Go to Sources",
                                action: () => nav("/web/sources")
                            }
                        ]}
                    />
                </Show>
            </ScrollContainer>
        </div>
    );
};

export default HomePage;
