export interface IVideoHighlightPromotionSegment {
    start: number;
    end: number;
    category: string;
    source: string;
    confidence?: number;
    summary?: string;
}
