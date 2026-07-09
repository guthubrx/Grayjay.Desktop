import { createSignal, createResource, createEffect, createMemo, batch, type Component, Show, For, onMount, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';

import styles from './index.module.css';
import { HistoryBackend } from '../../backend/HistoryBackend';
import { WatchLaterBackend } from '../../backend/WatchLaterBackend';
import { SubscriptionsBackend } from '../../backend/SubscriptionsBackend';
import { HighlightsBackend } from '../../backend/HighlightsBackend';
import NavigationBar from '../../components/topbars/NavigationBar';
import ScrollContainer from '../../components/containers/ScrollContainer';
import StateGlobal from '../../state/StateGlobal';
import StateWebsocket from '../../state/StateWebsocket';
import ReloadButton from '../../components/buttons/ReloadButton';
import { useNavigate } from '@solidjs/router';
import { Duration } from 'luxon';
import EmptyContentView from '../../components/EmptyContentView';
import HomeCarousel from '../../components/containers/HomeCarousel';
import HeroBanner from '../../components/home/HeroBanner';
import VideoThumbnailView from '../../components/content/VideoThumbnailView';
import { IPlatformVideo } from '../../backend/models/content/IPlatformVideo';
import { RefreshPager } from '../../backend/models/pagers/RefreshPager';
import { IHistoryVideo } from '../../backend/models/content/IHistoryVideo';
import { IVideoHighlightSummary } from '../../backend/models/highlights/IVideoHighlightSummary';
import { IVideoHighlightSet } from '../../backend/models/highlights/IVideoHighlightSet';
import { IVideoHighlightSegment } from '../../backend/models/highlights/IVideoHighlightSegment';
import { useVideo, VideoState, type VideoQueueItemMeta } from '../../contexts/VideoProvider';
import SettingsMenu, { Menu, MenuItemButton } from '../../components/menus/Overlays/SettingsMenu';
import Anchor, { AnchorStyle } from '../../utility/Anchor';
import UIOverlay from '../../state/UIOverlay';
import { interestScoreFromSummary } from '../../utils/highlightInterest';

import { homeStyle$ } from '../../state/HomeStyleState';
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
const STORAGE_HOME_GROUP_CAROUSELS = 'grayjay_home_group_carousels_v1';
const STORAGE_SMART_CHAPTER_SUMMARIES = 'grayjay_home_smart_chapter_summaries_v1';
const STORAGE_SMART_TV_SESSIONS = 'grayjay_smart_tv_sessions_v1';
const STORAGE_SMART_TV_PLAYED_CHAPTERS = 'grayjay_smart_tv_played_chapters_v1';
const HOME_CACHE_SIZE = 20;
const GROUP_CAROUSEL_CACHE_SIZE = 20;
const SMART_CHAPTER_CACHE_SIZE = 1000;
const SMART_TV_START_PADDING_SECONDS = 2;

const SMART_TV_TARGET_SECONDS = [15, 30, 45, 60, 90, 120, 180, 240, 360].map(minutes => minutes * 60);
const SMART_TV_MAX_VIDEOS = [3, 5, 8, 12, 16, 24, 32, 50];
const SMART_TV_MAX_CHAPTERS = [5, 8, 12, 16, 24, 36, 50, 75, 100];
const SMART_TV_MAX_CHAPTERS_PER_VIDEO = [1, 2, 3, 4, 5, Number.POSITIVE_INFINITY];
const SMART_TV_MIN_SCORE = [0, 0.45, 0.55, 0.65, 0.75, 0.85, 0.92];
const SMART_TV_CANDIDATE_VIDEOS = [12, 24, 40, 60, 100];
const SMART_TV_REPEAT_VIDEO_PENALTY = [0, 0.04, 0.08, 0.14];
const SMART_TV_TILE_PREVIEW_THUMBNAILS = [0, 1, 2, 3, 4];
const SMART_TV_FALLBACK_PLUGIN_ID = 'smart-tv-fallback';

const DEFAULT_SMART_TV_SETTINGS = {
    targetSeconds: 60 * 60,
    maxVideos: 8,
    maxChapters: 12,
    maxChaptersPerVideo: 2,
    minimumScore: 0.55,
    candidateVideos: 24,
    repeatVideoPenalty: 0.04,
    tilePreviewThumbnails: 4,
};

interface SmartTvResolvedSettings {
    targetSeconds: number;
    maxVideos: number;
    maxChapters: number;
    maxChaptersPerVideo: number;
    minimumScore: number;
    candidateVideos: number;
    repeatVideoPenalty: number;
    tilePreviewThumbnails: number;
}

interface SmartTvSource {
    url: string;
    video?: IPlatformVideo;
    summary?: IVideoHighlightSummary;
}

interface SmartTvStats {
    videoCount: number;
    segmentCount: number;
    totalDuration: number;
}

interface SmartTvEntry {
    video: IPlatformVideo;
    start: number;
    end: number;
    title: string;
    summary?: string;
    globalSummary?: string;
    chapterKey: string;
    score: number;
}

interface SmartTvSessionEntry extends SmartTvEntry {
    videoUrl: string;
}

interface SmartTvSession {
    key: string;
    title: string;
    mode: 'fixed';
    createdAt: string;
    targetSeconds: number;
    maxVideos: number;
    maxChapters: number;
    maxChaptersPerVideo: number;
    minimumScore: number;
    candidateVideos: number;
    poolStats: SmartTvStats;
    entries: SmartTvSessionEntry[];
    playedChapterKeys: string[];
}

function loadArrayCache<T>(key: string): T[] {
    try {
        const value = JSON.parse(localStorage.getItem(key) ?? '[]');
        return Array.isArray(value) ? value : [];
    }
    catch { return []; }
}

function saveArrayCache<T>(key: string, items: T[], limit?: number) {
    try { localStorage.setItem(key, JSON.stringify(typeof limit === 'number' ? items.slice(0, limit) : items)); } catch {}
}

function loadHomeCache(): IPlatformVideo[] {
    return loadArrayCache<IPlatformVideo>(STORAGE_HOME_CACHE);
}

function loadSmartChapterSummaryCache(): IVideoHighlightSummary[] {
    return loadArrayCache<IVideoHighlightSummary>(STORAGE_SMART_CHAPTER_SUMMARIES);
}

function loadSmartTvSessions(): Record<string, SmartTvSession> {
    try { return JSON.parse(localStorage.getItem(STORAGE_SMART_TV_SESSIONS) ?? '{}'); }
    catch { return {}; }
}

function saveSmartTvSessions(sessions: Record<string, SmartTvSession>) {
    try { localStorage.setItem(STORAGE_SMART_TV_SESSIONS, JSON.stringify(sessions)); } catch {}
}

function loadPlayedSmartTvChapterKeys(): Set<string> {
    try { return new Set(JSON.parse(localStorage.getItem(STORAGE_SMART_TV_PLAYED_CHAPTERS) ?? '[]')); }
    catch { return new Set(); }
}

function savePlayedSmartTvChapterKeys(keys: Set<string>) {
    try { localStorage.setItem(STORAGE_SMART_TV_PLAYED_CHAPTERS, JSON.stringify([...keys].slice(-2000))); } catch {}
}

function indexedSetting<T>(values: T[], index: unknown, fallback: T): T {
    return typeof index === 'number' && Number.isFinite(index) ? (values[index] ?? fallback) : fallback;
}

function smartTvSettingsFromObject(settingsObject: any): SmartTvResolvedSettings {
    const smartTv = settingsObject?.xrayPanel?.smartTv;
    return {
        targetSeconds: indexedSetting(SMART_TV_TARGET_SECONDS, smartTv?.targetDuration, DEFAULT_SMART_TV_SETTINGS.targetSeconds),
        maxVideos: indexedSetting(SMART_TV_MAX_VIDEOS, smartTv?.maxVideos, DEFAULT_SMART_TV_SETTINGS.maxVideos),
        maxChapters: indexedSetting(SMART_TV_MAX_CHAPTERS, smartTv?.maxChapters, DEFAULT_SMART_TV_SETTINGS.maxChapters),
        maxChaptersPerVideo: indexedSetting(SMART_TV_MAX_CHAPTERS_PER_VIDEO, smartTv?.maxChaptersPerVideo, DEFAULT_SMART_TV_SETTINGS.maxChaptersPerVideo),
        minimumScore: indexedSetting(SMART_TV_MIN_SCORE, smartTv?.minimumScore, DEFAULT_SMART_TV_SETTINGS.minimumScore),
        candidateVideos: indexedSetting(SMART_TV_CANDIDATE_VIDEOS, smartTv?.candidateVideos, DEFAULT_SMART_TV_SETTINGS.candidateVideos),
        repeatVideoPenalty: indexedSetting(SMART_TV_REPEAT_VIDEO_PENALTY, smartTv?.repeatVideoPenalty, DEFAULT_SMART_TV_SETTINGS.repeatVideoPenalty),
        tilePreviewThumbnails: indexedSetting(SMART_TV_TILE_PREVIEW_THUMBNAILS, smartTv?.tilePreviewThumbnails, DEFAULT_SMART_TV_SETTINGS.tilePreviewThumbnails),
    };
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

function youtubeIdFromUrl(url?: string): string | undefined {
    if (!url) return undefined;
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, '');
        if (host === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0];
        if (!host.endsWith('youtube.com')) return undefined;
        if (parsed.pathname === '/watch') return parsed.searchParams.get('v') ?? undefined;
        const parts = parsed.pathname.split('/').filter(Boolean);
        if ((parts[0] === 'shorts' || parts[0] === 'embed') && parts[1]) return parts[1];
    } catch {}
    return undefined;
}

