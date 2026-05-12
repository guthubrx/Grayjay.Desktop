import { Component, Show, createSignal, onCleanup, onMount } from "solid-js";
import { Portal } from "solid-js/web";
import { IPlatformVideo } from "../../../backend/models/content/IPlatformVideo";
import { getBestThumbnail } from "../../../utility";
import styles from "./index.module.css";

interface NextUpOverlayProps {
    visible: boolean;
    timeLeft: number;
    nextVideo: IPlatformVideo;
    onCancel: () => void;
    onPlayNow: () => void;
}

const NextUpOverlay: Component<NextUpOverlayProps> = (props) => {
    const thumbnailUrl = () => getBestThumbnail(props.nextVideo.thumbnails)?.url ?? "";
    const countdown = () => Math.ceil(props.timeLeft);

    // Portal target follows the fullscreen element so the overlay stays visible
    // both in browser fullscreen and in normal/maximized states.
    const [mount, setMount] = createSignal<HTMLElement>(document.body);
    const onFullscreenChange = () => {
        setMount((document.fullscreenElement as HTMLElement | null) ?? document.body);
    };
    onMount(() => document.addEventListener("fullscreenchange", onFullscreenChange));
    onCleanup(() => document.removeEventListener("fullscreenchange", onFullscreenChange));

    return (
        <Show when={props.visible}>
            <Portal mount={mount()}>
                <div class={styles.overlay}>
                    <div class={styles.body}>
                        <Show when={thumbnailUrl()}>
                            <img class={styles.thumbnail} src={thumbnailUrl()} alt="" />
                        </Show>
                        <div class={styles.info}>
                            <div class={styles.label}>Next up in {countdown()}s</div>
                            <div class={styles.title}>{props.nextVideo.name}</div>
                            <div class={styles.channel}>{props.nextVideo.author?.name}</div>
                        </div>
                    </div>
                    <div class={styles.actions}>
                        <button class={styles.btnCancel} onClick={props.onCancel}>Cancel</button>
                        <button class={styles.btnPlay} onClick={props.onPlayNow}>Play now</button>
                    </div>
                </div>
            </Portal>
        </Show>
    );
};

export default NextUpOverlay;
