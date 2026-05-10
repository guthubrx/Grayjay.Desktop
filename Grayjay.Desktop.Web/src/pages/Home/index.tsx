import { createSignal, createResource, createEffect, createMemo, batch, type Component, Show, For, onMount, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';

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
import SettingsMenu, { Menu, MenuItemButton } from '../../components/menus/Overlays/SettingsMenu';
import Anchor, { AnchorStyle } from '../../utility/Anchor';
import UIOverlay from '../../state/UIOverlay';

import { homeStyle$ } from '../../state/HomeStyleState';

import iconRefresh from "../../assets/icons/icon_reload_temp.svg";
import iconHome from "../../assets/icons/icon_nav_home.svg";
import iconSources from "../../assets/icons/ic_circles.svg";
import iconQueue from "../../assets/icons/icon_add_to_queue.svg";
import iconWatchLaterMenu from "../../assets/icons/icon24_watch_later.svg";
import iconCreator from "../../assets/icons/icon_nav_creators.svg";
import iconDownload from "../../assets/icons/icon24_download.svg";
import iconAddToPlaylist from "../../assets/icons/icon24_add_to_playlist.svg";

const THUMB_STYLE = { width: '280px', "flex-shrink": '0' };
const MAX_CAROUSEL_ITEMS = 20;
const MIN_WATCH_POSITION = 30;
const HERO_COUNT = 10;
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

    // Reactive dismiss sets — source of vérité pour heroVideos()
    const [dismissedVideos$, setDismissedVideos] = createSignal<Set<string>>(getDismissed().videos);
    const [dismissedChannels$, setDismissedChannels] = createSignal<Set<string>>(getDismissed().channels);

    const handleDismissVideo = (url: string) => {
        const next = new Set([...dismissedVideos$(), url]);
        setDismissedVideos(next);
        try { localStorage.setItem('grayjay_dismissed_videos', JSON.stringify([...next])); } catch {}
    };
    const handleDismissChannel = (url: string) => {
        const next = new Set([...dismissedChannels$(), url]);
        setDismissedChannels(next);
        try { localStorage.setItem('grayjay_dismissed_channels', JSON.stringify([...next])); } catch {}
    };

    // Hero cache — starts from localStorage, updated when pager has live data (sans vidéos dismissées)
    const [homeCached, setHomeCached] = createSignal<IPlatformVideo[]>(loadHomeCache());
    createEffect(() => {
        const pager = homePager();
        if (!pager) return;
        void pager.hadInitialUpdate$?.();
        const data = pager.data as IPlatformVideo[];
        if (data.length === 0) return;
        const dV = dismissedVideos$();
        const dC = dismissedChannels$();
        const filtered = data.filter(v => !dV.has(v.url ?? '') && !dC.has(v.author?.url ?? ''));
        try { localStorage.setItem(STORAGE_HOME_CACHE, JSON.stringify(filtered.slice(0, HOME_CACHE_SIZE))); } catch {}
        setHomeCached([...data]);
    });

    const [historyItems] = createResource(async () => {
        try {
            const pager = await HistoryBackend.historyPager();
            return pager.data
                .filter((h: IHistoryVideo) => {
                    const dur = h.video?.duration;
                    return h.position > MIN_WATCH_POSITION && !(dur > 0 && h.position >= dur * 0.9);
                })
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
            // Phase 0 : cache disque seul — le plus rapide, débloque le hero immédiatement
            const cached = await SubscriptionsBackend.subscriptionsCacheLoad();
            if (groupsAborted) return;
            const cachedVideos = cached.results as IPlatformVideo[];
            if (cachedVideos.length > 0)
                setGroupCarousels(buildGroupCarousels([], cachedVideos));

            // Phase 1 : groupes disponibles — réorganise les carousels sans attendre le réseau
            const subGroups = await SubscriptionsBackend.subscriptionGroups();
            if (groupsAborted) return;
            if (cachedVideos.length > 0)
                setGroupCarousels(buildGroupCarousels(subGroups, cachedVideos));

            // Phase 2 : refresh réseau en arrière-plan
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

    // ── Video context menu (same pattern as VideoDetailView recMenu) ──────────
    const [videoMenuContent$, setVideoMenuContent] = createSignal<IPlatformVideo | undefined>();
    const [videoMenuShow$, setVideoMenuShow] = createSignal(false);
    const videoMenuAnchorRight = new Anchor(null, videoMenuShow$, AnchorStyle.BottomRight);
    const videoMenuAnchorLeft  = new Anchor(null, videoMenuShow$, AnchorStyle.BottomLeft);
    const [videoMenuAnchor$, setVideoMenuAnchor] = createSignal<Anchor>(videoMenuAnchorRight);

    const videoMenu$ = createMemo<Menu>(() => {
        const c = videoMenuContent$();
        const inQueue = c ? (video?.queue()?.some(x => x.url === c.url) ?? false) : false;
        return { title: '', items: c ? [
            new MenuItemButton('Open channel', iconCreator, undefined, () => {
                if (c.author) nav('/web/channel?url=' + encodeURIComponent(c.author.url), { state: { author: c.author } });
            }),
            inQueue
                ? new MenuItemButton('Remove from queue', iconQueue, undefined, () => {
                    const q = video?.queue();
                    const idx = q?.findIndex(x => x.url === c.url);
                    if (!video || !q || idx === undefined || idx < 0) return;
                    const cur = video.index() ?? 0;
                    video.actions.setQueue(cur > idx ? cur - 1 : cur, q.slice(0, idx).concat(q.slice(idx + 1)), video.repeat(), video.shuffle());
                })
                : new MenuItemButton('Add to queue', iconQueue, undefined, () => video?.actions.addToQueue(c)),
            new MenuItemButton('Watch later', iconWatchLaterMenu, undefined, () => WatchLaterBackend.add(c).catch(() => {})),
            new MenuItemButton('Add to playlist', iconAddToPlaylist, undefined, () => UIOverlay.overlayAddToPlaylist(c)),
            new MenuItemButton('Download video', iconDownload, undefined, () => UIOverlay.overlayDownload(c.url)),
        ] : [] };
    });

    const openVideoMenu = (el: HTMLElement, c: IPlatformVideo) => {
        const rect = el.getBoundingClientRect();
        const a = rect.right < 280 ? videoMenuAnchorLeft : videoMenuAnchorRight;
        a.setElement(el);
        batch(() => { setVideoMenuAnchor(a); setVideoMenuContent(c); setVideoMenuShow(true); });
    };

    // Reactive set of already-watched video URLs (position > MIN_WATCH_POSITION)
    const watchedUrls = () => new Set(
        (historyItems() ?? []).map(h => h.video?.url).filter(Boolean) as string[]
    );

    // Hero videos — 1:1 interleave of recent subs + platform recos, thumbnail required
    const heroVideos = () => {
        const dVideos = dismissedVideos$();
        const dChannels = dismissedChannels$();
        const watched = watchedUrls();
        const exclude = (v: IPlatformVideo) =>
            dVideos.has(v.url ?? '') || dChannels.has(v.author?.url ?? '') ||
            watched.has(v.url ?? '') || !(v.thumbnails?.sources?.some(s => s?.url));

        // Subs: flatten groupCarousels (already loaded, no extra request)
        const subs = groupCarousels()
            .flatMap(g => g.videos)
            .sort((a, b) => new Date(b.dateTime ?? 0).getTime() - new Date(a.dateTime ?? 0).getTime())
            .filter(v => !exclude(v));

        // Recos: live pager preferred, cache as fallback
        const live = (homePager()?.data ?? []) as IPlatformVideo[];
        const recos = (live.length > 0 ? live : homeCached()).filter(v => !exclude(v));

        // 1:1 interleave: sub, reco, sub, reco…
        const seen = new Set<string>();
        const result: IPlatformVideo[] = [];
        const max = Math.max(subs.length, recos.length);
        for (let i = 0; i < max && result.length < HERO_COUNT; i++) {
            for (const pool of [subs, recos]) {
                if (result.length >= HERO_COUNT) break;
                const v = pool[i];
                if (v && !seen.has(v.url ?? '')) { seen.add(v.url ?? ''); result.push(v); }
            }
        }
        return result;
    };

    // Continue watching — excludes dismissed videos/channels
    const continueWatchingItems = () => {
        const dV = dismissedVideos$();
        const dC = dismissedChannels$();
        return (historyItems() ?? []).filter(h =>
            !dV.has(h.video?.url ?? '') && !dC.has(h.video?.author?.url ?? '')
        );
    };

    // Recommended = home pager items after the hero, with valid metadata only, excluding watched
    const recommendedItems = () => {
        const watched = watchedUrls();
        return (homePager()?.data?.slice(HERO_COUNT) ?? [])
            .filter(v => v.name && v.name.trim() && (v as IPlatformVideo).duration > 0 && !watched.has((v as IPlatformVideo).url ?? '')) as IPlatformVideo[];
    };

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
                    style={{ 'margin-left': '24px' }}
                    onClick={() => StateGlobal.reloadHome()}
                    focusableOpts={{
                        groupId: 'nav-bar',
                        groupIndices: [1],
                        groupType: 'horizontal',
                        onPress: () => StateGlobal.reloadHome(),
                    }}
                />
            } />

            {/* Routing handled by HomeRouter — show here only when truly navigated to as Netflix */}
            <ScrollContainer>
                <Show when={heroVideos().length > 0}>
                    <HeroBanner
                        videos={heroVideos()}
                        onPlay={openVideo}
                        onDismissedVideo={handleDismissVideo}
                        onDismissedChannel={handleDismissChannel}
                        intervalMs={15000}
                        watchLaterUrls={() => new Set((watchLaterItems() ?? []).map(v => v.url ?? '').filter(Boolean))}
                    />
                </Show>

                <Show when={continueWatchingItems().length > 0}>
                    <HomeCarousel
                        title="Continue watching"
                        items={continueWatchingItems()}
                        builder={(_, item: IHistoryVideo) => (
                            <VideoThumbnailView
                                style={THUMB_STYLE}
                                video={{ ...item.video, metadata: { position: item.position } } as any}
                                onClick={() => openVideo(item.video)}
                                onSettings={(el, c) => openVideoMenu(el, c)}
                                settingsOnHover={true}
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
                                onSettings={(el, c) => openVideoMenu(el, c)}
                                settingsOnHover={true}
                            />
                        )}
                    />
                </Show>

                {/* Subscription group carousels — watched videos excluded */}
                <Show when={(groupCarousels()?.length ?? 0) > 0}>
                    <For each={groupCarousels()}>
                        {(group) => {
                            const items = () => group.videos.filter(v => !watchedUrls().has(v.url ?? ''));
                            return (
                                <Show when={items().length > 0}>
                                    <HomeCarousel
                                        title={group.name}
                                        items={items()}
                                        builder={(_, item: IPlatformVideo) => (
                                            <VideoThumbnailView
                                                style={THUMB_STYLE}
                                                video={item}
                                                onClick={() => openVideo(item)}
                                                onSettings={(el, c) => openVideoMenu(el, c)}
                                                settingsOnHover={true}
                                            />
                                        )}
                                    />
                                </Show>
                            );
                        }}
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
                                onSettings={(el, c) => openVideoMenu(el, c)}
                                settingsOnHover={true}
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

            <Portal>
                <SettingsMenu
                    menu={videoMenu$()}
                    show={videoMenuShow$()}
                    onHide={() => setVideoMenuShow(false)}
                    anchor={videoMenuAnchor$()}
                />
            </Portal>
        </div>
    );
};

export default HomePage;
