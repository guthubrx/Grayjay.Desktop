import assert from "node:assert/strict";
import test from "node:test";

import {
    defaultSubtitleTranslationLanguages,
    normalizeSmartSearchLanguages,
    normalizeSubtitleTranslationLanguages
} from "./smartSearchLanguagePreferences.ts";

const supported = new Set(["en", "fr", "ja", "ru", "zh-Hans"]);

test("keeps only supported unique Smart Search languages", () => {
    assert.deepEqual(
        normalizeSmartSearchLanguages(["ja", "unknown", "ja", "ru", "en"], supported, 3),
        ["ja", "ru", "en"]
    );
});

test("migrates selected non-French and non-English search languages to subtitle translation", () => {
    assert.deepEqual(
        defaultSubtitleTranslationLanguages(["ja", "en", "zh-Hans", "fr", "ru"]),
        ["ja", "zh-Hans", "ru"]
    );
});

test("drops subtitle translation languages no longer selected for Smart Search", () => {
    assert.deepEqual(
        normalizeSubtitleTranslationLanguages(["ja", "ru", "ja", "en"], ["ja", "en"]),
        ["ja", "en"]
    );
});
