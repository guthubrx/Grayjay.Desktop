import { createSignal } from 'solid-js';
import { Backend } from '../backend/Backend';
import { SettingsBackend } from '../backend/SettingsBackend';
import { HighlightsBackend, IHighlightIndexJob, IHighlightIndexJobMetadata } from '../backend/HighlightsBackend';
import { IPlatformVideo } from '../backend/models/content/IPlatformVideo';
import StateWebsocket from './StateWebsocket';

// Chemin (template) de la commande externe de génération. Vide = feature inactive.
const [generatorCommand$, setGeneratorCommandSignal] = createSignal<string>("");
// Statut des jobs d'indexation par URL, alimenté par le WebSocket.
const [indexJobs$, setIndexJobs] = createSignal<Record<string, IHighlightIndexJob>>({});

// On lit directement (pas via SettingsBackend.persistGet, qui re-parse le JSON
// et casse les valeurs objet/string). On stocke un objet {command} car le
// persist backend ne round-trip pas les strings simples.
(async () => {
    try {
        const raw: any = await Backend.GET("/settings/PersistGet?key=highlights.generatorCommand");
        const obj = (typeof raw === 'string') ? JSON.parse(raw) : raw;
        if (obj && typeof obj === 'object' && typeof obj.command === 'string')
            setGeneratorCommandSignal(obj.command);
    } catch {
        // pas de commande configurée
    }
})();

StateWebsocket.registerHandler("HighlightsIndexChanged", (packet) => {
    const job = packet.payload as IHighlightIndexJob;
    if (job?.url) {
        setIndexJobs(prev => ({ ...prev, [job.url]: job }));
        void refreshIndexJobs();
    }
}, "stateHighlightsIndexer");

void refreshIndexJobs();

export { generatorCommand$, indexJobs$ };

export function hasGeneratorCommand(): boolean {
    return generatorCommand$().trim().length > 0;
}

export async function setGeneratorCommand(command: string) {
    const trimmed = command.trim();
    setGeneratorCommandSignal(trimmed);
    await SettingsBackend.persistSet('highlights.generatorCommand', { command: trimmed });
}

export function jobFor(url: string | undefined): IHighlightIndexJob | undefined {
    return url ? indexJobs$()[url] : undefined;
}

export function pendingIndexJobCount(): number {
    return Object.values(indexJobs$()).filter(job => job.status === "queued" || job.status === "running").length;
}

export async function refreshIndexJobs(): Promise<IHighlightIndexJob[]> {
    const jobs = await HighlightsBackend.queueStatus();
    setIndexJobs(Object.fromEntries(jobs.map(job => [job.url, job])));
    return jobs;
}

export async function indexVideo(url: string, video?: IPlatformVideo): Promise<IHighlightIndexJob> {
    const command = generatorCommand$().trim();
    if (!command)
        throw new Error("No generator command configured");
    const job = await HighlightsBackend.generate(url, command, metadataFor(video));
    setIndexJobs(prev => ({ ...prev, [url]: job }));
    return job;
}

export async function ensureVideoIndexed(url: string, video?: IPlatformVideo): Promise<IHighlightIndexJob | undefined> {
    const command = generatorCommand$().trim();
    if (!command)
        return undefined;
    const job = await HighlightsBackend.generateIfNeeded(url, command, metadataFor(video));
    setIndexJobs(prev => ({ ...prev, [url]: job }));
    return job;
}

export async function prioritizeIndexJob(url: string): Promise<IHighlightIndexJob> {
    const job = await HighlightsBackend.prioritize(url);
    await refreshIndexJobs();
    return job;
}

export async function removeIndexJob(url: string): Promise<IHighlightIndexJob> {
    const job = await HighlightsBackend.removeFromQueue(url);
    await refreshIndexJobs();
    return job;
}

function metadataFor(video: IPlatformVideo | undefined): IHighlightIndexJobMetadata | undefined {
    if (!video)
        return undefined;

    const sources = video.thumbnails?.sources ?? [];
    return {
        title: video.name,
        author: video.author?.name,
        thumbnail: sources.length > 0 ? sources[sources.length - 1]?.url : undefined
    };
}
