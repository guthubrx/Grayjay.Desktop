import { createSignal } from 'solid-js';
import { HighlightsBackend } from '../backend/HighlightsBackend';
import StateWebsocket from './StateWebsocket';

// Ensemble des cles (id YouTube ou URL) des videos qui ont des smart highlights
// indexes. Permet aux vignettes d'afficher un marqueur "indexe".
const [indexedKeys$, setIndexedKeys] = createSignal<Set<string>>(new Set());

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
        const set = new Set<string>();
        for (const summary of all ?? []) {
            if ((summary.segmentCount ?? 0) > 0) {
                const key = keyOf(summary.videoUrl);
                if (key) set.add(key);
            }
        }
        setIndexedKeys(set);
    } catch {
        // ignore — pas de marqueur si la liste ne charge pas
    }
}

reload();
StateWebsocket.registerHandler("HighlightsChanged", () => { reload(); }, "stateIndexedHighlights");

export function isIndexed(url: string | undefined): boolean {
    const key = keyOf(url);
    return key != null && indexedKeys$().has(key);
}
