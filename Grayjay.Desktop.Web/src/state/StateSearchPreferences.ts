import { createSignal } from "solid-js";
import { Backend } from "../backend/Backend";
import { SettingsBackend } from "../backend/SettingsBackend";

export type SearchSortEntry = {
    field: string;
    dir: "asc" | "desc";
};

export type SearchPreferences = {
    filters?: Record<string, string[]>;
    sortBy?: string;
    clientSort: SearchSortEntry[];
    enabledSources?: string[];
};

const PersistKey = "search.preferences";
const SortFields = new Set(["date", "views", "duration", "name"]);

const [searchPreferences$, setSearchPreferencesSignal] = createSignal<SearchPreferences>({ clientSort: [] });
const [searchPreferencesReady$, setSearchPreferencesReadySignal] = createSignal(false);
let persistQueue = Promise.resolve();

function normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value))
        return [];

    return [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))];
}

function normalizeFilters(value: unknown): Record<string, string[]> | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return undefined;

    const filters: Record<string, string[]> = {};
    for (const [key, items] of Object.entries(value)) {
        if (typeof key !== "string" || key.length === 0)
            continue;

        const normalized = normalizeStringArray(items);
        if (normalized.length > 0)
            filters[key] = normalized;
    }

    return Object.keys(filters).length > 0 ? filters : undefined;
}

function normalizeClientSort(value: unknown): SearchSortEntry[] {
    if (!Array.isArray(value))
        return [];

    const fields = new Set<string>();
    const result: SearchSortEntry[] = [];
    for (const item of value) {
        if (!item || typeof item !== "object")
            continue;

        const field = (item as SearchSortEntry).field;
        const dir = (item as SearchSortEntry).dir;
        if (!SortFields.has(field) || (dir !== "asc" && dir !== "desc") || fields.has(field))
            continue;

        fields.add(field);
        result.push({ field, dir });
    }

    return result;
}

export function normalizeSearchPreferences(value: unknown): SearchPreferences {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return { clientSort: [] };

    const source = value as SearchPreferences;
    return {
        filters: normalizeFilters(source.filters),
        sortBy: typeof source.sortBy === "string" && source.sortBy.length > 0 ? source.sortBy : undefined,
        clientSort: normalizeClientSort(source.clientSort),
        enabledSources: normalizeStringArray(source.enabledSources)
    };
}

(async () => {
    try {
        const raw = await Backend.GET(`/settings/PersistGet?key=${PersistKey}`);
        const value: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
        setSearchPreferencesSignal(normalizeSearchPreferences(value));
    } catch {
        // Search preferences are optional and default to the platform behavior.
    } finally {
        setSearchPreferencesReadySignal(true);
    }
})();

export { searchPreferences$, searchPreferencesReady$ };

export async function setSearchPreferences(preferences: SearchPreferences) {
    const normalized = normalizeSearchPreferences(preferences);
    setSearchPreferencesSignal(normalized);
    persistQueue = persistQueue
        .catch(() => undefined)
        .then(() => SettingsBackend.persistSet(PersistKey, normalized));
    await persistQueue;
}
