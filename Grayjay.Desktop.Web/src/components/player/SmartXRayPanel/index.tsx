import { Component, createMemo, createEffect, createSignal, For, Show } from "solid-js";
import { IVideoHighlightSegment } from "../../../backend/models/highlights/IVideoHighlightSegment";
import { IVideoHighlightThesis } from "../../../backend/models/highlights/IVideoHighlightThesis";
import { IChapter } from "../../../backend/models/contentDetails/IChapter";
import { Duration } from "luxon";
import styles from "./index.module.css";
import { xRayState$, saveXRayPanelWidthPercent, MIN_WIDTH_PCT, MAX_WIDTH_PCT } from "../../../state/StateXRay";

export interface SmartXRayPanelProps {
    open: boolean;
    pinned: boolean;
    controlsVisible: boolean;
    minimized: boolean;
    onClose: () => void;
    onTogglePin: () => void;
    globalSummary?: string;
    theses?: IVideoHighlightThesis[];
    smartChapters?: IVideoHighlightSegment[];
    chapters?: IChapter[];
    position: Duration;
    onSeek: (seconds: number) => void;
}

function formatSeconds(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${m}:${String(sec).padStart(2, "0")}`;
}

function truncate(text: string, limit: number): string {
    if (limit <= 0 || text.length <= limit) return text;
    return text.slice(0, limit) + "…";
}

const SmartXRayPanel: Component<SmartXRayPanelProps> = (props) => {
    let activeRef: HTMLDivElement | undefined;
    let panelRef: HTMLDivElement | undefined;
    let draggedThisSession = false;

    const [widthPct, setWidthPct] = createSignal(xRayState$().panelWidthPercent);

    // Sync width from settings (until user drags)
    createEffect(() => {
        const w = xRayState$().panelWidthPercent;
        if (!draggedThisSession) setWidthPct(w);
    });

    const positionSeconds = createMemo(() => props.position.milliseconds / 1000);
    const useSmartChapters = createMemo(() => (props.smartChapters?.length ?? 0) > 0);

    const activeChapterIndex = createMemo(() => {
        const pos = positionSeconds();
        if (useSmartChapters()) {
            return (props.smartChapters ?? []).findIndex(s => s.start <= pos && s.end > pos);
        }
        const chs = props.chapters ?? [];
        for (let i = chs.length - 1; i >= 0; i--) {
            if (chs[i].timeStart <= pos) return i;
        }
        return -1;
    });

    createEffect(() => {
        const _ = activeChapterIndex();
        if (props.open && activeRef) {
            activeRef.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
    });

    const scoreClass = (score?: number) => {
        if (score == null) return styles.scoreDot;
        if (score >= 0.93) return `${styles.scoreDot} ${styles.scoreTop}`;
        if (score >= 0.88) return `${styles.scoreDot} ${styles.scoreStrong}`;
        return `${styles.scoreDot} ${styles.scoreContext}`;
    };

    const hasContent = createMemo(() =>
        !!props.globalSummary ||
        (props.theses?.length ?? 0) > 0 ||
        (props.smartChapters?.length ?? 0) > 0 ||
        (props.chapters?.length ?? 0) > 0
    );

    // Jamais affiché sans contenu (même pinné), ni en miniature (cache la vidéo) ; réapparaît si pinné en grand
    const effectiveOpen = () => props.open && hasContent() && !props.minimized && (props.pinned || props.controlsVisible);

    const visibleTheses = createMemo(() => {
        const max = xRayState$().maxTheses;
        return max > 0 ? (props.theses ?? []).slice(0, max) : (props.theses ?? []);
    });

    const onDragHandleMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        // Largeur du conteneur (le player) pour convertir px <-> %
        const containerWidth = panelRef?.parentElement?.clientWidth ?? window.innerWidth;
        const startX = e.clientX;
        const startWidthPx = (widthPct() / 100) * containerWidth;

        const onMouseMove = (ev: MouseEvent) => {
            const delta = startX - ev.clientX;
            const newPct = ((startWidthPx + delta) / containerWidth) * 100;
            setWidthPct(Math.min(MAX_WIDTH_PCT, Math.max(MIN_WIDTH_PCT, newPct)));
        };

        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            draggedThisSession = true;
            void saveXRayPanelWidthPercent(widthPct());
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    };

    return (
        <div
            ref={panelRef}
            classList={{ [styles.panel]: true, [styles.open]: effectiveOpen() }}
            style={{
                width: `${widthPct()}%`,
                background: `rgba(8, 10, 14, ${xRayState$().opacity})`,
                "font-size": `${xRayState$().fontSize}px`,
            }}
        >
            <div class={styles.dragHandle} onMouseDown={onDragHandleMouseDown} />

            <div class={styles.header}>
                <div class={styles.headerActions}>
                    <button
                        class={styles.pinButton}
                        classList={{ [styles.pinned]: props.pinned }}
                        onClick={props.onTogglePin}
                        title={props.pinned ? "Désépingler" : "Épingler (reste visible)"}
                    >
                        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                            <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/>
                            <Show when={props.pinned}>
                                <circle cx="10" cy="10" r="3.5" fill="currentColor"/>
                            </Show>
                        </svg>
                    </button>
                    <button class={styles.closeButton} onClick={props.onClose} title="Fermer">&#x2715;</button>
                </div>
            </div>

            <div class={styles.body}>

                <Show when={props.globalSummary}>
                    <section class={styles.section}>
                        <p class={styles.summaryText}>
                            {truncate(props.globalSummary!, xRayState$().globalSummaryChars)}
                        </p>
                    </section>
                </Show>

                <Show when={visibleTheses().length > 0}>
                    <section class={styles.section}>
                        <div class={styles.theses}>
                            <For each={visibleTheses()}>{(thesis) => (
                                <div class={styles.thesis}>
                                    <span class={styles.thesisId}>{thesis.id}</span>
                                    <span class={styles.thesisStatement}>{thesis.statement}</span>
                                </div>
                            )}</For>
                        </div>
                    </section>
                </Show>

                <Show when={(props.smartChapters?.length ?? 0) > 0 || (props.chapters?.length ?? 0) > 0}>
                    <section class={styles.section}>
                        <div class={styles.chapters}>
                            <Show when={useSmartChapters()}>
                                <For each={props.smartChapters}>{(seg, i) => (
                                    <div
                                        ref={i() === activeChapterIndex() ? (el) => { activeRef = el; } : undefined}
                                        classList={{
                                            [styles.chapterItem]: true,
                                            [styles.chapterActive]: i() === activeChapterIndex(),
                                        }}
                                        onClick={() => props.onSeek(seg.start)}
                                    >
                                        <span class={scoreClass(seg.score)} />
                                        <span class={styles.chapterTime}>{formatSeconds(seg.start)}</span>
                                        <div class={styles.chapterInfo}>
                                            <span class={styles.chapterTitle}>{seg.title}</span>
                                            <Show when={seg.summary}>
                                                <span class={styles.chapterSummary}>
                                                    {truncate(seg.summary!, xRayState$().chapterSummaryChars)}
                                                </span>
                                            </Show>
                                        </div>
                                    </div>
                                )}</For>
                            </Show>
                            <Show when={!useSmartChapters()}>
                                <For each={props.chapters}>{(ch, i) => (
                                    <div
                                        ref={i() === activeChapterIndex() ? (el) => { activeRef = el; } : undefined}
                                        classList={{
                                            [styles.chapterItem]: true,
                                            [styles.chapterActive]: i() === activeChapterIndex(),
                                        }}
                                        onClick={() => props.onSeek(ch.timeStart)}
                                    >
                                        <span class={`${styles.scoreDot} ${styles.scoreContext}`} />
                                        <span class={styles.chapterTime}>{formatSeconds(ch.timeStart)}</span>
                                        <div class={styles.chapterInfo}>
                                            <span class={styles.chapterTitle}>{ch.name}</span>
                                        </div>
                                    </div>
                                )}</For>
                            </Show>
                        </div>
                    </section>
                </Show>
            </div>
        </div>
    );
};

export default SmartXRayPanel;