function normalizeUrlKey(url?: string): string | undefined {
    if (!url) return undefined;
    const id = youtubeIdFromUrl(url);
    if (id) return `youtube:${id}`;
    return url.trim().replace(/\/+$/, '');
}

function highlightKeys(...urls: (string | undefined)[]): string[] {
    const keys = new Set<string>();
    for (const url of urls) {
        const normalized = normalizeUrlKey(url);
        if (normalized) keys.add(normalized);
    }
    return [...keys];
}

function youtubeThumbnailUrl(url?: string): string | undefined {
    const id = youtubeIdFromUrl(url);
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : undefined;
}

function thumbnailFromVideo(video?: IPlatformVideo): string | undefined {
    return video?.thumbnails?.sources
        ?.slice()
        .sort((a, b) => (b.quality ?? 0) - (a.quality ?? 0))[0]
        ?.url;
}

function firstUsefulLine(value?: string): string | undefined {
    const line = value?.split(/\r?\n/).map(part => part.trim()).find(Boolean);
    if (!line) return undefined;
    return line.length > 110 ? `${line.slice(0, 107)}...` : line;
}

function isSmartTvFallbackVideo(video?: IPlatformVideo): boolean {
    return video?.id?.pluginID === SMART_TV_FALLBACK_PLUGIN_ID;
}

