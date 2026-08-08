import { createResource, type Component, Show, createEffect, createSignal, createMemo, For, untrack, batch, on, onCleanup } from 'solid-js';

import styles from './index.module.css';
import ContentGrid from '../../components/containers/ContentGrid';
import { SearchBackend } from '../../backend/SearchBackend';
import { useNavigate, useSearchParams } from '@solidjs/router';
import NavigationBar from '../../components/topbars/NavigationBar';
import { ContentType } from '../../backend/models/ContentType';
import ToggleItemButtonGroup, { ToggleButtonGroupItem } from '../../components/ToggleItemButtonGroup';
import iconPlaylist from '../../assets/icons/icon_nav_playlists.svg';
import iconCreators from '../../assets/icons/icon_nav_creators.svg';
import iconFilters from '../../assets/icons/iconfilters.svg';
import iconVideos from '../../assets/icons/videos.svg';
import CustomButton from '../../components/buttons/CustomButton';
import { Portal } from 'solid-js/web';
import IconButton from '../../components/buttons/IconButton';
import iconClose from '../../assets/icons/icon24_close.svg';
import ScrollContainer from '../../components/containers/ScrollContainer';
import ToggleItemButtonGroupMulti from '../../components/ToggleItemButtonGroupMulti';
import ToggleItemBigButtonGroupMulti, { ToggleBigButtonGroupItemMulti } from '../../components/ToggleItemBigButtonGroupMulti';
import StateGlobal from '../../state/StateGlobal';
import { focusScope } from '../../focusScope'; void focusScope;
import { focusable } from "../../focusable"; void focusable;
import { createResourceDefault } from '../../utility';
import { IPlatformContent } from '../../backend/models/content/IPlatformContent';
import { ISmartSearchResult, ISmartSearchSession, SmartSearchBackend } from '../../backend/SmartSearchBackend';
import {
  beginSmartSearch,
  clearSmartSearch,
  hasTranslatorCommand,
  hideSmartSearch,
  isSmartSearchForQuery,
  setSmartSearchLoading,
  setSmartSearchSession,
  setSmartSearchTranslatingTitles,
  setTranslatorCommand,
  showSmartSearch,
  smartSearchAutoStart$,
  smartSearchLanguages$,
  smartSearchLoading$,
  smartSearchResultLayout$,
  smartSearchSession$,
  smartSearchSettingsReady$,
  smartSearchTitleDisplay$,
  smartSearchTranslatingTitles$,
  smartSearchTranslateCreatorNames$,
  smartSearchVisible$,
  translatorCommand$
} from '../../state/StateSmartSearch';
import UIOverlay from '../../state/UIOverlay';
import SmartSearchResults from '../../components/search/SmartSearchResults';
import {
  searchPreferences$,
  searchPreferencesReady$,
  setSearchPreferences,
  type SearchSortEntry
} from '../../state/StateSearchPreferences';

type SortEntry = SearchSortEntry;

const SORT_OPTIONS = [
  { text: "Date",     value: "date",     defaultDir: 'desc' as const },
  { text: "Views",    value: "views",    defaultDir: 'desc' as const },
  { text: "Duration", value: "duration", defaultDir: 'desc' as const },
  { text: "Name",     value: "name",     defaultDir: 'asc'  as const },
];

const numericCompare = (av: number | undefined, bv: number | undefined): number => {
  const aMissing = av === undefined || av === null || Number.isNaN(av);
  const bMissing = bv === undefined || bv === null || Number.isNaN(bv);
  if (aMissing && bMissing) return 0;
  if (aMissing) return Number.POSITIVE_INFINITY;
  if (bMissing) return Number.NEGATIVE_INFINITY;
  return (av as number) - (bv as number);
};

const BASE_COMPARATORS: Record<string, (a: IPlatformContent, b: IPlatformContent) => number> = {
  date:     (a, b) => numericCompare(a.dateTime ? new Date(a.dateTime).getTime() : undefined, b.dateTime ? new Date(b.dateTime).getTime() : undefined),
  views:    (a, b) => numericCompare((a as any).viewCount, (b as any).viewCount),
  duration: (a, b) => numericCompare((a as any).duration, (b as any).duration),
  name:     (a, b) => a.name.localeCompare(b.name),
};

