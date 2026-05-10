import { Component, createEffect, createSignal, onCleanup, Show } from 'solid-js';
import { Portal } from 'solid-js/web';

import { IPlatformVideo } from '../../../backend/models/content/IPlatformVideo';
import styles from './index.module.css';

interface HeroBannerProps {
    videos: IPlatformVideo[];
    onPlay: (video: IPlatformVideo) => void;
    intervalMs?: number;
}

function getBestThumbnail(v: IPlatformVideo): string | undefined {
    return v.thumbnails?.sources?.sort((a, b) => (b.quality ?? 0) - (a.quality ?? 0))[0]?.url?.replace('u0026', '&');
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

const HeroBanner: Component<HeroBannerProps> = (props) => {
    const [currentIndex, setCurrentIndex] = createSignal(0);
    const [showInfo, setShowInfo] = createSignal(false);
    const intervalMs = () => props.intervalMs ?? 10000;

    let timerId: ReturnType<typeof setInterval> | undefined;

    function startTimer() {
        clearInterval(timerId);
        timerId = setInterval(() => {
            setCurrentIndex(i => (i + 1) % props.videos.length);
        }, intervalMs());
    }

    createEffect(() => {
        void props.videos.length;
        void intervalMs();
        startTimer();
    });

    onCleanup(() => clearInterval(timerId));

    createEffect(() => {
        if (props.videos.length <= 1) return;
        const next = (currentIndex() + 1) % props.videos.length;
        const url = getBestThumbnail(props.videos[next]);
        if (url) { const img = new Image(); img.src = url; }
    });

    const currentVideo = () => props.videos[currentIndex()];
    const thumbnailUrl = () => getBestThumbnail(currentVideo()) ?? '';
    const multiSlide = () => props.videos.length > 1;

    function goTo(index: number) { setCurrentIndex(index); startTimer(); }
    function goPrev() { goTo((currentIndex() - 1 + props.videos.length) % props.videos.length); }
    function goNext() { goTo((currentIndex() + 1) % props.videos.length); }

    return (
        <>
        <div class={styles.banner}>
            <div
                class={styles.blurredBg}
                style={{ 'background-image': thumbnailUrl() ? `url(${thumbnailUrl()})` : 'none' }}
            />
            <div class={styles.gradient} />

            <div class={styles.inner}>
                <Show when={thumbnailUrl()}>
                    <img class={styles.thumbnail} src={thumbnailUrl()} alt={currentVideo()?.name ?? ''} />
                </Show>
                <div class={styles.meta}>
                    <p class={styles.title}>{currentVideo()?.name}</p>
                    <p class={styles.channel}>{currentVideo()?.author?.name}</p>
                    <div class={styles.actions}>
                        <button
                            class={styles.playButton}
                            onClick={() => { const v = currentVideo(); if (v) props.onPlay(v); }}
                        >
                            &#9654; Play
                        </button>
                        <button
                            class={styles.infoButton}
                            onClick={() => setShowInfo(true)}
                            title="More info"
                        >
                            i
                        </button>
                    </div>
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

        {/* Info overlay — rendered via Portal to escape overflow:hidden */}
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
                            <button
                                class={styles.overlayPlayButton}
                                onClick={() => { const v = currentVideo(); if (v) { props.onPlay(v); setShowInfo(false); } }}
                            >
                                &#9654; Play
                            </button>
                        </div>
                    </div>
                </div>
            </Portal>
        </Show>
        </>
    );
};

export default HeroBanner;
