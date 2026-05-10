import { Component, JSX, Show, createMemo, createSignal, onCleanup } from 'solid-js'
import { Portal } from 'solid-js/web'

import styles from './index.module.css';
import IconButton from '../../buttons/IconButton';
import more from '../../../assets/icons/more_horiz_FILL0_wght400_GRAD0_opsz24.svg';
import addToQueueIcon from '../../../assets/icons/icon_add_to_queue.svg';
import { dateFromAny, toHumanNowDiffString, toHumanNumber, toHumanTime } from '../../../utility';
import { DateTime } from 'luxon';
import { useNavigate } from '@solidjs/router';
import StateGlobal from '../../../state/StateGlobal';
import { IPlatformVideo } from '../../../backend/models/content/IPlatformVideo';
import AnimatedImage from '../../basics/AnimatedImage';
import { FocusableOptions } from '../../../nav';
import { focusable } from '../../../focusable';import { useFocus } from '../../../FocusProvider';
 void focusable;

interface VideoProps {
  video?: IPlatformVideo;
  onClick: () => void;
  onSettings?: (element: HTMLDivElement, content: IPlatformVideo) => void;
  onAddtoQueue?: (element: HTMLDivElement, content: IPlatformVideo) => void;
  style?: JSX.CSSProperties;
  imageStyle?: JSX.CSSProperties;
  useCache?: boolean;
  focusableOpts?: FocusableOptions;
  hideAddToQueue?: boolean;
  settingsOnHover?: boolean;
  showHoverCard?: boolean;
}