const compareClientSort = (a: IPlatformContent, b: IPlatformContent, sort: SortEntry[]) => {
  for (const { field, dir } of sort) {
    const cmp = BASE_COMPARATORS[field](a, b);
    if (cmp === 0) continue;
    if (cmp === Number.POSITIVE_INFINITY) return 1;
    if (cmp === Number.NEGATIVE_INFINITY) return -1;
    return dir === 'asc' ? cmp : -cmp;
  }
  return 0;
};

const SMART_SEARCH_POLL_INTERVAL_MS = 750;
const SMART_SEARCH_POLL_ATTEMPTS = 16;
const SMART_SEARCH_TITLES_PER_REQUEST = 6;

const wait = (duration: number) => new Promise<void>(resolve => window.setTimeout(resolve, duration));

const hasSmartSearchResults = (session: ISmartSearchSession) => session.variants.some(variant => variant.results.length > 0);

const sortSmartSearchSession = (session: ISmartSearchSession | undefined, sort: SortEntry[]) => {
  if (!session || sort.length === 0)
    return session;
  return {
    ...session,
    variants: session.variants.map(variant => ({
      ...variant,
      results: [...variant.results].sort((first, second) => compareClientSort(first.content as IPlatformContent, second.content as IPlatformContent, sort))
    }))
  };
};

const sameStringArray = (first: string[], second: string[]) => first.length === second.length && first.every((value, index) => value === second[index]);

const sameSmartSearchResult = (first: ISmartSearchResult, second: ISmartSearchResult) =>
  first.key === second.key &&
  first.originalTitle === second.originalTitle &&
  first.translatedTitle === second.translatedTitle &&
  first.creatorKey === second.creatorKey &&
  first.originalCreatorName === second.originalCreatorName &&
  first.translatedCreatorName === second.translatedCreatorName &&
  sameStringArray(first.languages, second.languages);

const reconcileSmartSearchSession = (current: ISmartSearchSession | undefined, next: ISmartSearchSession) => {
  if (!current || current.sessionId !== next.sessionId)
    return next;

  let changed = current.error !== next.error || current.variants.length !== next.variants.length;
  const variants = next.variants.map((variant, index) => {
    const previous = current.variants[index];
    if (!previous || previous.language !== variant.language || previous.query !== variant.query || previous.status !== variant.status || previous.error !== variant.error || previous.results.length !== variant.results.length) {
      changed = true;
      return variant;
    }

    let variantChanged = false;
    const results = variant.results.map((result, resultIndex) => {
      const previousResult = previous.results[resultIndex];
      if (previousResult && sameSmartSearchResult(previousResult, result))
        return previousResult;
      variantChanged = true;
      return result;
    });
    if (!variantChanged)
      return previous;

    changed = true;
    return { ...variant, results };
  });

  return changed ? { ...next, variants } : current;
};

