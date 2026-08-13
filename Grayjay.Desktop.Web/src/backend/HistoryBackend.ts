import { Backend } from "./Backend";
import { IHistoryVideo } from "./models/content/IHistoryVideo";
import { Pager } from "./models/pagers/Pager";

export abstract class HistoryBackend {
    static async getHistoricalPosition(url: string): Promise<number> {
        return await Backend.GET("/history/GetHistoricalPosition?url=" + encodeURIComponent(url)) as number;
    }

    static async historyLoad(): Promise<PagerResult<IHistoryVideo>> {
        return await Backend.GET("/history/HistoryLoad") as PagerResult<IHistoryVideo>;
    }

    static async historyLoadSearch(query?: string, creator?: string): Promise<PagerResult<IHistoryVideo>> {
        return await Backend.GET("/history/HistoryLoadSearch?query=" + encodeURIComponent(query ?? "") + "&creator=" + encodeURIComponent(creator ?? "")) as PagerResult<IHistoryVideo>;
    }

    static async historySearchPager(query?: string, creator?: string): Promise<Pager<IHistoryVideo>> {
        return Pager.fromMethods<IHistoryVideo>(() => this.historyLoadSearch(query, creator), this.historyNextPage);
    }

    static async historyNextPage(): Promise<PagerResult<IHistoryVideo>> {
        return await Backend.GET("/history/HistoryNextPage") as PagerResult<IHistoryVideo>;
    }
    static async historyPager(): Promise<Pager<IHistoryVideo>> {
        return Pager.fromMethods<IHistoryVideo>(this.historyLoad, this.historyNextPage);
    }

    static async removeHistory(url: string): Promise<boolean> {
        return await Backend.GET("/history/RemoveHistory?url=" + encodeURIComponent(url)) as boolean;
    }

    static async removeHistoryRange(minutesToRemove?: number): Promise<boolean> {
        return await Backend.GET("/history/RemoveHistoryRange?minutes=" + (minutesToRemove ?? -1).toString()) as boolean;
    }
}
