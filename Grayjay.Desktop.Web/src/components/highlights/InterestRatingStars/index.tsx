import { Component, For } from 'solid-js';

import styles from './index.module.css';

interface InterestRatingStarsProps {
    stars: number;
    text: string;
    ariaLabel: string;
    class?: string;
}

const InterestRatingStars: Component<InterestRatingStarsProps> = (props) => {
    const normalizedStars = () => Math.max(0.5, Math.min(5, Math.round(props.stars * 2) / 2));
    const fullStars = () => Math.floor(normalizedStars());
    const hasHalfStar = () => normalizedStars() - fullStars() === 0.5;

    return (
        <span class={`${styles.rating}${props.class ? ` ${props.class}` : ''}`} role="img" aria-label={props.ariaLabel}>
            <span class={styles.stars} aria-hidden="true">
                <For each={[0, 1, 2, 3, 4]}>{(index) => (
                    <span
                        class={styles.star}
                        classList={{
                            [styles.full]: index < fullStars(),
                            [styles.half]: index === fullStars() && hasHalfStar(),
                        }}
                    />
                )}</For>
            </span>
            <span class={styles.text} aria-hidden="true">{props.text}</span>
        </span>
    );
};

export default InterestRatingStars;
