import { Component, createEffect, createSignal, For, onCleanup, Show } from 'solid-js';
import { Portal } from 'solid-js/web';

import { DetailsBackend } from '../../../backend/DetailsBackend';
import { SubscriptionsBackend } from '../../../backend/SubscriptionsBackend';
import { IPlatformVideo } from '../../../backend/models/content/IPlatformVideo';
import { IVideoHighlightSummary } from '../../../backend/models/highlights/IVideoHighlightSummary';
import { WatchLaterBackend } from '../../../backend/WatchLaterBackend';
import VideoThumbnailView from '../../content/VideoThumbnailView';
import { interestDetailText, interestFromSummary, starsText } from '../../../utils/highlightInterest';
import styles from './index.module.css';

import iconWatchLater from '../../../assets/icons/icon24_watch_later.svg';
import iconClose from '../../../assets/icons/icon24_close.svg';

interface HeroBannerProps {
    videos: IPlatformVideo[];
    onPlay: (video: IPlatformVideo) => void;
    onDismissedVideo?: (url: string) => void;
    onDismissedChannel?: (url: string) => void;
    intervalMs?: number;
    watchLaterUrls?: () => Set<string>;
    highlightSummaryForVideo?: (video?: IPlatformVideo) => IVideoHighlightSummary | undefined;
}

function getBestThumbnail(v: IPlatformVideo): string | undefined {
    return v.thumbnails?.sources?.slice().sort((a, b) => (b.quality ?? 0) - (a.quality ?? 0))[0]?.url?.replace('u0026', '&');
}

function formatDuration(seconds: number): string {
    if (!seconds) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${m}:${String(s).padStart(2, '0')}`;
}

function formatViews(n: number): string {
    if (!n) return '';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K views`;
    return `${n} views`;
}

const FADE_MS = 400;

