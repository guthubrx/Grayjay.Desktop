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
    const intervalMs = () => props.intervalMs ?? 5000;

    // Auto-advance timer — reset when index changes manually
    let timerId: ReturnType<typeof setInterval> | undefined;

    function startTimer() {
        clearInterval(timerId);
        timerId = setInterval(() => {
            setCurrentIndex(i => (i + 1) % props.videos.length);
        }, intervalMs());
    }

    createEffect(() => {
        // Re-start when videos list or interval changes
        void props.videos.length;
        void intervalMs();
        startTimer();
    });

    onCleanup(() => clearInterval(timerId));

    // Preload next image to avoid flash on slide change
    createEffect(() => {
        if (props.videos.length <= 1) return;
        const next = (currentIndex() + 1) % props.videos.length;
        const nextThumb = getBestThumbnail(props.videos[next]);
        if (nextThumb) {
            const img = new Image();
            img.src = nextThumb;
        }
    });

    const currentVideo = () => props.videos[currentIndex()];

    const thumbnailUrl = () => {
        const v = currentVideo();
        return v ? getBestThumbnail(v) ?? '' : '';
    };

    function goTo(index: number) {
        setCurrentIndex(index);
        startTimer();
    }

    function goPrev() {
        goTo((currentIndex() - 1 + props.videos.length) % props.videos.length);
    }

    function goNext() {
        goTo((currentIndex() + 1) % props.videos.length);
    }

    const multiSlide = () => props.videos.length > 1;

    return (
        <div
            class={styles.banner}
            style={{ 'background-image': thumbnailUrl() ? `url(${thumbnailUrl()})` : 'none' }}
        >
            <div class={styles.gradient} />

            <div class={styles.content}>
                <p class={styles.title}>{currentVideo()?.name}</p>
                <p class={styles.channel}>{currentVideo()?.author?.name}</p>
                <button
                    class={styles.playButton}
                    onClick={() => { const v = currentVideo(); if (v) props.onPlay(v); }}
                >
                    &#9654; Play
                </button>
            </div>

            <Show when={multiSlide()}>
                <button class={styles.arrowLeft} onClick={goPrev} aria-label="Previous slide">&#8249;</button>
                <button class={styles.arrowRight} onClick={goNext} aria-label="Next slide">&#8250;</button>

                <div class={styles.dots}>
                    {props.videos.map((_, i) => (
                        <button
                            class={i === currentIndex() ? styles.dotActive : styles.dot}
                            onClick={() => goTo(i)}
                            aria-label={`Go to slide ${i + 1}`}
                        />
                    ))}
                </div>
            </Show>
        </div>
    );
};

export default HeroBanner;
