import { Component, createMemo, For, Show } from "solid-js";

import { IPlatformContent } from "../../../backend/models/content/IPlatformContent";
import { IPlatformVideo } from "../../../backend/models/content/IPlatformVideo";
import { ISmartSearchResult, ISmartSearchSession } from "../../../backend/SmartSearchBackend";
import { SMART_SEARCH_LANGUAGE_OPTIONS, SmartSearchResultLayout, SmartSearchTitleDisplay } from "../../../state/StateSmartSearch";
import { mixSmartSearchResultLanes, smartSearchContentKey, STANDARD_SMART_SEARCH_SOURCE } from "../../../utils/smartSearchResultLayout";
import VideoThumbnailView from "../../content/VideoThumbnailView";
import { useVideo } from "../../../contexts/VideoProvider";
import styles from "./index.module.css";

interface SmartSearchResultsProps {
    loading: boolean;
    translatingTitles: boolean;
    titleDisplay: SmartSearchTitleDisplay;
    translateCreatorNames: boolean;
    resultLayout: SmartSearchResultLayout;
    standardResults: IPlatformContent[];
    compareResults?: (first: ISmartSearchResult, second: ISmartSearchResult) => number;
    session?: ISmartSearchSession;
}

const languageLabel = (language: string) => {
    if (language === STANDARD_SMART_SEARCH_SOURCE)
        return "Standard";
    return SMART_SEARCH_LANGUAGE_OPTIONS.find(option => option.code === language)?.label ?? language;
};

const SmartSearchResults: Component<SmartSearchResultsProps> = (props) => {
    const video = useVideo();

    const openVideo = (content: IPlatformVideo) => {
        const url = content.backendUrl ?? content.url;
        if (url)
            video?.actions.openVideo(content);
    };

    const standardLane = () => ({
        results: props.standardResults.map((content): ISmartSearchResult => ({
            key: smartSearchContentKey(content),
            content,
            originalTitle: content.name,
            creatorKey: content.author?.url,
            originalCreatorName: content.author?.name,
            languages: [STANDARD_SMART_SEARCH_SOURCE]
        }))
    });

    const mixedResults$ = createMemo(() => mixSmartSearchResultLanes<IPlatformContent>([
        standardLane(),
        ...(props.session?.variants.map(variant => ({ results: variant.results as ISmartSearchResult[] })) ?? [])
    ], props.compareResults));

    const renderResult = (result: ISmartSearchResult) => {
        const displayTitle = () => props.titleDisplay === "translated" ? result.translatedTitle ?? result.originalTitle : result.originalTitle;
        const displayCreatorName = () => props.translateCreatorNames ? result.translatedCreatorName ?? result.originalCreatorName : undefined;
        return <article class={styles.card}>
            <VideoThumbnailView
                video={result.content as IPlatformVideo}
                title={displayTitle()}
                authorName={displayCreatorName()}
                onClick={() => openVideo(result.content as IPlatformVideo)}
            />
            <Show when={props.titleDisplay === "both" && result.translatedTitle}>
                <div class={styles.translation}>{result.translatedTitle}</div>
            </Show>
            <div class={styles.provenance}>
                <For each={result.languages}>{language => <span class={styles.chip}>{languageLabel(language)}</span>}</For>
            </div>
        </article>;
    };

    return (
        <div class={styles.results}>
            <Show when={props.loading && !props.session}>
                <div class={styles.status}>Searching international sources...</div>
            </Show>
            <Show when={props.session?.error}>
                <div class={styles.error}>{props.session!.error}</div>
            </Show>
            <Show when={props.translatingTitles}>
                <div class={styles.status}>Translating results...</div>
            </Show>
            <Show when={props.resultLayout === "mixed"} fallback={<For each={props.session?.variants}>{variant => (
                <section class={styles.section}>
                    <div class={styles.heading}>{languageLabel(variant.language)}</div>
                    <div class={styles.query}>{variant.query}</div>
                    <Show when={variant.error}>
                        <div class={styles.error}>{variant.error}</div>
                    </Show>
                    <Show when={variant.results.length > 0} fallback={<div class={styles.status}>{props.loading ? "Searching..." : "No results"}</div>}>
                        <div class={styles.grid}>
                            <For each={variant.results}>{renderResult}</For>
                        </div>
                    </Show>
                </section>
            )}</For>}>
                <section class={styles.mixedSection}>
                    <Show when={mixedResults$().length > 0} fallback={<div class={styles.status}>{props.loading ? "Searching..." : "No results"}</div>}>
                        <div class={styles.grid}>
                            <For each={mixedResults$()}>{renderResult}</For>
                        </div>
                    </Show>
                    <For each={props.session?.variants.filter(variant => variant.error)}>{variant => (
                        <div class={styles.error}>{languageLabel(variant.language)}: {variant.error}</div>
                    )}</For>
                </section>
            </Show>
        </div>
    );
};

export default SmartSearchResults;