function smartTvFallbackVideo(url: string, set: IVideoHighlightSet, segment: IVideoHighlightSegment): IPlatformVideo {
    const youtubeId = youtubeIdFromUrl(url);
    const thumbnail = youtubeThumbnailUrl(url);
    const title = firstUsefulLine(set.globalSummary) ?? segment.title ?? youtubeId ?? url;
    return {
        contentType: 1,
        id: {
            platform: youtubeId ? 'YouTube' : 'Smart TV',
            value: youtubeId ?? url,
            pluginID: SMART_TV_FALLBACK_PLUGIN_ID,
            claimType: 0,
            claimFieldType: 0,
        },
        name: title,
        author: {
            id: {
                platform: '',
                value: '',
                pluginID: SMART_TV_FALLBACK_PLUGIN_ID,
                claimType: 0,
                claimFieldType: 0,
            },
            name: '',
            url: '',
            thumbnail: '',
            subscribers: 0,
        },
        dateTime: set.updatedAt,
        url,
        shareUrl: url,
        thumbnails: { sources: thumbnail ? [{ url: thumbnail, quality: 720 }] : [] },
        duration: Math.max(0, ...set.segments.map(s => s.end)),
        viewCount: 0,
        isLive: false,
    };
}

function smartTvSourceThumbnail(source: SmartTvSource): string | undefined {
    return thumbnailFromVideo(source.video ?? source.summary?.video)
        ?? youtubeThumbnailUrl(source.url)
        ?? youtubeThumbnailUrl(source.summary?.videoUrl);
}

function smartTvPreviewUrls(sources: SmartTvSource[], session: SmartTvSession | undefined, count: number): string[] {
    if (count <= 0) return [];
    const urls: string[] = [];
    const seen = new Set<string>();
    const add = (key: string | undefined, url: string | undefined) => {
        if (!key || !url || seen.has(key)) return;
        seen.add(key);
        urls.push(url);
    };

    for (const entry of remainingSessionEntries(session)) {
        add(
            normalizeUrlKey(entry.videoUrl || entry.video.url) ?? entry.videoUrl ?? entry.video.url,
            thumbnailFromVideo(entry.video) ?? youtubeThumbnailUrl(entry.videoUrl || entry.video.url)
        );
        if (urls.length >= count) return urls;
    }

    for (const source of sources) {
        add(
            highlightKeys(source.url, source.video?.url, source.summary?.videoUrl)[0],
            smartTvSourceThumbnail(source)
        );
        if (urls.length >= count) return urls;
    }

    return urls;
}

function sourceScore(source: SmartTvSource): number {
    return interestScoreFromSummary(source.summary, source.video);
}

function dedupeSmartTvSources(sources: SmartTvSource[]): SmartTvSource[] {
    const byKey = new Map<string, SmartTvSource>();
    for (const source of sources) {
        const key = highlightKeys(source.url, source.video?.url, source.summary?.videoUrl)[0];
        if (!key) continue;
        const existing = byKey.get(key);
        const sameVideoState = Boolean(existing?.video) === Boolean(source.video);
        if (!existing || (!existing.video && source.video) || (sameVideoState && sourceScore(source) > sourceScore(existing))) {
            byKey.set(key, source);
        }
    }
    return [...byKey.values()].sort((a, b) => sourceScore(b) - sourceScore(a));
}

function smartTvChapterKey(url: string, segment: IVideoHighlightSegment): string {
    const key = normalizeUrlKey(url) ?? url;
    return `${key}:${Math.round(segment.start)}-${Math.round(segment.end)}`;
}

function smartTvVideoKey(entry: Pick<SmartTvEntry, 'video'>): string {
    return normalizeUrlKey(entry.video.url) ?? entry.video.url ?? entry.video.name;
}

function smartTvStatsFromEntries(entries: SmartTvSessionEntry[]): SmartTvStats {
    return entries.reduce<SmartTvStats>((stats, entry) => ({
        videoCount: stats.videoCount + 1,
        segmentCount: stats.segmentCount + 1,
        totalDuration: stats.totalDuration + Math.max(0, entry.end - entry.start),
    }), { videoCount: 0, segmentCount: 0, totalDuration: 0 });
}

function remainingSessionEntries(session?: SmartTvSession): SmartTvSessionEntry[] {
    if (!session) return [];
    const played = new Set(session.playedChapterKeys);
    return session.entries.filter(entry => !played.has(entry.chapterKey));
}

function capSmartTvEntries(entries: SmartTvEntry[], settings: SmartTvResolvedSettings): SmartTvEntry[] {
    const selected: SmartTvEntry[] = [];
    const remaining = [...entries];
    const videoCounts = new Map<string, number>();
    const selectedVideos = new Set<string>();
    let totalSeconds = 0;

    while (remaining.length > 0 && selected.length < settings.maxChapters) {
        const candidates = remaining
            .map((entry, index) => {
                const videoKey = smartTvVideoKey(entry);
                const alreadySelectedFromVideo = videoCounts.get(videoKey) ?? 0;
                const wouldAddVideo = !selectedVideos.has(videoKey);
                const duration = Math.max(0, entry.end - entry.start);
                const overVideoLimit = wouldAddVideo && selectedVideos.size >= settings.maxVideos;
                const overChapterPerVideo = alreadySelectedFromVideo >= settings.maxChaptersPerVideo;
                const overDuration = selected.length > 0 && totalSeconds + duration > settings.targetSeconds;
                return {
                    entry,
                    index,
                    videoKey,
                    adjustedScore: entry.score - (alreadySelectedFromVideo * settings.repeatVideoPenalty),
                    rejected: overVideoLimit || overChapterPerVideo || overDuration,
                };
            })
            .filter(candidate => !candidate.rejected)
            .sort((a, b) => {
                const adjustedDelta = b.adjustedScore - a.adjustedScore;
                if (adjustedDelta !== 0) return adjustedDelta;
                return b.entry.score - a.entry.score;
            });

        const candidate = candidates[0];
        if (!candidate) break;
        const [entry] = remaining.splice(candidate.index, 1);
        const videoKey = smartTvVideoKey(entry);
        selected.push(entry);
        selectedVideos.add(videoKey);
        videoCounts.set(videoKey, (videoCounts.get(videoKey) ?? 0) + 1);
        const duration = Math.max(0, entry.end - entry.start);
        totalSeconds += duration;
    }

    return selected;
}