function formatRemaining(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.ceil((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m left`;
  return `${Math.max(1, m)}m left`;
}

const VideoThumbnailView: Component<VideoProps> = (props) => {
  const focus = useFocus();

  var bestThumbnail$ = createMemo(()=>{
    return (props.video?.thumbnails?.sources?.length ?? 0 > 0) ? props.video?.thumbnails.sources[Math.max(0, props.video.thumbnails.sources.length - 1)] : null;
  })
  var progress$ = createMemo(()=>{
    let videoAny = props.video as any;
    return (videoAny?.metadata?.position && props.video?.duration && props.video.duration > 0) ? (videoAny?.metadata?.position / props.video!.duration) : 0;
  })

  const remaining$ = createMemo(() => {
    const videoAny = props.video as any;
    const pos = videoAny?.metadata?.position;
    const dur = props.video?.duration;
    if (!pos || !dur || dur <= 0) return null;
    return Math.max(0, dur - pos);
  });

  // Hover card
  let containerRef: HTMLDivElement | undefined;
  const [cardPos, setCardPos] = createSignal<{ x: number; y: number } | null>(null);
  const [cardVisible, setCardVisible] = createSignal(false);
  let hoverTimer: ReturnType<typeof setTimeout> | undefined;

  const showCard = () => {
    if (!containerRef || !props.showHoverCard) return;
    const rect = containerRef.getBoundingClientRect();
    const cardW = 280;
    const cardH = 220;
    const x = Math.max(8, Math.min(rect.left + rect.width / 2 - cardW / 2, window.innerWidth - cardW - 8));
    const above = rect.top > cardH + 16;
    const y = above ? rect.top - cardH - 8 : rect.bottom + 8;
    setCardPos({ x, y });
    setTimeout(() => setCardVisible(true), 10);
  };

  const onMouseEnter = () => {
    if (!props.showHoverCard) return;
    hoverTimer = setTimeout(showCard, 450);
  };

  const onMouseLeave = () => {
    clearTimeout(hoverTimer);
    setCardVisible(false);
    setCardPos(null);
  };

  onCleanup(() => clearTimeout(hoverTimer));

  const navigate = useNavigate();
  function onClickAuthor() {
      const author = props.video?.author;
      if(author)
        navigate("/web/channel?url=" + encodeURIComponent(author.url), { state: { author } });
  }

  const pluginIconUrl = createMemo(() => {
    const plugin = StateGlobal.getSourceConfig(props.video?.id?.pluginID);
    return plugin?.absoluteIconUrl;
  });

  let refMoreButton: HTMLDivElement | undefined;
  let refAddToQueueButton: HTMLDivElement | undefined;

  function startDrag(ev: any){
    ev.dataTransfer?.setData("text/uri-list", props.video?.url ?? ""); 
    console.log(props.video?.url)
  }

  function onClicked(ev: any){
    if(props.onClick)
      props.onClick();
  }

  function openMoreOverlay() {
    props.onSettings?.(refMoreButton!, props.video!)
  }

  const showAuthorThumbnail$ = createMemo(() => props.video?.author?.thumbnail && props.video?.author.thumbnail.length);
  return (
    <>
    <div class={styles.container} style={props.style} use:focusable={props.focusableOpts} ref={containerRef} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        <div class={styles.videoThumbnail} 
          style={{... props.imageStyle}} 
          draggable={true}
          onDragStart={startDrag}
          onClick={onClicked}>
          
          <AnimatedImage class={styles.image} src={(!props.useCache) ? bestThumbnail$()?.url?.replace("u0026", "&") : "/Images/CachePassthrough?url=" + encodeURIComponent(bestThumbnail$()?.url?.replace("u0026", "&") ?? "")} referrerPolicy='no-referrer' />

          <Show when={pluginIconUrl()}>
            <img src={pluginIconUrl()} class={styles.sourceIcon} />
          </Show>
          <Show when={props.video?.isLive && dateFromAny(props.video?.dateTime, DateTime.max())! <= DateTime.now()}>
            <div class={styles.isLive}>LIVE</div>
          </Show>
          <Show when={props.video?.isLive && dateFromAny(props.video?.dateTime, DateTime.min())! > DateTime.now()}>
            <div class={styles.isPlanned}>PLANNED</div>
          </Show>
          <Show when={!props.video?.isLive}>
            <Show when={remaining$() !== null} fallback={<div class={styles.duration}>{toHumanTime(props.video?.duration ?? 0)}</div>}>
              <div class={styles.durationRemaining}>{formatRemaining(remaining$()!)}</div>
            </Show>
          </Show>
          <Show when={props.settingsOnHover && props.onSettings && focus?.isControllerMode() !== true}>
            <div class={styles.settingsOverlay}>
              <IconButton icon={more} ref={refMoreButton} onClick={(e: MouseEvent) => { e.stopPropagation(); openMoreOverlay(); }} />
            </div>
          </Show>
            <div class={styles.progressBar}>
              <div class={styles.progressBarProgress} style={{width: (progress$() * 100) + "%"}}>

              </div>
            </div>
        </div>
        <div class={styles.title} onClick={props.onClick} onDragStart={startDrag} draggable={true}>{props.video?.name}</div>
        <div class={styles.bottomRow}>
            <Show when={showAuthorThumbnail$()}>
              <AnimatedImage src={props.video?.author.thumbnail} class={styles.authorThumbnail} alt="author thumbnail" onClick={onClickAuthor} referrerPolicy='no-referrer' />
            </Show>
            <div class={styles.authorColumn} style={{
              "margin-left": showAuthorThumbnail$() ? "8px" : undefined
            }}>
                <div class={styles.authorName} onClick={onClickAuthor}>{props.video?.author?.name ?? "Unknown"}</div>
                <Show when={props.video}>
                    <div class={styles.metadata}><Show when={(props.video?.viewCount ?? 0) > 0}>{toHumanNumber(props.video?.viewCount)} views • </Show>{toHumanNowDiffString(props.video?.dateTime)}</div>
                </Show>
            </div>
            

            <Show when={!props.hideAddToQueue && props.onAddtoQueue && focus?.isControllerMode() !== true}>
              <IconButton icon={addToQueueIcon}
                style={{"margin-right": "7px", "margin-top": "4px"}}
                iconPadding='4px'
                ref={refAddToQueueButton} onClick={() => props.onAddtoQueue?.(refAddToQueueButton!, props.video!)} />
            </Show>

            <Show when={!props.settingsOnHover && props.onSettings && focus?.isControllerMode() !== true} fallback={<div class="menu-anchor"></div>}>
              <IconButton icon={more} ref={refMoreButton} onClick={() => openMoreOverlay()} />
            </Show>
        </div>
    </div>

    <Show when={cardPos()}>
      <Portal>
        <div
          style={{
            position: "fixed",
            left: `${cardPos()!.x}px`,
            top: `${cardPos()!.y}px`,
            width: "280px",
            background: "#1e1e20",
            "border-radius": "10px",
            "box-shadow": "0 8px 32px rgba(0,0,0,0.7)",
            "z-index": "99999",
            overflow: "hidden",
            opacity: cardVisible() ? 1 : 0,
            transform: cardVisible() ? "scale(1) translateY(0)" : "scale(0.95) translateY(4px)",
            transition: "opacity 180ms ease, transform 180ms ease",
            "pointer-events": "none",
          }}
        >
          <img
            src={bestThumbnail$()?.url?.replace("u0026", "&")}
            style={{ width: "100%", height: "auto", display: "block" }}
            referrerpolicy="no-referrer"
          />
          <div style={{ padding: "10px 12px 12px" }}>
            <div style={{
              "font-size": "13px",
              "font-weight": "600",
              color: "#fff",
              "margin-bottom": "4px",
              "line-height": "1.3",
              display: "-webkit-box",
              "-webkit-line-clamp": "2",
              "-webkit-box-orient": "vertical",
              overflow: "hidden",
            }}>
              {props.video?.name}
            </div>
            <div style={{ "font-size": "11px", color: "#aaa", "margin-bottom": "10px" }}>
              {props.video?.author?.name} • {toHumanTime(props.video?.duration ?? 0)}
            </div>
            <div
              style={{
                background: "#fff",
                color: "#000",
                "border-radius": "4px",
                padding: "5px 12px",
                "font-size": "12px",
                "font-weight": "600",
                cursor: "pointer",
                display: "inline-flex",
                "align-items": "center",
                gap: "5px",
                "pointer-events": "all",
              }}
              onClick={(e) => { e.stopPropagation(); props.onClick(); setCardPos(null); }}
            >
              ▶ Play
            </div>
          </div>
        </div>
      </Portal>
    </Show>
    </>
  );
};

export default VideoThumbnailView;