import { Component, For, Show } from "solid-js";

import { IPlatformVideo } from "../../../backend/models/content/IPlatformVideo";
import { ISmartSearchSession } from "../../../backend/SmartSearchBackend";
import { SmartSearchTitleDisplay } from "../../../state/StateSmartSearch";
import VideoThumbnailView from "../../content/VideoThumbnailView";
import { useVideo } from "../../../contexts/VideoProvider";
import styles from "./index.module.css";

interface SmartSearchResultsProps {
    loading: boolean;
    translatingTitles: boolean;
    titleDisplay: SmartSearchTitleDisplay;
    translateCreatorNames: boolean;
    session?: ISmartSearchSession;
}

const SmartSearchResults: Component<SmartSearchResultsProps> = (props) => {
    const video = useVideo();

    const openVideo = (content: IPlatformVideo) => {
        const url = content.backendUrl ?? content.url;
        if (url)
            video?.actions.openVideo(content);
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
            <For each={props.session?.variants}>{(variant) => (
                <section class={styles.section}>
                    <div class={styles.heading}>{variant.language}</div>
                    <div class={styles.query}>{variant.query}</div>
                    <Show when={variant.error}>
                        <div class={styles.error}>{variant.error}</div>
                    </Show>
                    <Show when={variant.results.length > 0} fallback={<div class={styles.status}>{props.loading ? "Searching..." : "No results"}</div>}>
                        <div class={styles.grid}>
                            <For each={variant.results}>{(result) => {
                                const displayTitle = () => props.titleDisplay === "translated" ? result.translatedTitle ?? result.originalTitle : result.originalTitle;
                                const displayCreatorName = () => props.translateCreatorNames ? result.translatedCreatorName ?? result.originalCreatorName : undefined;
                                return <article class={styles.card}>
                                    <VideoThumbnailView
                                        video={result.content}
                                        title={displayTitle()}
                                        authorName={displayCreatorName()}
                                        onClick={() => openVideo(result.content as IPlatformVideo)}
                                    />
                                    <Show when={props.titleDisplay === "both" && result.translatedTitle}>
                                        <div class={styles.translation}>{result.translatedTitle}</div>
                                    </Show>
                                    <div class={styles.languages}>{result.languages.join(" · ")}</div>
                                </article>
                            }}</For>
                        </div>
                    </Show>
                </section>
            )}</For>
        </div>
    );
};

export default SmartSearchResults;
