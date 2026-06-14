import { createSignal } from 'solid-js';
import { Backend } from '../backend/Backend';
import { SettingsBackend } from '../backend/SettingsBackend';
import { HighlightsBackend, IHighlightIndexJob } from '../backend/HighlightsBackend';
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
    if (job?.url)
        setIndexJobs(prev => ({ ...prev, [job.url]: job }));
}, "stateHighlightsIndexer");

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

export async function indexVideo(url: string): Promise<IHighlightIndexJob> {
    const command = generatorCommand$().trim();
    if (!command)
        throw new Error("No generator command configured");
    const job = await HighlightsBackend.generate(url, command);
    setIndexJobs(prev => ({ ...prev, [url]: job }));
    return job;
}