const SearchPage: Component = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [filtersDialogVisible$, setFiltersDialogVisible] = createSignal(false);
  const [query$, setQuery] = createSignal(params.q);
  const [searchType$, setSearchType] = createSignal(params.type ? parseInt(params.type) as ContentType : ContentType.MEDIA);
  const [filterValues$, setFilterValues] = createSignal<Record<string, string[]> | undefined>(params.filters ? JSON.parse(params.filters) : undefined);
  const [sortBy$, setSortBy] = createSignal(params.sortBy);
  const [clientSort$, setClientSort] = createSignal<SortEntry[]>([]);
  const [standardSearchResults$, setStandardSearchResults] = createSignal<IPlatformContent[]>([]);
  const [enabledSources$, setEnabledSources] = createSignal<string[]>(params.clientIds ? JSON.parse(params.clientIds) : (StateGlobal.sourceStates$() ?? []).map(v => v.config.id));
  const disabledSources$ = createMemo<string[]>(()=>((StateGlobal.sourceStates$() ?? []).filter(x=>enabledSources$().indexOf(x.config.id) < 0).map(v => v.config.id)));
  const smartSessionForDisplay$ = createMemo(() => sortSmartSearchSession(smartSearchSession$(), clientSort$()));
  let filtersChanged = false;
  let autoStartedQuery: string | undefined;
  let preferencesApplied = false;

  createEffect(() => {
    console.log("query changed", params.q);
    if (params.q !== query$()) {
      clearSmartSearch();
      autoStartedQuery = undefined;
    }
    setQuery(params.q);
    searchPagerActions.refetch();
  });

  createEffect(() => {
    console.log("type changed", params.type);
    const nextType = params.type ? parseInt(params.type) as ContentType : ContentType.MEDIA;
    if (nextType !== searchType$()) {
      clearSmartSearch();
      autoStartedQuery = undefined;
    }
    setSearchType(nextType);
    searchPagerActions.refetch();
  });

  const [searchPager, searchPagerActions] = createResourceDefault(async () => {
    console.log("retrieve new pager");
    const query = query$();
    return query ? await SearchBackend.searchPagerLazy(query, untrack(searchType$), untrack(sortBy$), untrack(filterValues$), untrack(disabledSources$)) : undefined;
  });

  const standardResultsListener = {};
  createEffect(() => {
    const pager = searchPager();
    const refresh = () => setStandardSearchResults([...(pager?.dataFiltered ?? [])]);
    refresh();
    pager?.addedFilteredItemsEvent.register(refresh, standardResultsListener);
    pager?.modifiedFilteredItemsEvent.register(refresh, standardResultsListener);
    pager?.removedFilteredItemsEvent.register(refresh, standardResultsListener);
    pager?.filterChangedEvent.register(refresh, standardResultsListener);
    onCleanup(() => {
      pager?.addedFilteredItemsEvent.unregister(standardResultsListener);
      pager?.modifiedFilteredItemsEvent.unregister(standardResultsListener);
      pager?.removedFilteredItemsEvent.unregister(standardResultsListener);
      pager?.filterChangedEvent.unregister(standardResultsListener);
    });
  });

  const performSearch = (type?: ContentType, sortBy?: string, filters?: Record<string, string[]>, clientIds?: string[]) => {
    const query = query$();
    if (!query) {
      return;
    }

    const newNavigationUri = "/web/search?q=" + encodeURIComponent(query) + (type ? "&type=" + encodeURIComponent(type) : "") + (sortBy ? "&sortBy=" + encodeURIComponent(sortBy) : "") + (filters ? "&filters=" + encodeURIComponent(JSON.stringify(filters)) : "") + (clientIds ? "&clientIds=" + encodeURIComponent(JSON.stringify(clientIds)) : "");
    console.log("navigating to", newNavigationUri);
    navigate(newNavigationUri);
    searchPagerActions.refetch();
    clearSmartSearch();
    autoStartedQuery = undefined;
  };

  const startSmartSearch = async (showResults = true, promptForCommand = true) => {
    const query = query$();
    if (!query) return;
    if (isSmartSearchForQuery(query) && (smartSearchSession$() || smartSearchLoading$())) {
      if (showResults)
        showSmartSearch();
      return;
    }
    if (smartSearchLoading$()) return;
    if (!hasTranslatorCommand()) {
      if (!promptForCommand)
        return;
      UIOverlay.overlayTextPrompt(
        "Configure Smart Search translator",
        "Absolute path to a local executable. It receives JSON on standard input and keeps Routr credentials outside BlueJay.",
        "/Users/moi/Nextcloud/10.Scripts/grayjay/smart-search.sh",
        "Save and search",
        async (command) => {
          await setTranslatorCommand(command);
          void startSmartSearch(showResults, true);
        }
      );
      return;
    }
    const sessionId = beginSmartSearch(query, showResults);
    try {
      const session = await SmartSearchBackend.load({
        sessionId,
        query,
        languages: smartSearchLanguages$(),
        translatorCommand: translatorCommand$(),
        type: untrack(searchType$),
        order: untrack(sortBy$),
        filters: untrack(filterValues$),
        excludePlugins: untrack(disabledSources$)
      });
      if (smartSearchSession$()?.sessionId !== sessionId) {
        void SmartSearchBackend.close(sessionId);
        return;
      }
      setSmartSearchSession(session);
      void refreshSmartSearchSession(sessionId);
    } catch (error) {
      if (smartSearchSession$()?.sessionId !== sessionId)
        return;
      setSmartSearchSession({ sessionId, error: error instanceof Error ? error.message : "Smart Search failed.", variants: [] });
      setSmartSearchLoading(false);
    }
  };

  createEffect(() => {
    const query = query$();
    if (!smartSearchSettingsReady$() || !smartSearchAutoStart$() || !hasTranslatorCommand() || !query || autoStartedQuery === query)
      return;
    autoStartedQuery = query;
    void startSmartSearch(false, false);
  });

  const refreshSmartSearchSession = async (sessionId: string) => {
    let latestSession: ISmartSearchSession | undefined;
    let lastError: unknown;
    let titleTranslationInFlight = false;
    let titleTranslationQueued = false;
    const requestedTranslationKeys = new Set<string>();

    const translationKeys = (session: ISmartSearchSession | undefined) => {
      const keys = new Set<string>();
      for (const result of session?.variants.flatMap(variant => variant.results) ?? []) {
        const titleKey = `title:${result.key}`;
        if (!result.translatedTitle && !requestedTranslationKeys.has(titleKey))
          keys.add(titleKey);

        const creatorKey = result.creatorKey ? `creator:${result.creatorKey}` : undefined;
        if (smartSearchTranslateCreatorNames$() && creatorKey && result.originalCreatorName && !result.translatedCreatorName && !requestedTranslationKeys.has(creatorKey))
          keys.add(creatorKey);
      }
      return [...keys];
    };

    const hasPendingTitleTranslations = (session: ISmartSearchSession | undefined) => translationKeys(session).length > 0;

    const requestTitleTranslations = async () => {
      const activeSession = smartSearchSession$();
      if (!activeSession || activeSession.sessionId !== sessionId)
        return;

      const keys = translationKeys(activeSession).slice(0, SMART_SEARCH_TITLES_PER_REQUEST);
      if (keys.length === 0)
        return;

      keys.forEach(key => requestedTranslationKeys.add(key));
      titleTranslationInFlight = true;
      setSmartSearchTranslatingTitles(true);
      try {
        const translated = await SmartSearchBackend.translateTitles(sessionId, translatorCommand$(), keys);
        if (smartSearchSession$()?.sessionId === sessionId) {
          const reconciled = reconcileSmartSearchSession(smartSearchSession$(), translated);
          if (reconciled !== smartSearchSession$())
            setSmartSearchSession(reconciled);
        }
      } catch (error) {
        console.warn("Smart Search title translation failed", error);
      } finally {
        titleTranslationInFlight = false;
        const activeSession = smartSearchSession$();
        if (activeSession?.sessionId !== sessionId)
          return;

        const shouldContinue = titleTranslationQueued || hasPendingTitleTranslations(activeSession);
        titleTranslationQueued = false;
        if (shouldContinue) {
          void requestTitleTranslations();
          return;
        }

        setSmartSearchTranslatingTitles(false);
      }
    };

    const queueTitleTranslations = () => {
      if (titleTranslationInFlight) {
        titleTranslationQueued = true;
        return;
      }
      void requestTitleTranslations();
    };

    for (let attempt = 0; attempt < SMART_SEARCH_POLL_ATTEMPTS; attempt++) {
      if (attempt > 0)
        await wait(SMART_SEARCH_POLL_INTERVAL_MS);
      if (smartSearchSession$()?.sessionId !== sessionId)
        return;

      try {
        const refreshed = await SmartSearchBackend.get(sessionId);
        latestSession = refreshed;
        if (smartSearchSession$()?.sessionId === sessionId) {
          const reconciled = reconcileSmartSearchSession(smartSearchSession$(), refreshed);
          if (reconciled !== smartSearchSession$())
            setSmartSearchSession(reconciled);
        }
        if (hasSmartSearchResults(refreshed))
          queueTitleTranslations();
      } catch (error) {
        lastError = error;
      }
    }

    if (smartSearchSession$()?.sessionId !== sessionId)
      return;

    if (latestSession && hasSmartSearchResults(latestSession))
      queueTitleTranslations();
    else if (lastError && smartSearchSession$()?.sessionId === sessionId) {
      setSmartSearchSession({
        sessionId,
        error: lastError instanceof Error ? lastError.message : "Smart Search results could not be refreshed.",
        variants: latestSession?.variants ?? []
      });
    }

    if (smartSearchSession$()?.sessionId === sessionId)
      setSmartSearchLoading(false);
  };

  const setSearchMode = (mode: "standard" | "smart") => {
    if (mode === "standard") {
      hideSmartSearch();
      return;
    }
    void startSmartSearch(true, true);
  };

  onCleanup(() => clearSmartSearch());

  const persistCurrentPreferences = () => {
    void setSearchPreferences({
      filters: untrack(filterValues$),
      sortBy: untrack(sortBy$),
      clientSort: untrack(clientSort$),
      enabledSources: untrack(enabledSources$)
    });
  };

  let filtersScrollContainerRef: HTMLDivElement | undefined;

  createEffect(() => {
    const sourceIds = (StateGlobal.sourceStates$() ?? []).map(v => v.config.id);
    if (!searchPreferencesReady$() || sourceIds.length === 0 || preferencesApplied)
      return;

    const preferences = searchPreferences$();
    const requestedSources = params.clientIds ? JSON.parse(params.clientIds) : preferences.enabledSources;
    const enabledSources = Array.isArray(requestedSources)
      ? requestedSources.filter((source): source is string => typeof source === "string" && sourceIds.includes(source))
      : [];

    batch(() => {
      if (!params.filters)
        setFilterValues(preferences.filters);
      if (!params.sortBy)
        setSortBy(preferences.sortBy);
      setClientSort(preferences.clientSort);
      setEnabledSources(enabledSources.length > 0 ? enabledSources : sourceIds);
    });
    preferencesApplied = true;
    searchPagerActions.refetch();
  });

  const commonCapabilities$ = createMemo(() => {
    const searchCapabilities = StateGlobal.getCommonSearchCapabilities(enabledSources$());
    return searchCapabilities;
  });

  const sourceFilters$ = createMemo(() => {
    const sourceStates = StateGlobal.sourceStates$();
    if (!sourceStates) {
      return [];
    }

    const sourceFilters = sourceStates.map<ToggleBigButtonGroupItemMulti>(s => {
      return { 
        text: s.config.name,
        value: s.config.id, 
        icon: s.config.absoluteIconUrl!
      };
    });

    return sourceFilters;
  });

  createEffect(() => {
    if (!filtersDialogVisible$() && filtersChanged) {
      filtersChanged = false;
      persistCurrentPreferences();
      performSearch(untrack(searchType$), untrack(sortBy$), untrack(filterValues$), untrack(enabledSources$));
    }
  });

  createEffect(async () => {
    const caps = commonCapabilities$();
    const filterValues = untrack(filterValues$);
    
    batch(() => {
      if (caps && filterValues) {
        const newFilterValues: { [key: string]: string[] } = {};
        Object.keys(filterValues).forEach(key => {
          const currentFilter = caps.filters.find(filter => filter.id === key);
          
          if (currentFilter) {
            const validValues = currentFilter.filters.map(f => f.value);
            
            if (currentFilter.isMultiSelect) {
              const validArray = (filterValues[key] as string[]).filter(value => validValues.includes(value));
              if (validArray.length > 0) {
                newFilterValues[key] = validArray;
              }
            } else {
              if (validValues.includes(filterValues[key][0])) {
                newFilterValues[key] = filterValues[key];
              }
            }
          }
        });
        
        setFilterValues(newFilterValues);
      } else {
        setFilterValues(undefined);
      }
      
      const sort = untrack(sortBy$);
      if (sort) {
        if (!caps?.sorts.includes(sort)) {
          setSortBy(undefined);
        }
      }

      console.log("Common capabilities changed", { caps, filterValues });
    });
  });
  
  const sortItems$ = createMemo(() => commonCapabilities$()?.sorts.map<ToggleButtonGroupItem>(v => {
    return {
      text: v,
      value: v
    };
  }));

  createEffect(() => {
    const pager = searchPager();
    const sort = clientSort$();
    if (!pager) return;
    if (sort.length === 0) {
      pager.setSortComparator(undefined);
      return;
    }
    pager.setSortComparator((a, b) => compareClientSort(a as IPlatformContent, b as IPlatformContent, sort));
  });

  let scrollContainerRef: HTMLDivElement | undefined;

  const sortToggle = (opt: typeof SORT_OPTIONS[0]) => {
    const current = clientSort$().find(e => e.field === opt.value);
    if (!current) {
      setClientSort([...clientSort$(), { field: opt.value, dir: opt.defaultDir }]);
    } else if (current.dir === opt.defaultDir) {
      const flipped: 'asc' | 'desc' = current.dir === 'asc' ? 'desc' : 'asc';
      setClientSort(clientSort$().map(e => e.field === opt.value ? { ...e, dir: flipped } : e));
    } else {
      setClientSort(clientSort$().filter(e => e.field !== opt.value));
    }
    persistCurrentPreferences();
  };

  const handleBack = () => {
    if (filtersDialogVisible$()) {
      setFiltersDialogVisible(false);
      return true;
    }
    return false;
  };

  const filterGroupId = (i: number) => `filter-group-${i}`;

  return (
    <>
      <div class={styles.container}>
          <NavigationBar initialText={query$()} defaultSearchType={searchType$()} autoFocusSearch={true} />
          <div style="display: flex; flex-direction: row; align-items: center; margin-bottom: 24px; gap: 24px; margin-left: 24px; margin-right: 24px;">
            <ToggleItemButtonGroup items={[
              { text: "Media", value: ContentType.MEDIA, icon: iconVideos },
              { text: "Creators", value: ContentType.CHANNEL, icon: iconCreators },
              { text: "Playlists", value: ContentType.PLAYLIST, icon: iconPlaylist }
            ]} defaultSelectedValue={searchType$()} onValueChanged={(v) => {
              setSearchType(v);
              performSearch(v, sortBy$(), filterValues$(), enabledSources$());
            }} focusable={true} />
            <Show when={searchType$() === ContentType.MEDIA}>
              <CustomButton text='Filters' icon={iconFilters} border='1px solid #2E2E2E' style={{"height": "44px" }} onClick={() => setFiltersDialogVisible(true)} focusableOpts={{
                onPress: () => setFiltersDialogVisible(true)
              }} />
              <div class={styles.searchModeToggle}>
                <button type="button" class={styles.searchModeButton} classList={{ [styles.searchModeActive]: !smartSearchVisible$() }} onClick={() => setSearchMode("standard")}>Standard</button>
                <button type="button" class={styles.searchModeButton} classList={{ [styles.searchModeActive]: smartSearchVisible$() }} onClick={() => setSearchMode("smart")}>
                  Smart
                  <Show when={smartSearchLoading$()}><span class={styles.searchModeLoading}></span></Show>
                </button>
              </div>
            </Show>
          </div>
          <Show when={searchPager.state == 'ready'}>
            <ScrollContainer ref={scrollContainerRef}>
              <Show when={smartSearchVisible$()} fallback={<ContentGrid pager={searchPager()} outerContainerRef={scrollContainerRef} openChannelButton={true} />}>
                <SmartSearchResults
                  loading={smartSearchLoading$()}
                  translatingTitles={smartSearchTranslatingTitles$()}
                  titleDisplay={smartSearchTitleDisplay$()}
                  translateCreatorNames={smartSearchTranslateCreatorNames$()}
                  resultLayout={smartSearchResultLayout$()}
                  standardResults={standardSearchResults$()}
                  compareResults={clientSort$().length > 0 ? (first, second) => compareClientSort(first.content as IPlatformContent, second.content as IPlatformContent, clientSort$()) : undefined}
                  session={smartSessionForDisplay$()}
                />
              </Show>
            </ScrollContainer>
          </Show>
      </div>
      <Portal>
          <Show when={filtersDialogVisible$()}>
            <div class={styles.filtersDialogBackground} onClick={() => setFiltersDialogVisible(false)} use:focusScope={{
                initialMode: 'trap'
            }}>
              <div class={styles.filtersDialog} onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}>
                <div style="display: flex; align-items: center; width: 100%;">
                  <div class={styles.filtersDialogTitle}>Filters</div>
                  <div style="flex-grow: 1"></div>
                  <IconButton icon={iconClose} height='24px' width='24px' style={{ "margin-left": "24px" }} onClick={() => setFiltersDialogVisible(false)} />
                </div>
                <ScrollContainer ref={filtersScrollContainerRef} wrapperStyle={{ "width": "100%" }} scrollToTopButton={false}>
                  <div class={styles.filterHeader}>Select sources</div>
                  <ToggleItemBigButtonGroupMulti items={sourceFilters$()} defaultSelectedValues={enabledSources$()} onValueChanged={(items) => {
                    setEnabledSources(items);
                    filtersChanged = true;
                  }} focusable={true} onBack={handleBack} focusableGroupOpts={{
                    groupId: 'select-sources',
                    groupEscapeTo: {
                      down: ['sort-by', 'order-results', filterGroupId(0)]
                    }
                  }} />
                  <Show when={sortItems$() && sortItems$()?.length}>
                    <div class={styles.filterHeader}>Sort by</div>
                    <ToggleItemButtonGroup items={sortItems$()} defaultSelectedValue={sortBy$()} onValueChanged={(item) => {
                      setSortBy(item);
                      filtersChanged = true;
                    }} focusable={true} onBack={handleBack} focusableGroupOpts={{
                      groupId: 'sort-by',
                      groupEscapeTo: {
                        up: ['select-sources'],
                        down: ['order-results', filterGroupId(0)]
                      }
                    }} />
                  </Show>
                  <div class={styles.filterHeader}>Order results</div>
                  <div class={styles.sortGroup}>
                    <For each={SORT_OPTIONS}>{(opt) => {
                      const entry = () => clientSort$().find(e => e.field === opt.value);
                      const rank  = () => clientSort$().findIndex(e => e.field === opt.value) + 1;
                      return (
                        <div class={styles.sortButton} classList={{ [styles.sortButtonActive]: !!entry() }}
                          onClick={() => sortToggle(opt)}
                          use:focusable={{
                            onPress: () => sortToggle(opt),
                            onBack: handleBack,
                            groupId: 'order-results',
                            groupEscapeTo: {
                              up: ['sort-by', 'select-sources'],
                              down: [filterGroupId(0)]
                            }
                          }}>
                          {opt.text}
                          <Show when={entry()}>
                            <span>{entry()!.dir === 'asc' ? '↑' : '↓'}</span>
                            <Show when={clientSort$().length > 1}>
                              <span class={styles.sortPriority}>{rank()}</span>
                            </Show>
                          </Show>
                        </div>
                      );
                    }}</For>
                  </div>
                  <For each={commonCapabilities$()?.filters}>{(item, i) => {
                    const items$ = createMemo(() => item.filters.map<ToggleButtonGroupItem>(v => {
                      return {
                        text: v.name,
                        value: v.id ?? v.name
                      };
                    }));
                    const selectedValue$ = createMemo(() => {
                        return filterValues$()?.[item.id ?? item.name];
                    });
                    return (
                      <>
                        <div class={styles.filterHeader}>{item.name}</div>
                        <Show when={item.isMultiSelect} fallback={
                          <ToggleItemButtonGroup items={items$()} defaultSelectedValue={selectedValue$()} onValueChanged={(v) => {
                            setFilterValues({ ... filterValues$(), [item.id ?? item.name]: v ? [ v ] : [] });
                            filtersChanged = true;
                          }} focusable={true} onBack={handleBack} focusableGroupOpts={{
                            groupId: filterGroupId(i()),
                            groupEscapeTo: {
                              up: i() === 0 ? ['order-results', 'sort-by', 'select-sources'] : [filterGroupId(i() - 1), 'order-results', 'sort-by', 'select-sources'],
                              down: i() < commonCapabilities$()!.filters!.length - 1 ? [filterGroupId(i() + 1)] : undefined
                            }
                          }} />
                        }>
                          <ToggleItemButtonGroupMulti items={items$()} defaultSelectedValues={selectedValue$()} onValueChanged={(v) => {
                            setFilterValues({ ... filterValues$(), [item.id ?? item.name]: v });
                            filtersChanged = true;
                          }} focusable={true} onBack={handleBack} focusableGroupOpts={{
                            groupId: filterGroupId(i()),
                            groupEscapeTo: {
                              up: i() === 0 ? ['order-results', 'sort-by', 'select-sources'] : [filterGroupId(i() - 1), 'order-results', 'sort-by', 'select-sources'],
                              down: i() < commonCapabilities$()!.filters!.length - 1 ? [filterGroupId(i() + 1)] : undefined
                            }
                          }} />
                        </Show>
                      </>
                    );
                  }}</For>
                </ScrollContainer>
              </div>
            </div>
          </Show>
      </Portal>
    </>
  );
};

export default SearchPage;
