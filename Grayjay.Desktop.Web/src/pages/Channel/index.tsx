import { createResource, type Component, Show, createMemo, createSignal, Switch, Match, createEffect, untrack, onMount, onCleanup } from 'solid-js';
import { createResourceDefault, toHumanNumber } from '../../utility';
import { ChannelBackend } from '../../backend/ChannelBackend';
import { useLocation, useParams, useSearchParams } from '@solidjs/router';
import { Event1 } from "../../utility/Event";
import ContentGrid from '../../components/containers/ContentGrid';
import LoaderContainer from '../../components/basics/loaders/LoaderContainer';
import LoaderGrid from '../../components/basics/loaders/LoaderGrid';
import SkeletonDiv from '../../components/basics/loaders/SkeletonDiv';

import styles from './index.module.css';
import StickyShrinkOnScrollContainer from '../../components/containers/StickyShrinkOnScrollContainer';
import { useShrinkProgress } from '../../contexts/ShrinkProgress';
import { easeOutExpo } from '../../animation';
import ButtonGroup from '../../components/ButtonGroup';
import SubscribeButton from '../../components/buttons/SubscribeButton';

import more from '../../assets/icons/more_horiz_FILL0_wght400_GRAD0_opsz24.svg';
import ic_queue from '../../assets/icons/icon24_queue.svg';
import NavigationBar from '../../components/topbars/NavigationBar';
import SettingsMenu, { Menu, MenuItem, MenuItemButton, MenuSeperator, ShowEvent } from '../../components/menus/Overlays/SettingsMenu';
import ScrollContainer from '../../components/containers/ScrollContainer';
import ic_search from '../../assets/icons/search.svg';
import InputText from '../../components/basics/inputs/InputText';
import { Pager } from '../../backend/models/pagers/Pager';
import { IPlatformContent } from '../../backend/models/content/IPlatformContent';
import { IPlatformVideo } from '../../backend/models/content/IPlatformVideo';
import { ContentType } from '../../backend/models/ContentType';
import Anchor, { AnchorStyle } from '../../utility/Anchor';
import StateGlobal from '../../state/StateGlobal';
import { SubscriptionsBackend } from '../../backend/SubscriptionsBackend';
import { SettingsBackend } from '../../backend/SettingsBackend';
import { HistoryBackend } from '../../backend/HistoryBackend';
import { Menus } from '../../Menus';
import { Portal } from 'solid-js/web';
import UIOverlay from '../../state/UIOverlay';
import { useFocus } from '../../FocusProvider';
import IconButton from '../../components/buttons/IconButton';
import { useVideo } from '../../contexts/VideoProvider';

interface ChannelTopBarInit {
  hideSubscriptionSettings: () => void;
}

interface ChannelTopBarProps {
  authorUrl?: string;
  bannerUrl?: string;
  thumbnailUrl?: string;
  name?: string;
  metadata?: string;
  description?: string;
  activeTab?: string;
  onActiveTabChanged?: (tab: string) => void;
  suggestionsVisible?: boolean;
  onInit?: (init: ChannelTopBarInit) => void;
}

