import { createResource, type Component, Show, onMount, onCleanup } from 'solid-js';

import styles from './index.module.css';
import { HistoryBackend } from '../../backend/HistoryBackend';
import { WatchLaterBackend } from '../../backend/WatchLaterBackend';
import NavigationBar from '../../components/topbars/NavigationBar';
import ScrollContainer from '../../components/containers/ScrollContainer';
import StateGlobal from '../../state/StateGlobal';
import IconButton from '../../components/buttons/IconButton';
import { getKeybinding } from '../../state/StateKeybindings';
import { useNavigate } from '@solidjs/router';
import EmptyContentView from '../../components/EmptyContentView';
import HomeCarousel from '../../components/containers/HomeCarousel';
import VideoThumbnailView from '../../components/content/VideoThumbnailView';
import { IPlatformVideo } from '../../backend/models/content/IPlatformVideo';
import { IHistoryVideo } from '../../backend/models/content/IHistoryVideo';
import { useVideo } from '../../contexts/VideoProvider';
import { setHomeStyle } from '../../state/HomeStyleState';

import iconRefresh from '../../assets/icons/icon_reload_temp.svg';
import iconHome from '../../assets/icons/icon_nav_home.svg';
import iconSources from '../../assets/icons/ic_circles.svg';

const THUMB_STYLE = { width: '280px', 'flex-shrink': '0' };
const MAX_CAROUSEL_ITEMS = 20;
const MIN_WATCH_POSITION = 30;

const HomeClassicPage: Component = () => {
    const homePager = StateGlobal.home$;
    const video = useVideo();
    const nav = useNavigate();

    const lastHomeMillis = Math.abs(StateGlobal.lastHomeTime$()?.diffNow().toMillis() ?? 0);
    if (lastHomeMillis > 2 * 60 * 1000) {
        StateGlobal.reloadHome();
    }

    const onKeyDown = (e: KeyboardEvent) => {
        const t = e.target as HTMLElement | null;
        if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.isContentEditable) return;
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        if (e.key === getKeybinding('reload')) {
            StateGlobal.reloadHome();
            e.preventDefault();
        }
    };
    onMount(() => window.addEventListener('keydown', onKeyDown));
    onCleanup(() => window.removeEventListener('keydown', onKeyDown));

    const [historyItems] = createResource(async () => {
        try {
            const pager = await HistoryBackend.historyPager();
            return pager.data
                .filter((h: IHistoryVideo) => h.position > MIN_WATCH_POSITION)
                .slice(0, MAX_CAROUSEL_ITEMS);
        } catch {
            return [] as IHistoryVideo[];
        }
    });

    const [watchLaterItems] = createResource(async () => {
        try { return await WatchLaterBackend.getAll(); }
        catch { return [] as IPlatformVideo[]; }
    });

    function openVideo(v: IPlatformVideo) {
        video?.actions.openVideo(v);
    }

    const recommendedItems = () => {
        const data = homePager()?.data;
        return data && data.length > 0 ? data as IPlatformVideo[] : [];
    };

    function switchToNetflix() {
        setHomeStyle('netflix');
        nav('/web/home', { replace: true });
    }

    return (
        <div class={styles.container}>
            <NavigationBar isRoot={true} childrenAfter={
                <div style={{ display: 'flex', gap: '8px', 'align-items': 'center', 'margin-left': '16px' }}>
                    <IconButton
                        icon={iconRefresh}
                        variant="none"
                        shape="circle"
                        width="30px"
                        height="30px"
                        iconInset="0px"
                        onClick={() => StateGlobal.reloadHome()}
                        focusableOpts={{ groupId: 'nav-bar', groupIndices: [1], groupType: 'horizontal', onPress: () => StateGlobal.reloadHome() }}
                    />
                    <button
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', 'border-radius': '6px', color: 'rgba(255,255,255,0.7)', padding: '5px 12px', 'font-size': '12px', cursor: 'pointer', 'white-space': 'nowrap' }}
                        onClick={switchToNetflix}
                        title="Switch to Netflix-style home"
                    >
                        ✦ Discover
                    </button>
                </div>
            } />

            <Show when={homePager.state === 'ready'}>
                <Show when={homePager() && homePager()!.data.length > 0} fallback={
                    <EmptyContentView icon={iconHome} title="No home results" description="Install, configure, or enable more sources" actions={[{ icon: iconSources, title: 'Go to Sources', action: () => nav('/web/sources') }]} />
                }>
                    <ScrollContainer>
                        <Show when={(historyItems()?.length ?? 0) > 0}>
                            <HomeCarousel
                                title="Continue watching"
                                items={historyItems()!}
                                builder={(_, item: IHistoryVideo) => (
                                    <VideoThumbnailView
                                        style={THUMB_STYLE}
                                        video={{ ...item.video, metadata: { position: item.position } } as any}
                                        onClick={() => openVideo(item.video)}
                                    />
                                )}
                            />
                        </Show>

                        <Show when={(watchLaterItems()?.length ?? 0) > 0}>
                            <HomeCarousel
                                title="Watch later"
                                items={watchLaterItems()!}
                                builder={(_, item: IPlatformVideo) => (
                                    <VideoThumbnailView
                                        style={THUMB_STYLE}
                                        video={item}
                                        onClick={() => openVideo(item)}
                                    />
                                )}
                            />
                        </Show>

                        <Show when={recommendedItems().length > 0}>
                            <HomeCarousel
                                title="Recommended"
                                items={recommendedItems()}
                                builder={(_, item: IPlatformVideo) => (
                                    <VideoThumbnailView
                                        style={THUMB_STYLE}
                                        video={item}
                                        onClick={() => openVideo(item)}
                                    />
                                )}
                            />
                        </Show>
                    </ScrollContainer>
                </Show>
            </Show>
        </div>
    );
};

export default HomeClassicPage;
