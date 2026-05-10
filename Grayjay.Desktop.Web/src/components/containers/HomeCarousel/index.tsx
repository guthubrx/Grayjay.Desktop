import { Component, For, JSX } from 'solid-js';

import styles from './index.module.css';

const SCROLL_STEP = 500;

interface HomeCarouselProps {
    title: string;
    items: any[];
    builder: (index: number, item: any) => JSX.Element;
    onTitleClick?: () => void;
    onEnd?: () => void;
}

const HomeCarousel: Component<HomeCarouselProps> = (props) => {
    let scrollRef: HTMLDivElement | undefined;

    function scrollLeft() {
        scrollRef?.scrollBy({ left: -SCROLL_STEP, behavior: 'smooth' });
    }

    function scrollRight() {
        scrollRef?.scrollBy({ left: SCROLL_STEP, behavior: 'smooth' });

        if (!scrollRef || !props.onEnd) return;
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef;
        if (scrollLeft + clientWidth >= scrollWidth - SCROLL_STEP) {
            props.onEnd();
        }
    }

    return (
        <div class={styles.carousel}>
            <div class={styles.header}>
                <span
                    class={props.onTitleClick ? styles.titleClickable : styles.title}
                    onClick={props.onTitleClick}
                >
                    {props.title}
                </span>
                <div class={styles.navButtons}>
                    <button class={styles.navButton} onClick={scrollLeft} aria-label="Scroll left">&#8249;</button>
                    <button class={styles.navButton} onClick={scrollRight} aria-label="Scroll right">&#8250;</button>
                </div>
            </div>
            <div ref={scrollRef} class={styles.scrollWrapper}>
                <div class={styles.itemsRow}>
                    <For each={props.items}>
                        {(item, index) => props.builder(index(), item)}
                    </For>
                </div>
            </div>
        </div>
    );
};

export default HomeCarousel;
