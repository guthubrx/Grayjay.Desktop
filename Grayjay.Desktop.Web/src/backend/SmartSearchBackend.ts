import { Backend } from "./Backend";
import { ContentType } from "./models/ContentType";

export interface ISmartSearchResult {
    key: string;
    content: any;
    originalTitle: string;
    translatedTitle?: string;
    languages: string[];
}

export interface ISmartSearchVariant {
    language: string;
    query: string;
    status: string;
    error?: string;
    results: ISmartSearchResult[];
}

export interface ISmartSearchSession {
    sessionId: string;
    error?: string;
    variants: ISmartSearchVariant[];
}

export abstract class SmartSearchBackend {
    static async load(request: { sessionId: string; query: string; languages: string[]; translatorCommand: string; type: ContentType; order?: string; filters?: Record<string, string[]>; excludePlugins?: string[] }): Promise<ISmartSearchSession> {
        return await Backend.POST("/smartsearch/Load", JSON.stringify(request), "application/json") as ISmartSearchSession;
    }

    static async get(sessionId: string): Promise<ISmartSearchSession> {
        return await Backend.GET("/smartsearch/Get?sessionId=" + encodeURIComponent(sessionId)) as ISmartSearchSession;
    }

    static async translateTitles(sessionId: string, translatorCommand: string, keys: string[]): Promise<ISmartSearchSession> {
        return await Backend.POST("/smartsearch/TranslateTitles", JSON.stringify({ sessionId, translatorCommand, targetLanguage: "fr", keys }), "application/json") as ISmartSearchSession;
    }
}
