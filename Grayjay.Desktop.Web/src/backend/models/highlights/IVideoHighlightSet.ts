import { IPlatformVideo } from "../content/IPlatformVideo";
import { IVideoHighlightPromotionSegment } from "./IVideoHighlightPromotionSegment";
import { IVideoHighlightSegment } from "./IVideoHighlightSegment";
import { IVideoHighlightMixProfile } from "./IVideoHighlightMixProfile";
import { IVideoHighlightThesis } from "./IVideoHighlightThesis";
import { IVideoHighlightSubtitle } from "./IVideoHighlightSubtitle";

export interface IVideoHighlightSet {
    schemaVersion: number;
    videoUrl: string;
    source?: string;
    transcriptLanguage?: string;
    createdAt: string;
    updatedAt: string;
    globalSummary?: string;
    theses?: IVideoHighlightThesis[];
    mixProfile?: IVideoHighlightMixProfile;
    translatedSubtitles?: IVideoHighlightSubtitle;
    video?: IPlatformVideo;
    segments: IVideoHighlightSegment[];
    promotionSegments?: IVideoHighlightPromotionSegment[];
}
