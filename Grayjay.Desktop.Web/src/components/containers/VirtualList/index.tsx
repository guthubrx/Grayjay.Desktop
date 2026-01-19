import { Component, createSignal, onCleanup, onMount, For, JSX, createMemo, createEffect, ErrorBoundary, Accessor, Show, batch, on, untrack } from "solid-js";
import { Event1 } from "../../../utility/Event";
import { getNestedOffsetTop, getTopInScrollContent } from "../../../utility";

export interface VirtualListProps {
    itemHeight: number;
    items?: any[];
    builder: (index: Accessor<number | undefined>, item: Accessor<any>) => JSX.Element;
    outerContainerRef: HTMLDivElement | undefined;
    overscan?: number;
    notifyEndOnLast?: number;
    onEnd?: () => void;
    addedItems?: Event1<{startIndex: number, endIndex: number}>;
    modifiedItems?: Event1<{startIndex: number, endIndex: number}>;
    removedItems?: Event1<{startIndex: number, endIndex: number}>;
};

interface VisibleRange {
    startIndex: number;
    endIndex: number;
}

const VirtualList: Component<VirtualListProps> = (props) => {
    const listenerKey = {};
    let containerRef: HTMLDivElement | undefined;

    const [totalHeight, setTotalHeight] = createSignal(0);
    const [poolSize, setPoolSize] = createSignal(0);
    const pool = createMemo(on(poolSize, (size) => {
        return Array.from({ length: size }, (_, i) => {
            const [top$, setTop] = createSignal<number>(-1);
            const [index$, setIndex] = createSignal<number | undefined>(undefined);
            const [item$, setItem] = createSignal<any>();
            const element = props.builder(index$, item$);
            return {
                top: top$,
                setTop,
                index: index$,
                setIndex,
                item: item$,
                setItem,
                element
            };
        });
    }));

    const [visibleRange, setVisibleRange] = createSignal<VisibleRange>();
    const updatePoolSize = (elementsInView: number) => {
        const overscan = props.overscan ?? 1;
        const desired = Math.ceil((elementsInView + overscan * 2) * 2); // 2x buffer
        if (desired > poolSize()) setPoolSize(desired);
    };

    let endNotifyLen = -1;
    let endNotifyQueued = false;

    function maybeNotifyEnd(endIndex: number, itemsLen: number) {
        if (!props.onEnd) return;

        const threshold = props.notifyEndOnLast ?? 1;
        const nearEnd = (itemsLen - 1) - endIndex <= threshold;
        if (!nearEnd) return;

        if (endNotifyLen === itemsLen || endNotifyQueued) return;

        endNotifyQueued = true;
        queueMicrotask(() => {
            endNotifyQueued = false;
            endNotifyLen = itemsLen;
            props.onEnd?.();
        });
    }

    const calculateVisibleRange = () => {
        const outer = props.outerContainerRef;
        const listEl = containerRef;
        if (!outer || !listEl) return;

        const items = props.items;
        if (!items || items.length === 0) {
            batch(() => {
                setVisibleRange({ startIndex: 0, endIndex: 0 });
                setTotalHeight(0);
                updatePoolSize(1);
            });
            return;
        }

        const outerRect = outer.getBoundingClientRect();
        const listRect = listEl.getBoundingClientRect();
        const listTopInViewport = listRect.top - outerRect.top;
        const visibleHeightForList = Math.max(0, outerRect.height - Math.max(0, listTopInViewport));
        const elementsInView = Math.max(1, Math.ceil(visibleHeightForList / props.itemHeight));
        const listTopInContent = getTopInScrollContent(listEl, outer);
        const rawScrollOffset = outer.scrollTop - listTopInContent;
        const scrollOffset = Math.max(0, rawScrollOffset);

        const overscan = props.overscan ?? 1;
        const startRowIndex = Math.floor(scrollOffset / props.itemHeight);
        const startIndex = Math.max(0, Math.min(startRowIndex - overscan, items.length - 1));
        const endIndex = Math.max(0, Math.min(startRowIndex + elementsInView + overscan, items.length - 1));
        console.log("calculateVisibleRange", {startRowIndex, startIndex, endIndex, elementsInView, scrollOffset});

        if (props.onEnd) {
            if ((items.length - 1) - endIndex <= (props.notifyEndOnLast ?? 1)) {
                maybeNotifyEnd(endIndex, items.length);
            }
        }

        batch(() => {
            setVisibleRange({ startIndex, endIndex });
            updatePoolSize(elementsInView);
            setTotalHeight(items.length * props.itemHeight);
        });
    };

    const onUIEvent = () => {
        calculateVisibleRange();
    };

    const resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(onUIEvent);
    });

    let lastAddedItems: Event1<{ startIndex: number, endIndex: number }> | undefined;
    const attachAddedItems = (addedItems?: Event1<{ startIndex: number; endIndex: number }>) => {
        lastAddedItems?.unregister(listenerKey);
        addedItems?.registerOne(listenerKey, (v) => {
            calculateVisibleRange();
            console.log("added items", v);
        });
        lastAddedItems = addedItems;
        calculateVisibleRange();
    };
    
    let lastRemovedItems: Event1<{ startIndex: number, endIndex: number }> | undefined;
    const attachRemovedItems = (removedItems?: Event1<{ startIndex: number; endIndex: number }>) => {
        lastRemovedItems?.unregister(listenerKey);
        removedItems?.registerOne(listenerKey, calculateVisibleRange);
        lastRemovedItems = removedItems;
        calculateVisibleRange();
    };
    
    let lastModifiedItems: Event1<{ startIndex: number, endIndex: number }> | undefined;
    const attachModifiedItems = (modifiedItems?: Event1<{ startIndex: number; endIndex: number }>) => {
        lastModifiedItems?.unregister(listenerKey);
        modifiedItems?.registerOne(listenerKey, calculateVisibleRange);
        lastModifiedItems = modifiedItems;
        calculateVisibleRange();
    };

    createEffect(() => attachAddedItems(props.addedItems));
    createEffect(() => attachModifiedItems(props.modifiedItems));
    createEffect(() => attachRemovedItems(props.removedItems));

    onMount(() => {
        calculateVisibleRange();
        requestAnimationFrame(() => {
            calculateVisibleRange();
        });

        //TODO debounce?
        resizeObserver.observe(props.outerContainerRef!);
        //window.addEventListener('resize', onUIEvent);
        props.outerContainerRef?.addEventListener('scroll', onUIEvent);
    });

    onCleanup(() => {
        props.addedItems?.unregister(listenerKey);
        props.modifiedItems?.unregister(listenerKey);
        props.removedItems?.unregister(listenerKey);
        lastAddedItems?.unregister(listenerKey);
        lastModifiedItems?.unregister(listenerKey);
        lastRemovedItems?.unregister(listenerKey);
        resizeObserver.unobserve(props.outerContainerRef!);
        //window.removeEventListener('resize', onUIEvent);
        props.outerContainerRef?.removeEventListener('scroll', onUIEvent);
        resizeObserver.disconnect();
    });

    const clearPoolItem = (p: any) => {
        p.setIndex(undefined);
        p.setItem(undefined);
        p.setTop(-1);
    };

    createEffect(() => {
        const range = visibleRange();
        const items = props.items;
        const poolItems = pool();

        if (!items || !range) return;

        const start = range.startIndex;
        const end = Math.min(range.endIndex, items.length - 1);

        batch(() => {
            for (const p of poolItems) {
                const idx = untrack(p.index);
                if (idx === undefined) continue;
                if (idx < start || idx > end || idx >= items.length) {
                    clearPoolItem(p);
                }
            }

            const seen = new Set<number>();
            for (const p of poolItems) {
                const idx = untrack(p.index);
                if (idx === undefined) continue;
                if (seen.has(idx)) clearPoolItem(p);
                else seen.add(idx);
            }

            const byIndex = new Map<number, any>();
            for (const p of poolItems) {
                const idx = untrack(p.index);
                if (idx !== undefined) byIndex.set(idx, p);
            }

            for (let i = start; i <= end; i++) {
                let p = byIndex.get(i);
                if (!p) {
                    p = poolItems.find(x => untrack(x.index) === undefined);
                    if (!p) {
                        console.error("pool size too small", { start, end, poolSize: poolItems.length });
                        break;
                    }
                    p.setIndex(i);
                }

                p.setItem(items[i]);
                p.setTop(i * props.itemHeight);
            }
        });
    });

    
    return (
        <div ref={containerRef}
            style={{
                height: totalHeight() + "px", 
                position: 'relative'
            }}>
    
            <For each={pool()}>
                {(poolItem) => (
                    <Show when={poolItem.index() !== undefined}>
                        <div
                            style={{
                                position: 'absolute',
                                top: `${poolItem.top()}px`,
                                left: `0px`,
                                height: `${props.itemHeight}px`,
                                width: `100%`
                            }}
                        >
                            <ErrorBoundary fallback={(err, reset) => <div></div>}>
                                {poolItem.element}
                            </ErrorBoundary>
                        </div>
                    </Show>
                )}
            </For>
        </div>
    );
};

export default VirtualList;
