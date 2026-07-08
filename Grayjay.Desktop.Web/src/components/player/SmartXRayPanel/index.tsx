import { Component, createMemo, createEffect, createSignal, For, Show } from "solid-js";
import { IVideoHighlightSegment } from "../../../backend/models/highlights/IVideoHighlightSegment";
import { IVideoHighlightThesis } from "../../../backend/models/highlights/IVideoHighlightThesis";
import { IChapter } from "../../../backend/models/contentDetails/IChapter";
import { Duration } from "luxon";
import styles from "./index.module.css";
import iconSidebarClose from "../../../assets/icons/sidebar-close.svg";
import { xRayState$, saveXRayPanelWidthPercent, MIN_WIDTH_PCT, MAX_WIDTH_PCT, scoreToColor } from "../../../state/StateXRay";

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
    let itemRefs: (HTMLDivElement | undefined)[] = [];
    let panelRef: HTMLDivElement | undefined;
    let bodyRef: HTMLDivElement | undefined;
    let draggedThisSession = false;

    const [widthPct, setWidthPct] = createSignal(xRayState$().panelWidthPercent);
    const [hovered, setHovered] = createSignal(false);

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

    // On positionne la section active dans le tiers superieur du panneau : il
    // reste ainsi toujours de la marge en dessous pour voir arriver les
    // prochaines sections. (Le navigateur borne le scroll, donc la premiere
    // section reste en haut et la derniere en bas, naturellement.)
    createEffect(() => {
        const active = activeChapterIndex();
        if (!props.open || active < 0) return;
        const el = itemRefs[active];
        const container = bodyRef;
        if (!el || !container) return;
        const offsetWithin = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
        const target = offsetWithin - container.clientHeight * 0.3;
        container.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
    });

    // Couleur d'importance : dégradé thermique continu (froid -> chaud).
    const scoreColor = (score?: number) => scoreToColor(score);
    const activeColor = createMemo(() =>
        useSmartChapters() ? scoreColor(props.smartChapters?.[activeChapterIndex()]?.score) : "#019BE8"
    );
    // Avancement (0..1) dans la section en cours, pour remplir la bordure.
    const activeProgress = createMemo(() => {
        const idx = activeChapterIndex();
        const pos = positionSeconds();
        let start: number | undefined, end: number | undefined;
        if (useSmartChapters()) {
            const seg = props.smartChapters?.[idx];
            start = seg?.start; end = seg?.end;
        } else {
            const chs = props.chapters ?? [];
            start = chs[idx]?.timeStart;
            end = chs[idx + 1]?.timeStart ?? (start != null ? start + 1 : undefined);
        }
        if (start == null || end == null || end <= start) return 0;
        return Math.max(0, Math.min(1, (pos - start) / (end - start)));
    });

    const hasContent = createMemo(() =>
        !!props.globalSummary ||
        (props.theses?.length ?? 0) > 0 ||
        (props.smartChapters?.length ?? 0) > 0 ||
        (props.chapters?.length ?? 0) > 0
    );

    // Jamais affiché sans contenu (même pinné), ni en miniature (cache la vidéo).
    // Reste visible si pinné, si les contrôles sont visibles, ou si la souris est dessus.
    const effectiveOpen = () => props.open && hasContent() && !props.minimized && (props.pinned || props.controlsVisible || hovered());

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
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
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
                    <button class={styles.closeButton} onClick={props.onClose} title="Replier le panneau">
                        <img src={iconSidebarClose} width="16" height="16" alt="Replier" />
                    </button>
                </div>
            </div>

            <div class={styles.body} ref={bodyRef}>

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
                                        ref={(el) => { itemRefs[i()] = el; }}
                                        classList={{
                                            [styles.chapterItem]: true,
                                            [styles.chapterActive]: i() === activeChapterIndex(),
                                        }}
                                        onClick={() => props.onSeek(seg.start)}
                                    >
                                        <Show when={i() === activeChapterIndex()}>
                                            <span class={styles.activeBar} style={{ background: `linear-gradient(to bottom, ${activeColor()} ${activeProgress() * 100}%, rgba(255,255,255,0.16) ${activeProgress() * 100}%)` }} />
                                        </Show>
                                        <span class={styles.scoreDot} style={{ background: scoreToColor(seg.score) }} />
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
                                        ref={(el) => { itemRefs[i()] = el; }}
                                        classList={{
                                            [styles.chapterItem]: true,
                                            [styles.chapterActive]: i() === activeChapterIndex(),
                                        }}
                                        onClick={() => props.onSeek(ch.timeStart)}
                                    >
                                        <Show when={i() === activeChapterIndex()}>
                                            <span class={styles.activeBar} style={{ background: `linear-gradient(to bottom, ${activeColor()} ${activeProgress() * 100}%, rgba(255,255,255,0.16) ${activeProgress() * 100}%)` }} />
                                        </Show>
                                        <span class={`${styles.scoreDot} ${styles.scoreFiller}`} />
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
