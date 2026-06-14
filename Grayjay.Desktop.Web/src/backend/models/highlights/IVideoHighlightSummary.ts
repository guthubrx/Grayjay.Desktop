import { IPlatformVideo } from "../content/IPlatformVideo";

export interface IVideoHighlightSummary {
    videoUrl: string;
    source: string;
    updatedAt: string;
    segmentCount: number;
    totalDuration: number;
    globalSummary?: string;
    video?: IPlatformVideo;
}
