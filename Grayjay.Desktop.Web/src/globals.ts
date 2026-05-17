import { Navigator, useNavigate } from "@solidjs/router";
import { HandlingBackend } from "./backend/HandlingBackend";
import { uuidv4 } from "./utility";
import { VideoContextState, VideoContextValue, VideoState, useVideo } from "./contexts/VideoProvider";
import { IPlatformVideo } from "./backend/models/content/IPlatformVideo";
import { Duration } from "luxon";



export default class Globals {
  public static WindowID = uuidv4();


  public static async handleUrl(url: string, video: VideoContextValue, navigate: Navigator, positionSec?: number): Promise<boolean> {
    const executionPlan = await HandlingBackend.handlePlan(url);
    switch(executionPlan.type) {
      case "content": {
        const startSeconds = positionSec ?? Globals.parseUrlTimestamp(url) ?? 0;
        video.actions.openVideoByUrl(executionPlan.data, Duration.fromMillis(startSeconds * 1000));
        return true;
      }
      case "channel":
        navigate("/web/channel?url=" + encodeURIComponent(url));
        video?.actions?.setState(VideoState.Minimized);
        return true;
      case "playlist":
        navigate("/web/remotePlaylist?url=" + encodeURIComponent(url));
        video?.actions?.setState(VideoState.Minimized);
        return true;
      default:
        return false;
    }
  }

  private static parseUrlTimestamp(url: string): number | undefined {
    let raw: string | null;
    try {
      const params = new URL(url).searchParams;
      raw = params.get("t") ?? params.get("start");
    } catch {
      return undefined;
    }
    if (!raw)
      return undefined;
    if (/^\d+$/.test(raw))
      return Number.parseInt(raw, 10);
    const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (!match || !match[0])
      return undefined;
    return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  }
}