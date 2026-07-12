import { IPlatformVideo } from "../content/IPlatformVideo";
import { IVideoHighlightMixProfile } from "./IVideoHighlightMixProfile";
import { IVideoHighlightSegment } from "./IVideoHighlightSegment";
import { IVideoHighlightThesis } from "./IVideoHighlightThesis";

export interface IVideoHighlightMixCandidate {
    videoUrl: string;
    updatedAt: string;
    video?: IPlatformVideo;
    mixProfile?: IVideoHighlightMixProfile;
    globalSummary?: string;
    theses?: IVideoHighlightThesis[];
    averageScore?: number;
    topScore?: number;
    interestingDuration?: number;
    segments: IVideoHighlightSegment[];
}