const ChannelTopBar: Component<ChannelTopBarProps> = (props) => {
  const focus = useFocus();
  const video = useVideo();

  let moreElement: HTMLDivElement | undefined;

  const [subscriptionMenu$, setSubscriptionMenu] = createSignal<{
    menu: Menu,
    subscription?: ISubscription,
    subscriptionSettings?: ISubscriptionSettings
  }>({
    menu: { title: "", items: []  }
  });
  const [showSettings$, setShowSettings] = createSignal(false);
  const anchor = new Anchor(null, showSettings$, AnchorStyle.BottomRight);

  const startBingeWatching = async (includeWatched: boolean) => {
    if (!props.authorUrl) return;

    const [pager, settings] = await Promise.all([
      ChannelBackend.channelContentPager(props.authorUrl),
      SettingsBackend.settings(),
    ]);

    const playback = settings?.object?.playback;
    const order: number = playback?.bingeWatchOrder ?? 0;
    const excludeWatched: boolean = playback?.bingeWatchExcludeWatched ?? true;
    const doFilter = !includeWatched && excludeWatched;

    // The channel pager only loads a couple of pages up front. If exclude-watched
    // is enabled, we may need to walk further into the catalog before finding
    // anything unwatched — otherwise the binge starts on items the user has
    // already finished. Cache lookups so each URL is queried only once.
    const TARGET_UNWATCHED = 10;
    const MAX_CHANNEL_PAGES = 10;
    const watchedCache = new Map<string, boolean>();

    const collectFiltered = async (): Promise<IPlatformVideo[]> => {
      const all = (pager.data as IPlatformContent[]).filter(
        (v): v is IPlatformVideo => v?.contentType === ContentType.MEDIA
      );
      if (!doFilter) return all;
      const toQuery = all.filter((v) => v.url && !watchedCache.has(v.url));
      await Promise.all(
        toQuery.map(async (v) => {
          try {
            const pos = await HistoryBackend.getHistoricalPosition(v.url!);
            watchedCache.set(v.url!, pos > 0);
          } catch {
            watchedCache.set(v.url!, false);
          }
        })
      );
      return all.filter((v) => v.url && watchedCache.get(v.url) === false);
    };

    let videos = await collectFiltered();
    let pages = 0;
    while (videos.length < TARGET_UNWATCHED && pager.hasMore && pages < MAX_CHANNEL_PAGES) {
      await pager.nextPage();
      pages++;
      videos = await collectFiltered();
    }

    if (order === 1) videos = [...videos].reverse();

    if (videos.length === 0) {
      const allUnfiltered = (pager.data as IPlatformContent[]).filter(
        (v): v is IPlatformVideo => v?.contentType === ContentType.MEDIA
      );
      if (allUnfiltered.length === 0) return;
      videos = order === 1 ? [...allUnfiltered].reverse() : allUnfiltered;
      StateGlobal.toast({ text: 'All videos already watched — starting binge from scratch' });
    }

    video?.actions.startBinge(props.authorUrl, videos, pager);
  };

  const showChannelMenu = async (el: HTMLElement, subscription: ISubscription | undefined) => {
    anchor.setElement(el);

    const bingeItems = [
      new MenuSeperator(),
      new MenuItemButton("Binge watch", ic_queue, undefined, () => startBingeWatching(false)),
      new MenuItemButton("Binge from scratch (include watched)", ic_queue, undefined, () => startBingeWatching(true))
    ];

    if (!subscription) {
      setSubscriptionMenu({ menu: { title: "", items: [...bingeItems.slice(1)] } });
      setShowSettings(true);
      return;
    }

    const sourceState = StateGlobal.getSourceState(subscription.channel.id.pluginID);
    const [subscriptionSettings, groups] = await Promise.all([
      SubscriptionsBackend.subscriptionSettings(subscription.channel.url),
      SubscriptionsBackend.subscriptionGroups().catch(() => [] as ISubscriptionGroup[])
    ]);
    anchor.setElement(el);
    const base = Menus.getSubscriptionMenu(subscription, subscriptionSettings, sourceState, groups);
    setSubscriptionMenu({
      ...base,
      menu: { title: "", items: [...base.menu.items, ...bingeItems] }
    });
    setShowSettings(true);
  };

  const hideSubscriptionSettings = () => {
    const subscription = subscriptionMenu$().subscription;
    if (!subscription) {
      setShowSettings(false);
      return;
    }

    const subscriptionSettings = subscriptionMenu$().subscriptionSettings;
    if (!subscriptionSettings) {
      setShowSettings(false);
      return;
    }

    SubscriptionsBackend.updateSubscriptionSettings(subscription.channel.url, subscriptionSettings);
    setShowSettings(false);
  };

  const progress = useShrinkProgress();
  const p = createMemo(() => easeOutExpo(progress()));
  const [subscription$, subscriptionResource] = createResourceDefault(props.authorUrl, async (u) => await SubscriptionsBackend.subscription(u));

  props.onInit({
    hideSubscriptionSettings
  });

  return (
    <div class={styles.containerTopBar}>
      <div class={styles.containerTopBarImage} style={{opacity: 1 - p()}}>
        <div class={styles.containerTopBarGradient}></div>
        <Show when={props.bannerUrl && props.bannerUrl.length}>
          <img
            src={props.bannerUrl} 
            alt="Channel banner"
          />
        </Show>
      </div>
      <div class={styles.containerTopBarControls}>
        <NavigationBar id="" suggestionsVisible={props.suggestionsVisible} />
        <div style="flex-grow: 1"></div>
        <div class={styles.containerActions} style={{opacity: 1 - p()}}>
          <div class={styles.containerCreator}>
            <Show when={props.thumbnailUrl && props.thumbnailUrl.length}>
              <img class={styles.imageCreator} src={props.thumbnailUrl} referrerPolicy='no-referrer' />
            </Show>
            <div class={styles.creatorName}>{props.name}</div>
            <div class={styles.creatorMetadata}>{props.metadata}</div>
            <Show when={props.description}>
              <div class={styles.creatorDescription}>{props.description}</div>
            </Show>
          </div>
          <div style="flex-grow: 1"></div>
          <Show when={!focus?.isControllerMode()}>
            <div class={styles.containerChannelButtons}>
              <IconButton
                ref={moreElement}
                icon={more}
                variant="ghost"
                shape="rounded"
                width="42px"
                height="42px"
                iconInset="12px"
                onClick={(ev) =>
                  showChannelMenu(ev.target as HTMLElement, subscription$())
                }
              />
              <SubscribeButton small={true} author={props.authorUrl} style={{"width": "110px"}} onIsSubscribedChanged={() => subscriptionResource.refetch()} focusable={true} />
            </div>
          </Show>
        </div>
        <Show when={focus?.isControllerMode()}>
          <div class={styles.containerChannelButtons}>
            <IconButton
              ref={moreElement}
              icon={more}
              variant="ghost"
              shape="rounded"
              width="42px"
              height="42px"
              iconInset="12px"
              onClick={(ev) =>
                showChannelMenu(ev.target as HTMLElement, subscription$())
              }
              focusableOpts={{
                onPress: (el) => showChannelMenu(el, subscription$())
              }}
            />
            <SubscribeButton small={true} author={props.authorUrl} style={{"width": "300px"}} onIsSubscribedChanged={() => subscriptionResource.refetch()} focusable={true} />
          </div>
        </Show>
        <div class={styles.containerTabButtons}>
          <ButtonGroup defaultSelectedItem="Videos" items={["Videos"/*, "Channels", "Support"*/, "About"]}
          style={{opacity: 1 - p(), "flex-shrink": 0}} onItemChanged={(item) => props.onActiveTabChanged?.(item)} focusableOpts={{}} />
        </div>
      </div>
      <Portal>
        <SettingsMenu menu={subscriptionMenu$().menu} anchor={anchor} show={showSettings$()} onHide={hideSubscriptionSettings} />
      </Portal>
    </div>
  );
};

