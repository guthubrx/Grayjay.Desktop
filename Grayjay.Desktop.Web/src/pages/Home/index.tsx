import { createSignal, createResource, createEffect, type Component, Show, For, onMount, onCleanup } from 'solid-js';

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

const STORAGE_HOME_CACHE = 'grayjay_home_cache';
const HOME_CACHE_SIZE = 20;

function loadHomeCache(): IPlatformVideo[] {
    try { return JSON.parse(localStorage.getItem(STORAGE_HOME_CACHE) ?? '[]'); }
    catch { return []; }
}

function getDismissed(): { videos: Set<string>; channels: Set<string> } {
    const parse = (key: string): Set<string> => {
        try { return new Set(JSON.parse(localStorage.getItem(key) ?? '[]')); }
        catch { return new Set(); }
    };
    return {
        videos: parse('grayjay_dismissed_videos'),
        channels: parse('grayjay_dismissed_channels'),
    };
}

const MIN_CHANNEL_VIDEOS = 3;

interface GroupCarousel {
    name: string;
    videos: IPlatformVideo[];
}

function buildGroupCarousels(subGroups: ISubscriptionGroup[], allVideos: IPlatformVideo[]): GroupCarousel[] {
    const byChannel = new Map<string, IPlatformVideo[]>();
    for (const v of allVideos) {
        const key = v.author?.url ?? '';
        if (!byChannel.has(key)) byChannel.set(key, []);
        byChannel.get(key)!.push(v);
    }
    if (subGroups.length > 0) {
        return subGroups.map(g => ({
            name: g.name,
            videos: g.urls
                .flatMap(url => byChannel.get(url) ?? [])
                .sort((a, b) => new Date(b.dateTime ?? 0).getTime() - new Date(a.dateTime ?? 0).getTime())
                .slice(0, MAX_CAROUSEL_ITEMS)
        })).filter(g => g.videos.length > 0);
    }
    return [...byChannel.values()]
        .filter(vs => vs.length >= MIN_CHANNEL_VIDEOS)
        .sort((a, b) => new Date(b[0]?.dateTime ?? 0).getTime() - new Date(a[0]?.dateTime ?? 0).getTime())
        .slice(0, MAX_CHANNEL_CAROUSELS)
        .map(vs => ({ name: vs[0]?.author?.name ?? 'Unknown', videos: vs.slice(0, MAX_CAROUSEL_ITEMS) }));
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

    const [dismissRevision, setDismissRevision] = createSignal(0);

    // Hero cache — populated from localStorage, refreshed when pager resolves
    const [homeCached, setHomeCached] = createSignal<IPlatformVideo[]>(loadHomeCache());
    createEffect(() => {
        const pager = homePager();
        if (!pager) return;
        void pager.hadInitialUpdate$?.(); // re-run on first WebSocket push too
        const data = pager.data as IPlatformVideo[];
        if (data.length === 0) return;
        try { localStorage.setItem(STORAGE_HOME_CACHE, JSON.stringify(data.slice(0, HOME_CACHE_SIZE))); } catch {}
        setHomeCached([...data]);
    });

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

    // Subscription group carousels — stale-while-revalidate:
    // Phase 1 (fast): show cached data immediately
    // Phase 2 (background): refresh per group and update as results arrive
    const [groupCarousels, setGroupCarousels] = createSignal<GroupCarousel[]>([]);
    let groupsAborted = false;
    onCleanup(() => { groupsAborted = true; });

    onMount(async () => {
        try {
            const [subGroups, cached] = await Promise.all([
                SubscriptionsBackend.subscriptionGroups(),
                SubscriptionsBackend.subscriptionsCacheLoad()
            ]);
            if (groupsAborted) return;

            // Phase 1: display cache immediately
            setGroupCarousels(buildGroupCarousels(subGroups, cached.results as IPlatformVideo[]));

            // Phase 2: refresh in background
            if (subGroups.length > 0) {
                for (const group of subGroups) {
                    SubscriptionsBackend.subscriptionGroupLoad(group.id, true)
                        .then(fresh => {
                            if (groupsAborted) return;
                            const freshVideos = (fresh.results as IPlatformVideo[])
                                .sort((a, b) => new Date(b.dateTime ?? 0).getTime() - new Date(a.dateTime ?? 0).getTime())
                                .slice(0, MAX_CAROUSEL_ITEMS);
                            if (freshVideos.length === 0) return;
                            setGroupCarousels(prev => {
                                const existing = prev.find(g => g.name === group.name);
                                if (existing) return prev.map(g => g.name === group.name ? { ...g, videos: freshVideos } : g);
                                return [...prev, { name: group.name, videos: freshVideos }];
                            });
                        })
                        .catch(() => {});
                }
            } else {
                SubscriptionsBackend.subscriptionsLoad(true)
                    .then(fresh => {
                        if (groupsAborted) return;
                        setGroupCarousels(buildGroupCarousels(subGroups, fresh.results as IPlatformVideo[]));
                    })
                    .catch(() => {});
            }
        } catch {}
    });

    function openVideo(v: IPlatformVideo) {
        video?.actions.openVideo(v);
    }

    // Hero videos — served from cache immediately, refreshed when pager resolves
    const heroVideos = () => {
        void dismissRevision();
        const { videos, channels } = getDismissed();
        const watched = new Set((historyItems() ?? []).map(h => h.video?.url).filter(Boolean));
        return homeCached()
            .filter(v => !videos.has(v.url ?? '') && !channels.has(v.author?.url ?? '') && !watched.has(v.url ?? ''))
            .slice(0, HERO_COUNT);
    };

    // Recommended = home pager items after the hero, with valid metadata only
    const recommendedItems = () =>
        (homePager()?.data?.slice(HERO_COUNT) ?? [])
            .filter(v => v.name && v.name.trim() && (v as IPlatformVideo).duration > 0) as IPlatformVideo[];

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
                        onDismissed={() => setDismissRevision(r => r + 1)}
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

                {/* Subscription group carousels */}
                <Show when={(groupCarousels()?.length ?? 0) > 0}>
                    <For each={groupCarousels()}>
                        {(group) => (
                            <HomeCarousel
                                title={group.name}
                                items={group.videos}
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
                <Show when={homePager.state === 'ready' && (homePager()?.data?.length ?? 0) === 0 && homeCached().length === 0}>
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