function formatSmartTvDuration(totalSeconds: number): string {
    if (totalSeconds < 60) return `${Math.max(1, Math.round(totalSeconds))} sec`;
    const minutes = Math.round(totalSeconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}

function smartTvArtworkClass(count: number): string {
    const countClass = count === 1
        ? styles.smartTvArtwork1
        : count === 2
            ? styles.smartTvArtwork2
            : count === 3
                ? styles.smartTvArtwork3
                : styles.smartTvArtwork4;
    return `${styles.smartTvArtwork} ${countClass}`;
}

const SmartTvTile: Component<{
    title: string;
    sources: SmartTvSource[];
    poolStats: SmartTvStats;
    settings: SmartTvResolvedSettings;
    session?: SmartTvSession;
    loading?: boolean;
    variant?: 'row' | 'global';
    onStart: () => void;
}> = (props) => {
    const remainingStats = () => smartTvStatsFromEntries(remainingSessionEntries(props.session));
    const hasRemainingSession = () => remainingStats().segmentCount > 0;
    const disabled = () => props.loading || props.poolStats.videoCount === 0;
    const sessionLabel = () => hasRemainingSession()
        ? `${remainingStats().segmentCount} chapters · ${remainingStats().videoCount} videos · ${formatSmartTvDuration(remainingStats().totalDuration)} saved`
        : `up to ${props.settings.maxChapters} chapters · ${props.settings.maxVideos} videos · ${formatSmartTvDuration(props.settings.targetSeconds)} target`;
    const previewUrls = () => smartTvPreviewUrls(props.sources, props.session, props.settings.tilePreviewThumbnails);
    return (
        <button
            type="button"
            class={`${styles.smartTvTile} ${props.variant === 'global' ? styles.smartTvTileGlobal : ''}`}
            disabled={disabled()}
            onClick={() => { if (!disabled()) props.onStart(); }}
            aria-label={`Recalculate and play Smart TV: ${props.title}`}
        >
            <Show when={previewUrls().length > 0}>
                <span class={smartTvArtworkClass(previewUrls().length)}>
                    <For each={previewUrls()}>
                        {(url) => (
                            <img
                                class={styles.smartTvArtworkImage}
                                src={url}
                                alt=""
                                referrerPolicy="no-referrer"
                            />
                        )}
                    </For>
                </span>
            </Show>
            <span class={styles.smartTvCopy}>
                <span class={styles.smartTvKicker}>Smart TV</span>
                <span class={styles.smartTvTitle}>{props.title}</span>
                <span class={styles.smartTvMeta}>
                    {props.loading
                        ? 'Preparing...'
                        : `Session: ${sessionLabel()}`}
                </span>
                <span class={styles.smartTvPool}>
                    Pool: {props.poolStats.segmentCount} chapters · {props.poolStats.videoCount} videos · {formatSmartTvDuration(props.poolStats.totalDuration)}
                </span>
            </span>
        </button>
    );
};

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

function loadGroupCarouselsCache(): GroupCarousel[] {
    return loadArrayCache<GroupCarousel>(STORAGE_HOME_GROUP_CAROUSELS)
        .filter(g => g.name && Array.isArray(g.videos) && g.videos.length > 0)
        .slice(0, GROUP_CAROUSEL_CACHE_SIZE);
}

function saveGroupCarouselsCache(groups: GroupCarousel[]) {
    const normalized = groups
        .filter(g => g.name && g.videos.length > 0)
        .slice(0, GROUP_CAROUSEL_CACHE_SIZE)
        .map(g => ({ ...g, videos: g.videos.slice(0, MAX_CAROUSEL_ITEMS) }));
    saveArrayCache(STORAGE_HOME_GROUP_CAROUSELS, normalized);
}

const HomePage: Component = () => {
    const homePager = StateGlobal.home$;
    const video = useVideo();
    const nav = useNavigate();

    const lastHomeMillis = Math.abs(StateGlobal.lastHomeTime$()?.diffNow().toMillis() ?? 0);
    if (lastHomeMillis > 2 * 60 * 1000) {
        StateGlobal.reloadHome();
    }

    // Barre de progression du rafraîchissement des abonnements (même source et même condition que la page Subscriptions)
    const [subProgress$, setSubProgress] = createSignal<number>(0);
    StateWebsocket.registerHandlerNew("subProgress", (packet) => {
        setSubProgress(packet.payload.progress / packet.payload.total);
    }, "homebar");

    // Reactive dismiss sets used by heroVideos().
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

    // Hero cache starts from localStorage and updates when the live pager has data.
    const [homeCached, setHomeCached] = createSignal<IPlatformVideo[]>(loadHomeCache());
    createEffect(() => {
        const pager = homePager();
        if (!pager) return;
        // En mode cache (RefreshPager) on s'abonne au signal de fin de refresh ; en mode update (Pager simple) il est absent
        void (pager as RefreshPager<IPlatformVideo>).hadInitialUpdate$?.();
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

    const [watchedHistoryUrls] = createResource(async () => {
        try {
            return new Set(await HistoryBackend.getWatchedUrls(MIN_WATCH_POSITION));
        } catch {
            return new Set<string>();
        }
    });

    const [watchLaterItems] = createResource(async () => {
        try {
            return await WatchLaterBackend.getAll();
        } catch {
            return [] as IPlatformVideo[];
        }
    });

    const [smartChapterItems] = createResource(async () => {
        try {
            const items = (await HighlightsBackend.getAll())
                .filter((h: IVideoHighlightSummary) => h.segmentCount > 0);
            if (items.length > 0)
                saveArrayCache(STORAGE_SMART_CHAPTER_SUMMARIES, items, SMART_CHAPTER_CACHE_SIZE);
            return items;
        } catch {
            return loadSmartChapterSummaryCache();
        }
    }, { initialValue: loadSmartChapterSummaryCache() });

    const [smartTvLoadingKey$, setSmartTvLoadingKey] = createSignal<string | undefined>();
    const [smartTvSessions$, setSmartTvSessions] = createSignal<Record<string, SmartTvSession>>(loadSmartTvSessions());
    const [playedSmartTvChapterKeys$, setPlayedSmartTvChapterKeys] = createSignal<Set<string>>(loadPlayedSmartTvChapterKeys());
    const [activeSmartTvSessionKey$, setActiveSmartTvSessionKey] = createSignal<string | undefined>();
    const smartTvSettings = createMemo(() => smartTvSettingsFromObject(StateGlobal.settings$()?.object));

    const smartChapterSummaryByKey = createMemo(() => {
        const summaries = new Map<string, IVideoHighlightSummary>();
        for (const item of smartChapterItems() ?? []) {
            for (const key of highlightKeys(item.videoUrl, item.video?.url)) {
                const existing = summaries.get(key);
                if (!existing || interestScoreFromSummary(item, item.video) > interestScoreFromSummary(existing, existing.video)) {
                    summaries.set(key, item);
                }
            }
        }
        return summaries;
    });

    const summaryForUrl = (url?: string): IVideoHighlightSummary | undefined => {
        const map = smartChapterSummaryByKey();
        for (const key of highlightKeys(url)) {
            const summary = map.get(key);
            if (summary) return summary;
        }
        return undefined;
    };

    const smartTvSourcesFromVideos = (videos: (IPlatformVideo | undefined)[]): SmartTvSource[] => {
        const sources: SmartTvSource[] = [];
        for (const videoItem of videos) {
            const summary = summaryForUrl(videoItem?.url);
            if (!summary) continue;
            sources.push({ url: summary.videoUrl, video: videoItem, summary });
        }
        return dedupeSmartTvSources(sources);
    };

    const smartTvSourcesFromSummaries = (summaries: IVideoHighlightSummary[]): SmartTvSource[] =>
        dedupeSmartTvSources(summaries.map(item => ({
            url: item.videoUrl,
            video: item.video,
            summary: item,
        })));

    const smartTvStats = (sources: SmartTvSource[]): SmartTvStats => {
        const deduped = dedupeSmartTvSources(sources);
        return deduped.reduce<SmartTvStats>((stats, source) => ({
            videoCount: stats.videoCount + 1,
            segmentCount: stats.segmentCount + (source.summary?.segmentCount ?? 0),
            totalDuration: stats.totalDuration + (source.summary?.interestingDuration ?? source.summary?.totalDuration ?? 0),
        }), { videoCount: 0, segmentCount: 0, totalDuration: 0 });
    };

    const smartTvSessionForKey = (key: string): SmartTvSession | undefined => smartTvSessions$()[key];

    function persistSmartTvSession(session: SmartTvSession) {
        setSmartTvSessions(prev => {
            const next = { ...prev, [session.key]: session };
            saveSmartTvSessions(next);
            return next;
        });
    }

    function markSmartTvChapterPlayed(sessionKey: string, chapterKey: string) {
        setPlayedSmartTvChapterKeys(prev => {
            if (prev.has(chapterKey)) return prev;
            const next = new Set(prev);
            next.add(chapterKey);
            savePlayedSmartTvChapterKeys(next);
            return next;
        });

        const session = smartTvSessions$()[sessionKey];
        if (!session || session.playedChapterKeys.includes(chapterKey)) return;
        persistSmartTvSession({
            ...session,
            playedChapterKeys: [...session.playedChapterKeys, chapterKey],
        });
    }

    async function loadSmartTvEntries(sources: SmartTvSource[], playedKeys: Set<string>, settings: SmartTvResolvedSettings): Promise<SmartTvEntry[]> {
        const deduped = dedupeSmartTvSources(sources).slice(0, settings.candidateVideos);
        const entries = await Promise.all(deduped.map(async (source) => {
            try {
                const set = await HighlightsBackend.get(source.url);
                if (!set) return undefined;
                const fallbackScore = sourceScore(source);
                const segments = [...(set.segments ?? [])]
                    .filter(segment => {
                        const score = segment.score ?? fallbackScore;
                        return segment.end > segment.start
                            && score >= settings.minimumScore
                            && !playedKeys.has(smartTvChapterKey(set.videoUrl, segment));
                    });
                if (segments.length === 0) return undefined;

                return segments.map(segment => ({
                    video: source.video ?? set.video ?? smartTvFallbackVideo(set.videoUrl || source.url, set, segment),
                    start: Math.max(0, Math.floor(segment.start - SMART_TV_START_PADDING_SECONDS)),
                    end: segment.end,
                    title: segment.title,
                    summary: segment.summary,
                    globalSummary: set.globalSummary,
                    chapterKey: smartTvChapterKey(set.videoUrl, segment),
                    score: segment.score ?? fallbackScore,
                }));
            } catch (e) {
                console.warn('Failed to load Smart TV item', source.url, e);
                return undefined;
            }
        }));
        return entries
            .flatMap(entry => entry ?? [])
            .sort((a, b) => b.score - a.score)
            .slice(0, settings.maxChapters * Math.max(2, settings.maxChaptersPerVideo === Number.POSITIVE_INFINITY ? 4 : settings.maxChaptersPerVideo));
    }

    async function createSmartTvSession(key: string, title: string, sources: SmartTvSource[]): Promise<SmartTvSession | undefined> {
        if (smartTvLoadingKey$()) return;
        const deduped = dedupeSmartTvSources(sources);
        if (deduped.length === 0) return;
        const settings = smartTvSettings();
        setSmartTvLoadingKey(key);
        try {
            const entries = capSmartTvEntries(
                await loadSmartTvEntries(deduped, playedSmartTvChapterKeys$(), settings),
                settings
            );
            if (entries.length === 0) return;
            const session: SmartTvSession = {
                key,
                title,
                mode: 'fixed',
                createdAt: new Date().toISOString(),
                targetSeconds: settings.targetSeconds,
                maxVideos: settings.maxVideos,
                maxChapters: settings.maxChapters,
                maxChaptersPerVideo: settings.maxChaptersPerVideo,
                minimumScore: settings.minimumScore,
                candidateVideos: settings.candidateVideos,
                poolStats: smartTvStats(deduped),
                entries: entries.map(entry => ({
                    ...entry,
                    videoUrl: entry.video.url ?? '',
                })),
                playedChapterKeys: [],
            };
            persistSmartTvSession(session);
            return session;
        } finally {
            setSmartTvLoadingKey(undefined);
        }
    }

    function playSmartTvSession(key: string, session: SmartTvSession) {
        const entries = remainingSessionEntries(session);
        if (entries.length === 0) return;
        const metadata: VideoQueueItemMeta[] = entries.map(entry => ({
            source: 'smart-tv',
            sessionTitle: session.title,
            title: entry.title,
            summary: entry.summary,
            globalSummary: entry.globalSummary,
            channelName: isSmartTvFallbackVideo(entry.video) ? undefined : entry.video.author?.name,
            channelThumbnail: isSmartTvFallbackVideo(entry.video) ? undefined : entry.video.author?.thumbnail,
            startSeconds: entry.start,
            endSeconds: entry.end,
        }));
        setActiveSmartTvSessionKey(key);
        video?.actions.setQueue(
            0,
            entries.map(entry => entry.video),
            false,
            false,
            VideoState.Maximized,
            Duration.fromMillis(entries[0].start * 1000),
            entries.map(entry => Duration.fromMillis(entry.start * 1000)),
            metadata
        );
        queueMicrotask(() => video?.actions.setState(VideoState.Maximized));
    }

    async function playSmartTv(key: string, title: string, sources: SmartTvSource[], forceRecalculate = false) {
        if (smartTvLoadingKey$()) return;
        let session = !forceRecalculate ? smartTvSessionForKey(key) : undefined;
        if (!session || remainingSessionEntries(session).length === 0) {
            session = await createSmartTvSession(key, title, sources);
        }
        if (!session) return;
        playSmartTvSession(key, session);
    }

    createEffect(() => {
        const key = activeSmartTvSessionKey$();
        const currentUrl = video?.video()?.url;
        if (!key || !currentUrl) return;
        const session = smartTvSessions$()[key];
        if (!session) return;
        const currentEntry = remainingSessionEntries(session).find(entry =>
            highlightKeys(entry.videoUrl, entry.video?.url).some(k => highlightKeys(currentUrl).includes(k))
        );
        if (!currentEntry) return;
        markSmartTvChapterPlayed(key, currentEntry.chapterKey);
    });

    // Subscription group carousels — cache first, group feeds as fallback:
    // Phase 1 (fast): show cached data immediately when available
    // Phase 2 (background): load each group feed and update rows as results arrive
    const [groupCarousels, setGroupCarousels] = createSignal<GroupCarousel[]>(loadGroupCarouselsCache());
    let groupsAborted = false;
    onCleanup(() => { groupsAborted = true; });

    const replaceGroupCarousels = (groups: GroupCarousel[]) => {
        if (groups.length === 0) return;
        saveGroupCarouselsCache(groups);
        setGroupCarousels(groups);
    };

    const upsertGroupCarousel = (name: string, videos: IPlatformVideo[]) => {
        const freshVideos = videos
            .sort((a, b) => new Date(b.dateTime ?? 0).getTime() - new Date(a.dateTime ?? 0).getTime())
            .slice(0, MAX_CAROUSEL_ITEMS);
        if (freshVideos.length === 0) return;
        setGroupCarousels(prev => {
            const idx = prev.findIndex(g => g.name === name);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...next[idx], videos: freshVideos };
                saveGroupCarouselsCache(next);
                return next;
            }
            const next = [...prev, { name, videos: freshVideos }];
            saveGroupCarouselsCache(next);
            return next;
        });
    };

    onMount(async () => {
        let cachedVideos: IPlatformVideo[] = [];
        try {
            // Phase 0: disk cache only. If it fails, group rows must still load.
            const cached = await SubscriptionsBackend.subscriptionsCacheLoad();
            if (groupsAborted) return;
            cachedVideos = cached.results as IPlatformVideo[];
            if (cachedVideos.length > 0)
                replaceGroupCarousels(buildGroupCarousels([], cachedVideos));
        } catch (e) {
            console.warn('Subscription cache failed, continuing with group feeds', e);
        }

        let subGroups: ISubscriptionGroup[] = [];
        try {
            // Phase 1: groups are independent from the global cache.
            subGroups = await SubscriptionsBackend.subscriptionGroups();
            if (groupsAborted) return;
            if (cachedVideos.length > 0)
                replaceGroupCarousels(buildGroupCarousels(subGroups, cachedVideos));
        } catch (e) {
            console.warn('Subscription groups failed, falling back to global subscriptions', e);
        }

        // Phase 2: load group feeds without forcing a network refresh so rows appear quickly.
        // The regular page refresh action can still request a complete network update.
        if (subGroups.length > 0) {
            for (const group of subGroups) {
                SubscriptionsBackend.subscriptionGroupCacheLoad(group.id)
                    .then(cached => {
                        if (groupsAborted) return;
                        upsertGroupCarousel(group.name, cached.results as IPlatformVideo[]);
                    })
                    .catch(() => {});

                SubscriptionsBackend.subscriptionGroupLoad(group.id, false)
                    .then(fresh => {
                        if (groupsAborted) return;
                        upsertGroupCarousel(group.name, fresh.results as IPlatformVideo[]);
                    })
                    .catch(() => {});
            }
            return;
        }

        SubscriptionsBackend.subscriptionsLoad(false)
            .then(fresh => {
                if (groupsAborted) return;
                replaceGroupCarousels(buildGroupCarousels(subGroups, fresh.results as IPlatformVideo[]));
            })
            .catch(() => {});
    });

    function openVideo(v: IPlatformVideo) {
        video?.actions.openVideo(v, undefined, VideoState.Maximized);
        queueMicrotask(() => video?.actions.setState(VideoState.Maximized));
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

    const recentInProgressUrls = createMemo(() => new Set(
        (historyItems() ?? []).map(h => h.video?.url).filter(Boolean) as string[]
    ));

    const watchedUrlKeys = createMemo(() => {
        const keys = new Set<string>();
        const addUrl = (url?: string) => {
            for (const key of highlightKeys(url)) keys.add(key);
        };

        for (const url of watchedHistoryUrls() ?? []) addUrl(url);
        for (const url of recentInProgressUrls()) addUrl(url);
        return keys;
    });

    const hasWatchedUrl = (url?: string) => {
        if (!url) return false;
        const watched = watchedUrlKeys();
        return highlightKeys(url).some(key => watched.has(key));
    };

    // Hero videos — 1:1 interleave of recent subs + platform recos, thumbnail required
    const heroVideos = createMemo(() => {
        const dVideos = dismissedVideos$();
        const dChannels = dismissedChannels$();
        const exclude = (v: IPlatformVideo) =>
            dVideos.has(v.url ?? '') || dChannels.has(v.author?.url ?? '') ||
            hasWatchedUrl(v.url) || !(v.thumbnails?.sources?.some(s => s?.url));

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
    });

    // Continue watching — excludes dismissed videos/channels
    const continueWatchingItems = createMemo(() => {
        const dV = dismissedVideos$();
        const dC = dismissedChannels$();
        return (historyItems() ?? []).filter(h =>
            !dV.has(h.video?.url ?? '') && !dC.has(h.video?.author?.url ?? '')
        );
    });

    // Recommended = home pager items after the hero, with valid metadata only, excluding watched
    const recommendedItems = createMemo(() => {
        const live = (homePager()?.data ?? []) as IPlatformVideo[];
        const source = live.length > 0 ? live : homeCached();
        return source
            .slice(HERO_COUNT)
            .filter(v => v.name && v.name.trim() && (v as IPlatformVideo).duration > 0 && !hasWatchedUrl((v as IPlatformVideo).url)) as IPlatformVideo[];
    });

    const continueWatchingSmartTvSources = createMemo(() =>
        smartTvSourcesFromVideos(continueWatchingItems().map(item => item.video))
    );
    const continueWatchingSmartTvStats = createMemo(() => smartTvStats(continueWatchingSmartTvSources()));

    const watchLaterSmartTvSources = createMemo(() =>
        smartTvSourcesFromVideos(watchLaterItems() ?? [])
    );
    const watchLaterSmartTvStats = createMemo(() => smartTvStats(watchLaterSmartTvSources()));

    const smartChapterSmartTvSources = createMemo(() =>
        smartTvSourcesFromSummaries(smartChapterItems() ?? [])
            .slice(0, smartTvSettings().candidateVideos));

    const recommendedSmartTvSources = createMemo(() =>
        smartTvSourcesFromVideos(recommendedItems())
    );
    const recommendedSmartTvStats = createMemo(() => smartTvStats(recommendedSmartTvSources()));

    const smartTvCandidateSources = createMemo(() => {
        return dedupeSmartTvSources([
            ...smartTvSourcesFromVideos(heroVideos()),
            ...continueWatchingSmartTvSources(),
            ...watchLaterSmartTvSources(),
            ...groupCarousels().flatMap(group =>
                smartTvSourcesFromVideos(group.videos.filter(item => !hasWatchedUrl(item.url)))
            ),
            ...recommendedSmartTvSources(),
            ...smartChapterSmartTvSources(),
        ]);
    });

    const watchNowSources = createMemo(() =>
        dedupeSmartTvSources(smartTvCandidateSources()
            .filter(source => source.video && !hasWatchedUrl(source.video.url)))
            .slice(0, MAX_CAROUSEL_ITEMS));
    const watchNowStats = createMemo(() => smartTvStats(watchNowSources()));

    const watchNowItems = createMemo(() =>
        watchNowSources()
            .map(source => source.video)
            .filter((item): item is IPlatformVideo => item !== undefined));

    const globalSmartTvSources = createMemo(() =>
        dedupeSmartTvSources([
            ...watchNowSources(),
            ...smartChapterSmartTvSources(),
        ]).slice(0, smartTvSettings().candidateVideos));
    const globalSmartTvStats = createMemo(() => smartTvStats(globalSmartTvSources()));

    return (
        <div class={styles.container}>
            <NavigationBar isRoot={true} childrenAfter={
                <ReloadButton
                    onReloadUpdate={() => StateGlobal.reloadHome(true)}
                    onReloadCache={() => StateGlobal.reloadHome(false)}
                    updateDescription="Updates the highlights"
                    style={{ 'margin-left': '24px' }}
                    focusableOpts={{
                        groupId: 'nav-bar',
                        groupIndices: [1],
                        groupType: 'horizontal',
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
                        highlightSummaryForVideo={(video) => summaryForUrl(video?.url)}
                    />
                    <Show when={subProgress$() > 0 && subProgress$() < 1}>
                        <div style={{height: "2px", width: (subProgress$() * 100) + "%", background: "linear-gradient(267deg, rgb(1, 214, 230) -100.57%, rgb(1, 130, 231) 90.96%)"}}>
                        </div>
                    </Show>
                </Show>

                <Show when={globalSmartTvSources().length > 0}>
                    <div class={styles.globalSmartTvBand}>
                        <SmartTvTile
                            title="Global mix"
                            variant="global"
                            sources={globalSmartTvSources()}
                            poolStats={globalSmartTvStats()}
                            settings={smartTvSettings()}
                            session={smartTvSessionForKey('global')}
                            loading={smartTvLoadingKey$() === 'global'}
                            onStart={() => void playSmartTv('global', 'Global mix', globalSmartTvSources(), true)}
                        />
                    </div>
                </Show>

                <Show when={watchNowItems().length > 0}>
                    <HomeCarousel
                        title="Watch now"
                        items={watchNowItems()}
                        leadingItem={watchNowSources().length > 0 ? (
                            <SmartTvTile
                                title="Watch now"
                                sources={watchNowSources()}
                                poolStats={watchNowStats()}
                                settings={smartTvSettings()}
                                session={smartTvSessionForKey('watch-now')}
                                loading={smartTvLoadingKey$() === 'watch-now'}
                                onStart={() => void playSmartTv('watch-now', 'Watch now', watchNowSources(), true)}
                            />
                        ) : undefined}
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

                <Show when={continueWatchingItems().length > 0}>
                    <HomeCarousel
                        title="Continue watching"
                        items={continueWatchingItems()}
                        leadingItem={continueWatchingSmartTvSources().length > 0 ? (
                            <SmartTvTile
                                title="Continue watching"
                                sources={continueWatchingSmartTvSources()}
                                poolStats={continueWatchingSmartTvStats()}
                                settings={smartTvSettings()}
                                session={smartTvSessionForKey('continue-watching')}
                                loading={smartTvLoadingKey$() === 'continue-watching'}
                                onStart={() => void playSmartTv('continue-watching', 'Continue watching', continueWatchingSmartTvSources(), true)}
                            />
                        ) : undefined}
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
                        leadingItem={watchLaterSmartTvSources().length > 0 ? (
                            <SmartTvTile
                                title="Watch later"
                                sources={watchLaterSmartTvSources()}
                                poolStats={watchLaterSmartTvStats()}
                                settings={smartTvSettings()}
                                session={smartTvSessionForKey('watch-later')}
                                loading={smartTvLoadingKey$() === 'watch-later'}
                                onStart={() => void playSmartTv('watch-later', 'Watch later', watchLaterSmartTvSources(), true)}
                            />
                        ) : undefined}
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
                            const items = createMemo(() => group.videos.filter(v => !hasWatchedUrl(v.url)));
                            const smartTvSources = createMemo(() => smartTvSourcesFromVideos(items()));
                            const smartTvSourceStats = createMemo(() => smartTvStats(smartTvSources()));
                            const smartTvKey = () => `group:${group.name}`;
                            return (
                                <Show when={items().length > 0}>
                                    <HomeCarousel
                                        title={group.name}
                                        items={items()}
                                        leadingItem={smartTvSources().length > 0 ? (
                                            <SmartTvTile
                                                title={group.name}
                                                sources={smartTvSources()}
                                                poolStats={smartTvSourceStats()}
                                                settings={smartTvSettings()}
                                                session={smartTvSessionForKey(smartTvKey())}
                                                loading={smartTvLoadingKey$() === smartTvKey()}
                                                onStart={() => void playSmartTv(smartTvKey(), group.name, smartTvSources(), true)}
                                            />
                                        ) : undefined}
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
                        leadingItem={recommendedSmartTvSources().length > 0 ? (
                            <SmartTvTile
                                title="Recommended"
                                sources={recommendedSmartTvSources()}
                                poolStats={recommendedSmartTvStats()}
                                settings={smartTvSettings()}
                                session={smartTvSessionForKey('recommended')}
                                loading={smartTvLoadingKey$() === 'recommended'}
                                onStart={() => void playSmartTv('recommended', 'Recommended', recommendedSmartTvSources(), true)}
                            />
                        ) : undefined}
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