const ChannelPage: Component = () => {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const focus = useFocus();

  console.log(location)
  console.log(params);

  const [error$, setError] = createSignal<any>(undefined);
  const [suggestionsVisible$, setSuggestionsVisible] = createSignal(true);


  const authorSummary$ = createMemo(() => {
    const author = (location.state as any)?.author;
    console.log("state changed", author);
    return author;
  });

  const [canSearchChannel$] = createResourceDefault(async () => [], async () => params.url ? await ChannelBackend.CanSearchChannel(params.url) : false, undefined, false);

  const updatePager = async (query: string, url?: string) => {
    if (!url) {
      setChannelPager(undefined);
      return;
    }

    setChannelPager(undefined);

    if (!query || query.length < 1) {
      setChannelPager(await ChannelBackend.channelContentPager(url));
    } else {
      console.log("Searching for " + query);
      setChannelPager(await ChannelBackend.channelContentSearchPager(url, query));
    }
  };

  
  const [channelPager$, setChannelPager] = createSignal<Pager<IPlatformContent>>();
  const [activeTab$, setActiveTab] = createSignal("Videos");
  
  const [query$, setQuery] = createSignal<string>("");
  
  const [channel$, channelResource] = createResourceDefault(()=>params.url, async (u) => {
    console.log("get channel", params.url);

    if (!u) {
      return undefined;
    }

    updatePager(untrack(query$), u);

    try {
      return await UIOverlay.catchDialogExceptions(async ()=>{
        const reqUrl = u;
        const result = await ChannelBackend.channelLoad(u);
        if(reqUrl == u && u != result.url) {
          setParams({
            ...params,
            url: result.url
          })
        }
        setError(undefined);
        return result;
      }, null, ()=>{
        channelResource.refetch();
      });
    }
    catch(ex) {
      setError(ex);
      return undefined;
    }
  });
  //createEffect(() => updatePager(untrack(query$), channel$()));
  
  const isReady$ = createMemo(()=>params?.url && (channel$() && channel$()?.url == params?.url || authorSummary$()))
  const isReadyContents$ = createMemo(()=>!!(params?.url && channelPager$()))

  let scrollContainerRef: HTMLDivElement | undefined;
  let topBarInit: ChannelTopBarInit | undefined;

  const handleScroll = () => {
    topBarInit?.hideSubscriptionSettings();
  };

  onMount(() => {
    scrollContainerRef?.addEventListener('scroll', handleScroll);
  });

  onCleanup(() => {
    scrollContainerRef?.removeEventListener('scroll', handleScroll);
  });

  return (
    <div class={styles.container}>
      <LoaderContainer isLoading={!isReady$()} loadingText={"Loading Channel"} loadingSubText={params.url} loader={
        <div>
          <SkeletonDiv style={{height: "540px"}} />
          <Show when={error$()}>
            <div>
              <div>
                Failed to load channel
              </div>
              <div>
                {error$()}
              </div>
            </div>
          </Show>
          <Show when={!error$()}>
            <LoaderGrid itemCount={18} />
          </Show>
        </div>
      }>
          <ScrollContainer ref={scrollContainerRef}>
            <StickyShrinkOnScrollContainer outerContainerRef={scrollContainerRef}
                minimumHeight={focus?.lastInputSource() === 'pointer' ? 136 : 540} 
                maximumHeight={540}
                heightChanged={(h) => setSuggestionsVisible(h > 500)}>
              <ChannelTopBar bannerUrl={channel$()?.banner ?? authorSummary$()?.banner} 
                thumbnailUrl={channel$()?.thumbnail ?? authorSummary$()?.thumbnail}
                metadata={(((channel$()?.subscribers ?? 0) > 0) ? (toHumanNumber(channel$()?.subscribers) + " subscribers") : "")}
                name={channel$()?.name ?? authorSummary$()?.name}
                authorUrl={channel$()?.url ?? authorSummary$()?.url}
                activeTab={activeTab$()}
                onActiveTabChanged={(tab) => setActiveTab(tab)}
                suggestionsVisible={suggestionsVisible$()}
                onInit={(init) => {
                  topBarInit = init;
                }} />
            </StickyShrinkOnScrollContainer>
            <div>
              <Show when={activeTab$() === "Videos"}>
                <Show when={canSearchChannel$()}>
                <InputText icon={ic_search} placeholder={"Search channel"}
                  value={query$()}
                  showClearButton={true}
                  onTextChanged={(v) => setQuery(v)}
                  style={{
                    "margin-left": "24px",
                    "margin-right": "24px",
                    "margin-bottom": "24px",
                    "width": "calc(100% - 48px)"
                  }}
                  onSubmit={() => {
                    console.log("Channel Search Submit");
                    updatePager(query$(), channel$()?.url ?? params.url)
                    }} 
                  focusable={true} />
                </Show>
                      
                <Show when={error$()}>
                  <div style="text-align: center;">
                    <div style="color: #555">
                      Failed to load channel
                    </div>
                    <div style="color: #AA0000">
                      {error$()?.message ?? error$()}
                    </div>
                  </div>
                </Show>
                <Show when={!error$()}>
                  <LoaderContainer isLoading={!isReadyContents$()} loader={
                    <div>
                      <LoaderGrid itemCount={18} />
                    </div>
                  }>
                   <ContentGrid pager={channelPager$()} outerContainerRef={scrollContainerRef} />
                  </LoaderContainer>
                </Show>
              </Show>
              <Show when={activeTab$() === "About"}>
                <div class={styles.aboutTab}>
                  <div style="position: relative">
                    <img class={styles.aboutLogo} src={channel$()?.thumbnail} />
                    <div class={styles.aboutTextContainer}>
                      <div class={styles.aboutTitle}>
                        {channel$()?.name}
                      </div>
                      <Show when={channel$()?.subscribers && channel$()!.subscribers > 0}>
                        <div class={styles.aboutMeta}>
                          {toHumanNumber(channel$()?.subscribers)} subscribers
                        </div>
                      </Show>
                    </div>
                  </div>
                  <Show when={channel$()?.description}>
                    <div class={styles.aboutDescription}>
                      {channel$()?.description}
                    </div>
                  </Show>
                </div>
              </Show>
            </div>
          </ScrollContainer>
      </LoaderContainer>
    </div>
  );
};

export default ChannelPage;