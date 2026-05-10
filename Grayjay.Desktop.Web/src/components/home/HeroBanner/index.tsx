import { Component, createEffect, createSignal, onCleanup, Show } from 'solid-js';

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

const HeroBanner: Component<HeroBannerProps> = (props) => {
    const [currentIndex, setCurrentIndex] = createSignal(0);
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

    // Preload next image
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
        <div class={styles.banner}>
            {/* Blurred background layer — same image, fills sides on wide screens */}
            <div
                class={styles.blurredBg}
                style={{ 'background-image': thumbnailUrl() ? `url(${thumbnailUrl()})` : 'none' }}
            />

            {/* Centered content: sharp thumbnail + text */}
            <div class={styles.inner}>
                <Show when={thumbnailUrl()}>
                    <img
                        class={styles.thumbnail}
                        src={thumbnailUrl()}
                        alt={currentVideo()?.name ?? ''}
                    />
                </Show>
                <div class={styles.meta}>
                    <p class={styles.title}>{currentVideo()?.name}</p>
                    <p class={styles.channel}>{currentVideo()?.author?.name}</p>
                    <button
                        class={styles.playButton}
                        onClick={() => { const v = currentVideo(); if (v) props.onPlay(v); }}
                    >
                        &#9654; Play
                    </button>
                </div>
            </div>

            {/* Arrows + dots */}
            <Show when={multiSlide()}>
                <button class={styles.arrowLeft} onClick={goPrev} aria-label="Previous">&#8249;</button>
                <button class={styles.arrowRight} onClick={goNext} aria-label="Next">&#8250;</button>
                <div class={styles.dots}>
                    {props.videos.map((_, i) => (
                        <button
                            class={i === currentIndex() ? styles.dotActive : styles.dot}
                            onClick={() => goTo(i)}
                        />
                    ))}
                </div>
            </Show>
        </div>
    );
};

export default HeroBanner;
