import { IPlatformVideo } from "../content/IPlatformVideo";

export interface IVideoHighlightSummary {
    videoUrl: string;
    source: string;
    updatedAt: string;
    segmentCount: number;
    totalDuration: number;
    interestingDuration?: number;
    averageScore?: number;
    topScore?: number;
    strongSegmentCount?: number;
    excellentSegmentCount?: number;
    globalSummary?: string;
    video?: IPlatformVideo;
}
