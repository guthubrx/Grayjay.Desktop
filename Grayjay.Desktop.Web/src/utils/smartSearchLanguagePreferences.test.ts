import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSmartSearchLanguages } from "./smartSearchLanguagePreferences.ts";

const supported = new Set(["en", "fr", "ja", "ru", "zh-Hans"]);

test("keeps only supported unique Smart Search languages", () => {
    assert.deepEqual(
        normalizeSmartSearchLanguages(["ja", "unknown", "ja", "ru", "en"], supported, 3),
        ["ja", "ru", "en"]
    );
});
