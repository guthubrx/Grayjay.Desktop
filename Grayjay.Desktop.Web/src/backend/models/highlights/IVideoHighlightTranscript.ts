export interface IVideoHighlightTranscriptCue {
    start: number;
    end: number;
    text: string;
}

export interface IVideoHighlightTranscript {
    videoUrl: string;
    title?: string;
    source?: string;
    cues: IVideoHighlightTranscriptCue[];
}
