import { createSignal } from 'solid-js';
import { HighlightsBackend } from '../backend/HighlightsBackend';
import StateWebsocket from './StateWebsocket';
import type { HighlightInterestSummary } from '../utils/highlightInterest';

// Index compact par cle video, utilise pour les marqueurs et les notes des vignettes.
const [indexedSummaries$, setIndexedSummaries] = createSignal<Map<string, HighlightInterestSummary>>(new Map());

function youtubeId(url: string): string | null {
    const m = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?[^#\s]*v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i)
        ?? url.match(/[?&]v=([A-Za-z0-9_-]{11})/i);
    return m ? m[1] : null;
}

function keyOf(url: string | undefined): string | null {
    if (!url) return null;
    return youtubeId(url) ?? url.trim();
}

async function reload() {
    try {
        const all = await HighlightsBackend.getAll();
        const summaries = new Map<string, HighlightInterestSummary>();
        for (const summary of all ?? []) {
            if ((summary.segmentCount ?? 0) > 0) {
                const key = keyOf(summary.videoUrl);
                if (key && !summaries.has(key)) {
                    summaries.set(key, {
                        segmentCount: summary.segmentCount,
                        totalDuration: summary.totalDuration,
                        interestingDuration: summary.interestingDuration,
                        averageScore: summary.averageScore,
                        topScore: summary.topScore,
                        strongSegmentCount: summary.strongSegmentCount,
                        excellentSegmentCount: summary.excellentSegmentCount,
                    });
                }
            }
        }
        setIndexedSummaries(summaries);
    } catch {
        // ignore — pas de marqueur si la liste ne charge pas
    }
}

reload();
StateWebsocket.registerHandler("HighlightsChanged", () => { reload(); }, "stateIndexedHighlights");

export function isIndexed(url: string | undefined): boolean {
    const key = keyOf(url);
    return key != null && indexedSummaries$().has(key);
}

export function indexedHighlightSummaryFor(url: string | undefined): HighlightInterestSummary | undefined {
    const key = keyOf(url);
    return key != null ? indexedSummaries$().get(key) : undefined;
}
