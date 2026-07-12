import assert from "node:assert/strict";
import test from "node:test";

const settings = await import(
    new URL("./smartMixSettings.ts", import.meta.url).href
) as typeof import("./smartMixSettings");

test("falls back to the default distribution for invalid persisted settings", () => {
    assert.deepEqual(
        settings.normalizeSmartMixDistribution({ close: 60, related: 20, newAngle: 10 }),
        settings.DEFAULT_SMART_MIX_DISTRIBUTION,
    );
    assert.deepEqual(
        settings.normalizeSmartMixDistribution({ close: 62, related: 23, newAngle: 15 }),
        settings.DEFAULT_SMART_MIX_DISTRIBUTION,
    );
});

test("accepts only percentages in five-point steps that total one hundred", () => {
    assert.equal(settings.isValidSmartMixDistribution({ close: 60, related: 25, newAngle: 15 }), true);
    assert.equal(settings.isValidSmartMixDistribution({ close: 70, related: 25, newAngle: 0 }), false);
    assert.equal(settings.isValidSmartMixDistribution({ close: 57, related: 28, newAngle: 15 }), false);
});
