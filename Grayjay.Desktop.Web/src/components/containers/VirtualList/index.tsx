import { Component, createSignal, onCleanup, onMount, For, JSX, createMemo, createEffect, ErrorBoundary, Accessor, Show, batch, on, untrack } from "solid-js";
import { Event1 } from "../../../utility/Event";
import { getNestedOffsetTop } from "../../../utility";

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
    const updatePoolSize = () => {
        const boundingRect = props.outerContainerRef?.getBoundingClientRect();
        if (boundingRect) {
            const elementsInView = Math.ceil(boundingRect.height / props.itemHeight);
            const desiredPoolSize = Math.floor(2 * (elementsInView + (props.overscan ?? 1) * 2));
            if (desiredPoolSize > poolSize()) {
                console.log("desiredPoolSize larger than pool size, change pool", desiredPoolSize);
                setPoolSize(desiredPoolSize);
            }
        }
    };

    const calculateVisibleRange = () => {
        if (!props.outerContainerRef || !containerRef) return;

        if (!props.items || !props.items.length) {
            batch(() => {
                setVisibleRange({ startIndex: 0, endIndex: 0 });
                setTotalHeight(0);
                updatePoolSize();
            });
            return;
        }

        const overscan = props.overscan ?? 1;
        const boundingRect = props.outerContainerRef.getBoundingClientRect();
        const elementsInView = Math.ceil(boundingRect.height / props.itemHeight);
        const scrollOffset = props.outerContainerRef.scrollTop - getNestedOffsetTop(containerRef, props.outerContainerRef);

        const startRowIndex = Math.floor(scrollOffset / props.itemHeight);
        const startIndex = Math.max(0, Math.min(startRowIndex - overscan, props.items!.length - 1));
        const endIndex = Math.max(0, Math.min(startRowIndex + elementsInView - 1 + overscan, props.items!.length - 1));
        
        if (props.onEnd) {
            if ((props.items!.length - 1) - endIndex <= (props.notifyEndOnLast ?? 1)) {
                props.onEnd();
            }
        }

        batch(() => {
            setVisibleRange({ startIndex, endIndex });
            updatePoolSize();
            setTotalHeight((props.items?.length ?? 0) * props.itemHeight);
        });
    };

    const onUIEvent = () => {
        calculateVisibleRange();
    };

    const resizeObserver = new ResizeObserver(entries => {
        onUIEvent();
    });

    let lastAddedItems: Event1<{ startIndex: number, endIndex: number }> | undefined;
    const attachAddedItems = (addedItems?: Event1<{ startIndex: number; endIndex: number }>) => {
        lastAddedItems?.unregister(listenerKey);
        addedItems?.registerOne(listenerKey, () => untrack(() => calculateVisibleRange()));
        lastAddedItems = addedItems;
    };
    
    let lastRemovedItems: Event1<{ startIndex: number, endIndex: number }> | undefined;
    const attachRemovedItems = (removedItems?: Event1<{ startIndex: number; endIndex: number }>) => {
        lastRemovedItems?.unregister(listenerKey);
        removedItems?.registerOne(listenerKey, () => untrack(() => calculateVisibleRange()));
        lastRemovedItems = removedItems;
    };
    
    let lastModifiedItems: Event1<{ startIndex: number, endIndex: number }> | undefined;
    const attachModifiedItems = (modifiedItems?: Event1<{ startIndex: number; endIndex: number }>) => {
        lastModifiedItems?.unregister(listenerKey);
        modifiedItems?.registerOne(listenerKey, () => untrack(() => calculateVisibleRange()));
        lastModifiedItems = modifiedItems;
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
