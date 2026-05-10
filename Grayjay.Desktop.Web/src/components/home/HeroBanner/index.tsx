import { Component, createMemo } from 'solid-js';

import { IPlatformVideo } from '../../../backend/models/content/IPlatformVideo';
import styles from './index.module.css';

interface HeroBannerProps {
    video: IPlatformVideo;
    onPlay: () => void;
}

const HeroBanner: Component<HeroBannerProps> = (props) => {
    const thumbnailUrl = createMemo(() => {
        const sources = props.video?.thumbnails?.sources;
        if (!sources || sources.length === 0) return '';
        const sorted = [...sources].sort((a, b) => (b.quality ?? 0) - (a.quality ?? 0));
        return sorted[0]?.url?.replace('u0026', '&') ?? '';
    });

    return (
        <div
            class={styles.banner}
            style={{ 'background-image': thumbnailUrl() ? `url(${thumbnailUrl()})` : 'none' }}
        >
            <div class={styles.gradient} />
            <div class={styles.content}>
                <p class={styles.title}>{props.video?.name}</p>
                <p class={styles.channel}>{props.video?.author?.name}</p>
                <button class={styles.playButton} onClick={props.onPlay}>
                    &#9654; Play
                </button>
            </div>
        </div>
    );
};

export default HeroBanner;
