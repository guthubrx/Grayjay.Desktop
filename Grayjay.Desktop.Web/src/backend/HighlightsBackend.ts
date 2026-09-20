import { Backend } from "./Backend";
import { IPlatformVideo } from "./models/content/IPlatformVideo";
import { IVideoHighlightMixCandidate } from "./models/highlights/IVideoHighlightMixCandidate";
import { IVideoHighlightSet } from "./models/highlights/IVideoHighlightSet";
import { IVideoHighlightSummary } from "./models/highlights/IVideoHighlightSummary";

export abstract class HighlightsBackend {
    static async get(url: string): Promise<IVideoHighlightSet | undefined> {
        return await Backend.GET("/highlights/Get?url=" + encodeURIComponent(url)) as IVideoHighlightSet | undefined;
    }

    static async getAll(): Promise<IVideoHighlightSummary[]> {
        return await Backend.GET("/highlights/GetAll") as IVideoHighlightSummary[];
    }

    static async getMixCandidates(): Promise<IVideoHighlightMixCandidate[]> {
        return await Backend.GET("/highlights/MixCandidates") as IVideoHighlightMixCandidate[];
    }

    static async import(highlightSet: IVideoHighlightSet): Promise<IVideoHighlightSet> {
        return await Backend.POST("/highlights/Import", JSON.stringify(highlightSet), "application/json") as IVideoHighlightSet;
    }

    static async createOrUpdate(highlightSet: IVideoHighlightSet, video?: IPlatformVideo): Promise<IVideoHighlightSet> {
        return await Backend.POST("/highlights/CreateOrUpdate", JSON.stringify({
            highlightSet,
            video
        }), "application/json") as IVideoHighlightSet;
    }

    static async delete(url: string): Promise<void> {
        await Backend.DELETE("/highlights/Delete?url=" + encodeURIComponent(url));
    }

    static async generate(url: string, command: string, translationSourceLanguages: string[] = []): Promise<IHighlightIndexJob> {
        return await Backend.POST("/highlights/Generate", JSON.stringify({ url, command, translationSourceLanguages }), "application/json") as IHighlightIndexJob;
    }

    static async generateIfNeeded(url: string, command: string, translationSourceLanguages: string[] = []): Promise<IHighlightIndexJob> {
        return await Backend.POST("/highlights/GenerateIfNeeded", JSON.stringify({ url, command, translationSourceLanguages }), "application/json") as IHighlightIndexJob;
    }

    static async generatePrefill(url: string, command: string, priority: HighlightPrefillPriority, source: string, translationSourceLanguages: string[] = []): Promise<IHighlightIndexJob> {
        return await Backend.POST("/highlights/GeneratePrefill", JSON.stringify({ url, command, priority, source, translationSourceLanguages }), "application/json") as IHighlightIndexJob;
    }

    static async configurePrefill(parallelism: number, maxQueuedJobs: number): Promise<void> {
        await Backend.POST("/highlights/ConfigurePrefill", JSON.stringify({ parallelism, maxQueuedJobs }), "application/json");
    }

    static async probeSubtitles(urls: string[]): Promise<IHighlightSubtitleAvailability[]> {
        return await Backend.POST("/highlights/ProbeSubtitles", JSON.stringify({ urls }), "application/json") as IHighlightSubtitleAvailability[];
    }

    static async queueStatus(): Promise<IHighlightIndexJob[]> {
        return await Backend.GET("/highlights/QueueStatus") as IHighlightIndexJob[];
    }
}

export interface IHighlightIndexJob {
    url: string;
    status: "queued" | "running" | "done" | "error" | "skipped";
    error?: string;
    priority?: HighlightPrefillPriority;
    source?: string;
    nextAttemptAt?: string;
}

export interface IHighlightSubtitleAvailability {
    url: string;
    available: boolean;
}

export type HighlightPrefillPriority = "manual" | "current-video" | "next-in-queue" | "smart-mix" | "smart-tv" | "watch-now" | "priority-group" | "catalog";
