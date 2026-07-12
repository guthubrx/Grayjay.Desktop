import { createSignal } from "solid-js";
import { Backend } from "../backend/Backend";
import { SettingsBackend } from "../backend/SettingsBackend";
import type { SmartMixDistribution } from "../utils/smartMixComposer";
import {
    DEFAULT_SMART_MIX_DISTRIBUTION,
    isValidSmartMixDistribution,
    normalizeSmartMixDistribution,
} from "../utils/smartMixSettings";

export { DEFAULT_SMART_MIX_DISTRIBUTION, isValidSmartMixDistribution, normalizeSmartMixDistribution } from "../utils/smartMixSettings";

const [smartMixDistribution$, setSmartMixDistributionSignal] = createSignal<SmartMixDistribution>(DEFAULT_SMART_MIX_DISTRIBUTION);
const [smartMixSettingsReady$, setSmartMixSettingsReadySignal] = createSignal(false);

(async () => {
    try {
        const raw: any = await Backend.GET("/settings/PersistGet?key=smartMix.settings");
        const settings = typeof raw === "string" ? JSON.parse(raw) : raw;
        setSmartMixDistributionSignal(normalizeSmartMixDistribution(settings?.distribution));
    } catch {
        // Smart Mix remains available with its local defaults.
    } finally {
        setSmartMixSettingsReadySignal(true);
    }
})();

export { smartMixDistribution$, smartMixSettingsReady$ };

export async function setSmartMixDistribution(distribution: SmartMixDistribution): Promise<boolean> {
    if (!isValidSmartMixDistribution(distribution)) return false;

    setSmartMixDistributionSignal(distribution);
    await SettingsBackend.persistSet("smartMix.settings", { distribution });
    return true;
}
