export interface IVideoHighlightSubtitleCue {
    start: number;
    end: number;
    text: string;
}

export interface IVideoHighlightSubtitle {
    language: string;
    sourceTranscriptHash: string;
    cues: IVideoHighlightSubtitleCue[];
}