const HeroBanner: Component<HeroBannerProps> = (props) => {
    const [currentIndex, setCurrentIndex] = createSignal(0);  // dot / navigation target
    const [displayIndex, setDisplayIndex] = createSignal(0);  // content actually rendered
    const [fading, setFading] = createSignal(false);
    const [showInfo, setShowInfo] = createSignal(false);
    const [addedToWatchLater, setAddedToWatchLater] = createSignal(false);
    const [overlayAddedToWatchLater, setOverlayAddedToWatchLater] = createSignal(false);
    const [dismissState, setDismissState] = createSignal<'none' | 'video' | 'channel'>('none');
    const [overlayDescription, setOverlayDescription] = createSignal<string | null>(null);
    const [overlayDescExpanded, setOverlayDescExpanded] = createSignal(false);
    const [overlayChannelVideos, setOverlayChannelVideos] = createSignal<IPlatformVideo[]>([]);
    const [overlayLoading, setOverlayLoading] = createSignal(false);

    const intervalMs = () => props.intervalMs ?? 15000;

    let timerId: ReturnType<typeof setInterval> | undefined;
    let fadeTimerId: ReturnType<typeof setTimeout> | undefined;

    function transitionTo(index: number) {
        if (index === currentIndex() && index === displayIndex()) return;
        clearTimeout(fadeTimerId);
        setCurrentIndex(index);
        setFading(true);
        fadeTimerId = setTimeout(() => {
            setDisplayIndex(index);
            setFading(false);
        }, FADE_MS);
    }

    function startTimer() {
        clearInterval(timerId);
        timerId = setInterval(() => {
            transitionTo((currentIndex() + 1) % props.videos.length);
        }, intervalMs());
    }

    createEffect(() => {
        void props.videos.length;
        void intervalMs();
        if (!showInfo()) startTimer();
        else clearInterval(timerId);
    });

    onCleanup(() => { clearInterval(timerId); clearTimeout(fadeTimerId); });

    createEffect(() => {
        if (props.videos.length <= 1) return;
        const next = (currentIndex() + 1) % props.videos.length;
        const url = getBestThumbnail(props.videos[next]);
        if (url) { const img = new Image(); img.src = url; }
    });

    const currentVideo = () => props.videos[displayIndex()];
    const currentHighlightSummary = () => props.highlightSummaryForVideo?.(currentVideo());
    const currentGlobalSummary = () => currentHighlightSummary()?.globalSummary?.trim();
    const currentInterest = () => interestFromSummary(currentHighlightSummary(), currentVideo());
    const thumbnailUrl = () => getBestThumbnail(currentVideo()) ?? '';
    const multiSlide = () => props.videos.length > 1;

    createEffect(() => {
        const url = currentVideo()?.url ?? '';
        const inWL = props.watchLaterUrls?.().has(url) ?? false;
        setAddedToWatchLater(inWL);
        setOverlayAddedToWatchLater(inWL);
    });

    function goTo(index: number) {
        transitionTo(index);
        setDismissState('none');
        startTimer();
    }
    function goPrev() { goTo((currentIndex() - 1 + props.videos.length) % props.videos.length); }
    function goNext() { goTo((currentIndex() + 1) % props.videos.length); }

    function handleWatchLater(active: () => boolean, setActive: (v: boolean) => void) {
        const v = currentVideo();
        if (!v) return;
        if (active()) {
            WatchLaterBackend.remove(v.url ?? '').catch(() => {});
            setActive(false);
        } else {
            WatchLaterBackend.add(v).catch(() => {});
            setActive(true);
        }
    }

    function openInfoOverlay() {
        setShowInfo(true);
        setOverlayDescription(null);
        setOverlayDescExpanded(false);
        setOverlayChannelVideos([]);
        const v = currentVideo();
        if (!v?.url) return;
        setOverlayLoading(true);

        const channelUrl = v.author?.url ?? '';

        // Phase 1: subscription cache (disk, fast) filtered by this channel
        SubscriptionsBackend.subscriptionsCacheLoad()
            .then(res => {
                const fromCache = (res.results as IPlatformVideo[])
                    .filter(cv => cv.author?.url === channelUrl && cv.url !== v.url)
                    .slice(0, 5);
                if (fromCache.length > 0) setOverlayChannelVideos(fromCache);
            })
            .catch(() => {});

        // Phase 2: fresh platform fetch (slow), updates display when ready
        if (channelUrl) {
            SubscriptionsBackend.subscriptionsFilterChannelLoad(channelUrl)
                .then(res => {
                    const fresh = (res.results as IPlatformVideo[])
                        .filter(cv => cv.url !== v.url)
                        .slice(0, 5);
                    if (fresh.length > 0) setOverlayChannelVideos(fresh);
                })
                .catch(() => {});
        }

        // Description only — no history side-effect (dedicated endpoint)
        DetailsBackend.videoDescription(v.url)
            .then(desc => { if (desc) setOverlayDescription(desc); })
            .catch(() => {})
            .finally(() => setOverlayLoading(false));
    }

    function handleDismissVideo() {
        const v = currentVideo();
        if (!v?.url) return;
        props.onDismissedVideo?.(v.url);
        setDismissState('video');
        goNext();
    }

    function handleDismissChannel() {
        const v = currentVideo();
        if (!v?.author?.url) return;
        props.onDismissedChannel?.(v.author.url);
        setDismissState('channel');
        setTimeout(() => setDismissState('none'), 1000);
    }

    return (
        <>
        <div class={styles.banner}>
            <div
                class={styles.blurredBg}
                style={{ 'background-image': thumbnailUrl() ? `url(${thumbnailUrl()})` : 'none' }}
            />
            <div class={styles.gradientTop} />
            <div class={styles.gradient} />

            <div class={`${styles.inner} ${fading() ? styles.innerFading : ''}`}>
                <Show when={thumbnailUrl()}>
                    <img class={styles.thumbnail} src={thumbnailUrl()} alt={currentVideo()?.name ?? ''} />
                </Show>
                <div class={styles.meta}>
                    <p class={styles.title}>{currentVideo()?.name}</p>
                    <Show when={currentGlobalSummary()}>
                        {(summary) => <p class={styles.smartSummary}>{summary()}</p>}
                    </Show>
                    <Show when={currentInterest()}>
                        {(interest) => (
                            <div class={styles.heroInterest}>
                                <span class={styles.heroInterestStars}>{starsText(interest().stars)}</span>
                                <span class={styles.heroInterestLabel}>{interest().label}</span>
                                <Show when={interestDetailText(interest())}>
                                    {(detail) => <span class={styles.heroInterestDetail}>{detail()}</span>}
                                </Show>
                            </div>
                        )}
                    </Show>
                    <div class={styles.channelRow}>
                        <Show when={currentVideo()?.author?.thumbnail}>
                            <img class={styles.channelAvatar} src={currentVideo()!.author!.thumbnail} alt="" />
                        </Show>
                        <span class={styles.channel}>{currentVideo()?.author?.name}</span>
                    </div>

                    <div class={styles.actions}>
                        <button
                            class={styles.playButton}
                            onClick={() => { const v = currentVideo(); if (v) props.onPlay(v); }}
                        >
                            &#9654; Play
                        </button>
                        <button
                            class={`${styles.iconButton} ${addedToWatchLater() ? styles.iconButtonActive : ''}`}
                            onClick={() => handleWatchLater(addedToWatchLater, setAddedToWatchLater)}
                            title={addedToWatchLater() ? 'Remove from Watch later' : 'Watch later'}
                        >
                            <img src={iconWatchLater} alt="Watch later" />
                        </button>
                        <button
                            class={styles.infoButton}
                            onClick={openInfoOverlay}
                            title="More info"
                        >
                            i
                        </button>
                        <button
                            class={styles.dismissButton}
                            onClick={handleDismissVideo}
                            title="Dismiss"
                        >
                            <img src={iconClose} alt="Dismiss" />
                        </button>
                    </div>

                    <Show when={dismissState() === 'video'}>
                        <p class={styles.dismissMessage}>
                            Video hidden —{' '}
                            <span
                                class={styles.dismissLink}
                                onClick={handleDismissChannel}
                                role="button"
                                tabindex={0}
                                onKeyDown={e => e.key === 'Enter' && handleDismissChannel()}
                            >
                                Hide channel "{currentVideo()?.author?.name}" too
                            </span>
                        </p>
                    </Show>
                    <Show when={dismissState() === 'channel'}>
                        <p class={styles.dismissMessage}>Channel hidden</p>
                    </Show>
                </div>
            </div>

            <Show when={multiSlide()}>
                <button class={styles.arrowLeft} onClick={goPrev}>&#8249;</button>
                <button class={styles.arrowRight} onClick={goNext}>&#8250;</button>
                <div class={styles.dots}>
                    {props.videos.map((_, i) => (
                        <button class={i === currentIndex() ? styles.dotActive : styles.dot} onClick={() => goTo(i)} />
                    ))}
                </div>
            </Show>
        </div>

        <Show when={showInfo()}>
            <Portal>
                <div class={styles.overlayBackdrop} onClick={() => setShowInfo(false)}>
                    <div class={styles.overlayCard} onClick={e => e.stopPropagation()}>
                        <Show when={thumbnailUrl()}>
                            <img class={styles.overlayThumbnail} src={thumbnailUrl()} alt="" />
                        </Show>
                        <button class={styles.overlayClose} onClick={() => setShowInfo(false)}>&#x2715;</button>
                        <div class={styles.overlayBody}>
                            <p class={styles.overlayTitle}>{currentVideo()?.name}</p>
                            <p class={styles.overlayChannel}>{currentVideo()?.author?.name}</p>
                            <div class={styles.overlayMeta}>
                                <Show when={currentVideo()?.duration}>
                                    <span>{formatDuration(currentVideo()!.duration)}</span>
                                </Show>
                                <Show when={currentVideo()?.viewCount}>
                                    <span>{formatViews(currentVideo()!.viewCount)}</span>
                                </Show>
                                <Show when={currentVideo()?.dateTime}>
                                    <span>{new Date(currentVideo()!.dateTime!).toLocaleDateString()}</span>
                                </Show>
                            </div>
                            <Show when={currentInterest()}>
                                {(interest) => (
                                    <div class={styles.overlayInterest}>
                                        <div class={styles.overlayInterestStars}>{starsText(interest().stars)}</div>
                                        <div class={styles.overlayInterestCopy}>
                                            <div class={styles.overlayInterestLabel}>{interest().label}</div>
                                            <Show when={interestDetailText(interest())}>
                                                {(detail) => <div class={styles.overlayInterestDetail}>{detail()}</div>}
                                            </Show>
                                        </div>
                                    </div>
                                )}
                            </Show>
                            <Show when={currentGlobalSummary()}>
                                {(summary) => (
                                    <div class={styles.overlaySmartSummary}>
                                        <div class={styles.overlaySmartSummaryLabel}>Smart summary</div>
                                        <p>{summary()}</p>
                                    </div>
                                )}
                            </Show>
                            <Show when={overlayLoading()}>
                                <p class={styles.overlayLoading}>Loading...</p>
                            </Show>
                            <Show when={overlayDescription()}>
                                <p class={`${styles.overlayDescription} ${overlayDescExpanded() ? styles.overlayDescriptionExpanded : ''}`}>
                                    {overlayDescription()}
                                </p>
                                <button class={styles.overlayDescriptionToggle} onClick={() => setOverlayDescExpanded(v => !v)}>
                                    {overlayDescExpanded() ? 'Voir moins' : 'Voir plus'}
                                </button>
                            </Show>
                            <Show when={overlayChannelVideos().length > 0}>
                                <p class={styles.overlaySectionTitle}>More videos</p>
                                <div class={styles.overlayChannelVideos}>
                                    <For each={overlayChannelVideos()}>
                                        {(cv) => (
                                            <VideoThumbnailView
                                                style={{ width: '160px', 'flex-shrink': '0' }}
                                                video={cv}
                                                onClick={() => { props.onPlay(cv); setShowInfo(false); }}
                                            />
                                        )}
                                    </For>
                                </div>
                            </Show>
                            <div class={styles.overlayActions}>
                                <button
                                    class={styles.overlayPlayButton}
                                    onClick={() => { const v = currentVideo(); if (v) { props.onPlay(v); setShowInfo(false); } }}
                                >
                                    &#9654; Play
                                </button>
                                <button
                                    class={`${styles.iconButton} ${overlayAddedToWatchLater() ? styles.iconButtonActive : ''}`}
                                    onClick={() => handleWatchLater(overlayAddedToWatchLater, setOverlayAddedToWatchLater)}
                                    title={overlayAddedToWatchLater() ? 'Remove from Watch later' : 'Watch later'}
                                >
                                    <img src={iconWatchLater} alt="Watch later" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </Portal>
        </Show>
        </>
    );
};

export default HeroBanner;
