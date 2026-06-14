import { createSignal } from 'solid-js';
import { SettingsBackend } from '../backend/SettingsBackend';
import { HighlightsBackend, IHighlightIndexJob } from '../backend/HighlightsBackend';
import StateWebsocket from './StateWebsocket';

// Chemin (template) de la commande externe de génération. Vide = feature inactive.
const [generatorCommand$, setGeneratorCommandSignal] = createSignal<string>("");
// Statut des jobs d'indexation par URL, alimenté par le WebSocket.
const [indexJobs$, setIndexJobs] = createSignal<Record<string, IHighlightIndexJob>>({});

SettingsBackend.persistGet('highlights.generatorCommand', null).then((v: any) => {
    // Stocke sous forme d'objet {command} : le persist backend ne round-trip
    // pas les strings simples (value.ToString() retire les guillemets).
    const cmd = (v && typeof v === 'object' && typeof v.command === 'string')
        ? v.command
        : (typeof v === 'string' ? v : "");
    if (cmd) setGeneratorCommandSignal(cmd);
}).catch(() => {});

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
