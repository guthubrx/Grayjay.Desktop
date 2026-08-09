import { ContentType } from "../../backend/models/ContentType";
import { HighlightsBackend } from "../../backend/HighlightsBackend";
import { IPlatformVideo } from "../../backend/models/content/IPlatformVideo";
import { SmartSearchBackend, type ISmartSearchSession } from "../../backend/SmartSearchBackend";
import { type VideoContextValue, type VideoQueueItemMeta, VideoState } from "../../contexts/VideoProvider";
import UIOverlay from "../../state/UIOverlay";
import StateGlobal from "../../state/StateGlobal";
import { hasGeneratorCommand, indexVideo } from "../../state/StateHighlightsIndexer";
import { hasTranslatorCommand, setTranslatorCommand, smartSearchDiscoveryParallelism$, smartSearchLanguages$, smartSearchSettingsReady$, translatorCommand$ } from "../../state/StateSmartSearch";
import { smartDiscoveryPlan, smartDiscoveryQuery, smartDiscoveryVideos } from "../../utils/smartDiscovery";
import { smartTvSettingsFromObject } from "../../utils/smartTvSettings";
import iconHighlights from "../../assets/icons/label_important_24dp_FFFFFF_FILL1_wght300_GRAD0_opsz24.svg";
import iconSync from "../../assets/icons/ic_sync.svg";
import { MenuItem, MenuItemButton } from "../menus/Overlays/SettingsMenu";

const SMART_DISCOVERY_POLL_INTERVAL_MS = 500;
const SMART_DISCOVERY_POLL_ATTEMPTS = 120;
const SMART_DISCOVERY_STAGE_DELAY_MS = 1250;

export function hasSmartVideoActions(video: IPlatformVideo | undefined): boolean {
    if (!video?.url || video.isLive)
        return false;

    return hasGeneratorCommand()
        || (smartSearchSettingsReady$() && hasTranslatorCommand());
}

export function smartVideoMenuItems(video: IPlatformVideo | undefined, player: VideoContextValue | undefined): MenuItem[] {
    if (!video || !player || !hasSmartVideoActions(video))
        return [];

    const items: MenuItem[] = [];
    if (smartSearchSettingsReady$() && hasTranslatorCommand()) {
        items.push(new MenuItemButton("Create Smart Mix", iconHighlights, undefined, () => {
            void createSmartMix(video, player);
        }));
    }
    if (hasGeneratorCommand()) {
        items.push(new MenuItemButton("Generate Smart Chapters", iconSync, undefined, () => {
            void generateSmartChapters(video);
        }));
    }
    return items;
}

async function generateSmartChapters(video: IPlatformVideo) {
    if (!video.url)
        return;

    try {
        await indexVideo(video.url, video);
        UIOverlay.toast("Added to Smart Chapters queue");
    } catch (error: any) {
        UIOverlay.toast("Generation failed: " + (error?.message ?? error));
    }
}

async function createSmartMix(sourceVideo: IPlatformVideo, player: VideoContextValue) {
    if (!sourceVideo.url)
        return;

    const highlights = await HighlightsBackend.get(sourceVideo.url);
    const discovery = smartDiscoveryPlan(highlights?.discoveryProfile);
    const query = smartDiscoveryQuery(highlights?.mixProfile, highlights?.globalSummary);
    if (!highlights?.segments?.length || !query) {
        UIOverlay.toast("Generate Smart Chapters before creating a Smart Mix");
        return;
    }

    if (!discovery && !hasTranslatorCommand()) {
        UIOverlay.overlayTextPrompt(
            "Configure Smart Search translator",
            "Absolute path to a local executable. It receives JSON on standard input and keeps Routr credentials outside BlueJay.",
            "/Users/moi/Nextcloud/10.Scripts/grayjay/smart-search.sh",
            "Save and search",
            async (command) => {
                await setTranslatorCommand(command);
                void createSmartMix(sourceVideo, player);
            }
        );
        return;
    }

    try {
        const smartTvSettings = smartTvSettingsFromObject(StateGlobal.settings$()?.object);
        UIOverlay.toast("Searching the web for related videos...");
        const sessionId = `smart-mix-${Date.now().toString(36)}`;
        let session = await SmartSearchBackend.load({
            sessionId,
            query,
            languages: smartSearchLanguages$(),
            translatorCommand: translatorCommand$(),
            type: ContentType.MEDIA,
            discovery,
            maxParallelism: discovery ? smartSearchDiscoveryParallelism$() : undefined,
        });
        let started = false;
        let remainingStages = discovery ? 2 : 0;
        let nextStageAt = Date.now() + SMART_DISCOVERY_STAGE_DELAY_MS;
        const updateQueue = (nextSession: ISmartSearchSession): "inactive" | "none" | "updated" => {
            const videos = smartDiscoveryVideos(nextSession, sourceVideo.url!, smartTvSettings.maxVideos);
            if (videos.length === 0)
                return "none";

            const metadata: VideoQueueItemMeta[] = videos.map(result => ({
                source: "smart-mix",
                sessionId,
                sessionTitle: "Smart Mix",
                title: result.name,
                summary: `Inspired by ${sourceVideo.name}`,
                transitionKind: "discover",
                transitionLabel: "Inspired discovery",
                channelName: result.author?.name,
                channelThumbnail: result.author?.thumbnail,
            }));
            if (!started) {
                player.actions.setQueue(0, videos, false, false, VideoState.Maximized, undefined, undefined, metadata);
                started = true;
                return "updated";
            }

            return player.actions.replaceUnplayedSmartMixTail(sessionId, videos, metadata) ? "updated" : "inactive";
        };

        for (let attempt = 0; attempt < SMART_DISCOVERY_POLL_ATTEMPTS; attempt++) {
            if (attempt > 0)
                await new Promise<void>(resolve => window.setTimeout(resolve, SMART_DISCOVERY_POLL_INTERVAL_MS));
            session = await SmartSearchBackend.get(sessionId);
            const queueStatus = updateQueue(session);
            if (queueStatus === "inactive")
                return;

            if (remainingStages > 0 && (started || Date.now() >= nextStageAt)) {
                session = await SmartSearchBackend.startNextDiscoveryStage(sessionId);
                remainingStages--;
                nextStageAt = Date.now() + SMART_DISCOVERY_STAGE_DELAY_MS;
                const stagedQueueStatus = updateQueue(session);
                if (stagedQueueStatus === "inactive")
                    return;
            }
        }
        if (!started)
            UIOverlay.toast("No related videos were found online");
    } catch (error: any) {
        console.warn("Failed to create Smart Mix", error);
        UIOverlay.toast("Smart Mix could not be created: " + (error?.message ?? "unknown error"));
    }
}
