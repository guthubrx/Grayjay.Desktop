import { IPlatformVideo } from "../content/IPlatformVideo";
import { IVideoHighlightSegment } from "./IVideoHighlightSegment";
import { IVideoHighlightThesis } from "./IVideoHighlightThesis";

export interface IVideoHighlightSet {
    schemaVersion: number;
    videoUrl: string;
    source?: string;
    createdAt: string;
    updatedAt: string;
    globalSummary?: string;
    theses?: IVideoHighlightThesis[];
    video?: IPlatformVideo;
    segments: IVideoHighlightSegment[];
}
