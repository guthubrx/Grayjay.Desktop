import { IPlatformVideo } from "../content/IPlatformVideo";
import { IVideoHighlightEditorialProfile } from "./IVideoHighlightEditorialProfile";

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
    editorialProfile?: IVideoHighlightEditorialProfile;
    video?: IPlatformVideo;
}
