import { Backend } from "./Backend";
import { ContentType } from "./models/ContentType";

export interface ISmartSearchResult {
    key: string;
    content: any;
    originalTitle: string;
    translatedTitle?: string;
    creatorKey?: string;
    originalCreatorName?: string;
    translatedCreatorName?: string;
    languages: string[];
}

export interface ISmartSearchVariant {
    id: string;
    language: string;
    query: string;
    axis?: string;
    stage: number;
    status: string;
    error?: string;
    results: ISmartSearchResult[];
}

export interface ISmartSearchSession {
    sessionId: string;
    error?: string;
    variants: ISmartSearchVariant[];
}

export interface ISmartSearchDiscoveryAxis {
    id: string;
    label: string;
    queries: Record<string, string>;
}

export interface ISmartSearchDiscoveryRequest {
    userLanguage: string;
    axes: ISmartSearchDiscoveryAxis[];
}

export interface ISmartSearchLoadRequest {
    sessionId: string;
    query: string;
    languages: string[];
    translatorCommand: string;
    type: ContentType;
    order?: string;
    filters?: Record<string, string[]>;
    excludePlugins?: string[];
    discovery?: ISmartSearchDiscoveryRequest;
    maxParallelism?: number;
}

export abstract class SmartSearchBackend {
    static async load(request: ISmartSearchLoadRequest): Promise<ISmartSearchSession> {
        return await Backend.POST("/smartsearch/Load", JSON.stringify(request), "application/json") as ISmartSearchSession;
    }

    static async get(sessionId: string): Promise<ISmartSearchSession> {
        return await Backend.GET("/smartsearch/Get?sessionId=" + encodeURIComponent(sessionId)) as ISmartSearchSession;
    }

    static async startNextDiscoveryStage(sessionId: string): Promise<ISmartSearchSession> {
        return await Backend.POST("/smartsearch/StartNextDiscoveryStage", JSON.stringify({ sessionId }), "application/json") as ISmartSearchSession;
    }

    static async translateTitles(sessionId: string, translatorCommand: string, keys: string[]): Promise<ISmartSearchSession> {
        return await Backend.POST("/smartsearch/TranslateTitles", JSON.stringify({ sessionId, translatorCommand, targetLanguage: "fr", keys }), "application/json") as ISmartSearchSession;
    }
}
