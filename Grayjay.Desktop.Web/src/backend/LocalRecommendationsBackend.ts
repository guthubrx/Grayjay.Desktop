import { Backend } from "./Backend";
import { IPlatformContent } from "./models/content/IPlatformContent";

export abstract class LocalRecommendationsBackend {
  static async forVideo(channelUrl: string, limit: number = 20): Promise<IPlatformContent[]> {
    if (!channelUrl) return [];
    try {
      const qs = `channelUrl=${encodeURIComponent(channelUrl)}&limit=${limit}`;
      const res = await Backend.GET("/localRecommendations/ForVideo?" + qs);
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  }
}
