import { Component, Show } from "solid-js";
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

    return (
        <Show when={props.visible}>
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
        </Show>
    );
};

export default NextUpOverlay;
