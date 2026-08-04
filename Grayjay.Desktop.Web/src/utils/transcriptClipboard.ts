interface TranscriptCue {
    start: number;
    text: string;
}

function timestamp(seconds: number): string {
    const value = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const remainingSeconds = value % 60;
    return hours > 0
        ? `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
        : `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function formatTranscriptForClipboard(cues: TranscriptCue[]): string {
    let previousText: string | undefined;
    const lines: string[] = [];

    for (const cue of cues) {
        const text = cue.text.replace(/\s+/g, " ").trim();
        if (!text || text === previousText)
            continue;

        lines.push(`[${timestamp(cue.start)}] ${text}`);
        previousText = text;
    }

    return lines.join("\n");
}
