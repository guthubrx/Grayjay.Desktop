import assert from "node:assert/strict";
import test from "node:test";

import type {
    SmartMixCandidate,
    SmartMixSettings,
} from "./smartMixComposer";

const { composeSmartMix } = await import(
    new URL("./smartMixComposer.ts", import.meta.url).href
) as typeof import("./smartMixComposer");

const settings: SmartMixSettings = {
    maxVideos: 8,
    targetSeconds: 24 * 60 * 60,
    creatorVariety: true,
    distribution: { close: 60, related: 25, newAngle: 15 },
};

function candidate(overrides: Partial<SmartMixCandidate> & Pick<SmartMixCandidate, "videoUrl">): SmartMixCandidate {
    return {
        video: {
            url: overrides.videoUrl,
            duration: 300,
            author: { url: "creator-a" },
        },
        updatedAt: "2026-07-12T12:00:00Z",
        topScore: 0.8,
        segments: [{ start: 60, end: 180, title: "AI agents", summary: "AI agents and developer workflows", score: 0.8 }],
        mixProfile: {
            topics: ["ai agents"],
            relatedTopics: [],
            angleLabels: ["implementation workflow"],
        },
        ...overrides,
    };
}

const source = candidate({
    videoUrl: "source",
    mixProfile: {
        topics: ["ai agents"],
        relatedTopics: ["developer productivity"],
        angleLabels: ["implementation workflow"],
    },
});

function categoryCounts(result: ReturnType<typeof composeSmartMix>) {
    return result.reduce((counts, item) => {
        counts[item.category]++;
        return counts;
    }, { close: 0, related: 0, newAngle: 0 });
}

test("respects the default 60/25/15 editorial distribution when the pool supports it", () => {
    const candidates = [
        ...Array.from({ length: 5 }, (_, index) => candidate({ videoUrl: `close-${index}`, topScore: 0.95 - index / 100, video: { url: `close-${index}`, duration: 300, author: { url: `close-creator-${index}` } } })),
        ...Array.from({ length: 2 }, (_, index) => candidate({ videoUrl: `related-${index}`, mixProfile: { topics: ["developer productivity"], relatedTopics: [], angleLabels: ["case study"] }, video: { url: `related-${index}`, duration: 300, author: { url: `related-creator-${index}` } } })),
        candidate({ videoUrl: "angle-0", mixProfile: { topics: ["ai agents"], relatedTopics: [], angleLabels: ["risk assessment"] }, video: { url: "angle-0", duration: 300, author: { url: "angle-creator" } } }),
    ];

    assert.deepEqual(categoryCounts(composeSmartMix(source, candidates, settings)), { close: 5, related: 2, newAngle: 1 });
});

test("uses deterministic largest-remainder rounding for editorial quotas", () => {
    const candidates = [
        ...Array.from({ length: 4 }, (_, index) => candidate({ videoUrl: `close-${index}`, video: { url: `close-${index}`, duration: 300, author: { url: `close-${index}` } } })),
        ...Array.from({ length: 2 }, (_, index) => candidate({ videoUrl: `related-${index}`, mixProfile: { topics: ["developer productivity"], relatedTopics: [], angleLabels: [] }, video: { url: `related-${index}`, duration: 300, author: { url: `related-${index}` } } })),
        candidate({ videoUrl: "angle", mixProfile: { topics: ["ai agents"], relatedTopics: [], angleLabels: ["risk assessment"] }, video: { url: "angle", duration: 300, author: { url: "angle" } } }),
    ];

    const result = composeSmartMix(source, candidates, { ...settings, maxVideos: 7 });
    assert.deepEqual(categoryCounts(result), { close: 4, related: 2, newAngle: 1 });
});

test("redistributes an unavailable category without adding unrelated videos", () => {
    const candidates = [
        candidate({ videoUrl: "close-a", video: { url: "close-a", duration: 300, author: { url: "a" } } }),
        candidate({ videoUrl: "close-b", video: { url: "close-b", duration: 300, author: { url: "b" } } }),
        candidate({ videoUrl: "related-a", mixProfile: { topics: ["developer productivity"], relatedTopics: [], angleLabels: [] }, video: { url: "related-a", duration: 300, author: { url: "c" } } }),
        candidate({ videoUrl: "related-b", mixProfile: { topics: ["developer productivity"], relatedTopics: [], angleLabels: [] }, video: { url: "related-b", duration: 300, author: { url: "d" } } }),
        candidate({ videoUrl: "angle", mixProfile: { topics: ["ai agents"], relatedTopics: [], angleLabels: ["risk assessment"] }, video: { url: "angle", duration: 300, author: { url: "e" } } }),
        candidate({ videoUrl: "unrelated", mixProfile: { topics: ["agriculture policy"], relatedTopics: [], angleLabels: [] }, video: { url: "unrelated", duration: 300, author: { url: "f" } } }),
    ];

    const result = composeSmartMix(source, candidates, {
        ...settings,
        maxVideos: 5,
        distribution: { close: 40, related: 20, newAngle: 40 },
    });

    assert.equal(result.length, 5);
    assert.ok(!result.some(item => item.candidate.videoUrl === "unrelated"));
    assert.deepEqual(categoryCounts(result), { close: 2, related: 2, newAngle: 1 });
});

test("prefers an unwatched video and creator variety when relevance is comparable", () => {
    const candidates = [
        candidate({ videoUrl: "watched", topScore: 0.99, video: { url: "watched", duration: 300, author: { url: "creator-a" } } }),
        candidate({ videoUrl: "same-creator", topScore: 0.95, video: { url: "same-creator", duration: 300, author: { url: "creator-a" } } }),
        candidate({ videoUrl: "new-creator", topScore: 0.9, video: { url: "new-creator", duration: 300, author: { url: "creator-b" } } }),
    ];

    const result = composeSmartMix(source, candidates, {
        ...settings,
        maxVideos: 2,
        distribution: { close: 100, related: 0, newAngle: 0 },
        watchedUrls: new Set(["watched"]),
    });

    assert.deepEqual(result.map(item => item.candidate.videoUrl), ["same-creator", "new-creator"]);
});

test("keeps creator variety within one editorial category", () => {
    const candidates = [
        candidate({ videoUrl: "creator-a-first", topScore: 0.99, video: { url: "creator-a-first", duration: 300, author: { url: "creator-a" } } }),
        candidate({ videoUrl: "creator-a-second", topScore: 0.98, video: { url: "creator-a-second", duration: 300, author: { url: "creator-a" } } }),
        candidate({ videoUrl: "creator-b", topScore: 0.8, video: { url: "creator-b", duration: 300, author: { url: "creator-b" } } }),
    ];

    const result = composeSmartMix(source, candidates, {
        ...settings,
        maxVideos: 2,
        distribution: { close: 100, related: 0, newAngle: 0 },
    });

    assert.deepEqual(result.map(item => item.candidate.videoUrl), ["creator-a-first", "creator-b"]);
});

test("recognizes watched YouTube videos with an equivalent URL", () => {
    const candidates = [
        candidate({ videoUrl: "https://www.youtube.com/watch?v=watched", topScore: 0.99 }),
        candidate({ videoUrl: "https://www.youtube.com/watch?v=unwatched", topScore: 0.8 }),
    ];

    const result = composeSmartMix(source, candidates, {
        ...settings,
        maxVideos: 1,
        distribution: { close: 100, related: 0, newAngle: 0 },
        watchedUrls: new Set(["https://youtu.be/watched"]),
    });

    assert.deepEqual(result.map(item => item.candidate.videoUrl), ["https://www.youtube.com/watch?v=unwatched"]);
});

test("does not exceed the target duration once another video is selected", () => {
    const candidates = [
        candidate({ videoUrl: "close", video: { url: "close", duration: 3600, author: { url: "close" } } }),
        candidate({ videoUrl: "related", mixProfile: { topics: ["developer productivity"], relatedTopics: [], angleLabels: [] }, video: { url: "related", duration: 3600, author: { url: "related" } } }),
        candidate({ videoUrl: "angle", mixProfile: { topics: ["ai agents"], relatedTopics: [], angleLabels: ["risk assessment"] }, video: { url: "angle", duration: 3600, author: { url: "angle" } } }),
    ];

    const result = composeSmartMix(source, candidates, {
        ...settings,
        maxVideos: 3,
        targetSeconds: 1800,
        distribution: { close: 34, related: 33, newAngle: 33 },
    });

    assert.deepEqual(result.map(item => item.candidate.videoUrl), ["close"]);
});

test("excludes the source and duplicate video URLs", () => {
    const result = composeSmartMix(source, [
        source,
        candidate({ videoUrl: "duplicate", topScore: 0.9 }),
        candidate({ videoUrl: "duplicate", topScore: 0.7 }),
    ], { ...settings, maxVideos: 2, distribution: { close: 100, related: 0, newAngle: 0 } });

    assert.deepEqual(result.map(item => item.candidate.videoUrl), ["duplicate"]);
});

test("uses summaries and theses as a fallback for legacy highlights", () => {
    const legacySource = candidate({
        videoUrl: "legacy-source",
        mixProfile: undefined,
        globalSummary: "Artificial intelligence agents improve developer workflows.",
        theses: [{ id: 1, statement: "AI agents help software developers automate repetitive work." }],
    });
    const legacyCandidate = candidate({
        videoUrl: "legacy-candidate",
        mixProfile: undefined,
        globalSummary: "Developer workflows with artificial intelligence agents.",
        theses: [{ id: 1, statement: "Software teams use AI agents for implementation work." }],
    });

    const result = composeSmartMix(legacySource, [legacyCandidate], { ...settings, maxVideos: 1, distribution: { close: 100, related: 0, newAngle: 0 } });

    assert.equal(result[0]?.category, "close");
    assert.equal(result[0]?.relevantSegment?.start, 60);
});

test("matches a versioned canonical topic without dropping its version number", () => {
    const result = composeSmartMix(candidate({
        videoUrl: "source",
        mixProfile: {
            topics: ["Grok 4.5"],
            relatedTopics: [],
            angleLabels: ["benchmark comparison"],
        },
    }), [candidate({
        videoUrl: "grok-4-5",
        mixProfile: {
            topics: ["Grok 4.5", "model benchmarking"],
            relatedTopics: [],
            angleLabels: ["benchmark comparison"],
        },
    })], { ...settings, maxVideos: 1, distribution: { close: 100, related: 0, newAngle: 0 } });

    assert.equal(result[0]?.candidate.videoUrl, "grok-4-5");
    assert.equal(result[0]?.category, "close");
});

test("uses canonical related topics to connect adjacent subjects", () => {
    const result = composeSmartMix(candidate({
        videoUrl: "source",
        mixProfile: {
            topics: ["AI co-founder workflow"],
            relatedTopics: ["developer productivity"],
            angleLabels: ["live demo"],
        },
    }), [candidate({
        videoUrl: "harness",
        mixProfile: {
            topics: ["AI agent harnesses", "developer productivity"],
            relatedTopics: [],
            angleLabels: ["live coding demo"],
        },
    })], { ...settings, maxVideos: 1, distribution: { close: 0, related: 100, newAngle: 0 } });

    assert.equal(result[0]?.candidate.videoUrl, "harness");
    assert.equal(result[0]?.category, "related");
});

test("does not connect topics using only generic label words", () => {
    const result = composeSmartMix(candidate({
        videoUrl: "source",
        mixProfile: {
            topics: ["open-source AI models"],
            relatedTopics: [],
            angleLabels: ["weekly news roundup"],
        },
    }), [candidate({
        videoUrl: "irrigation",
        mixProfile: {
            topics: ["open-source irrigation management"],
            relatedTopics: [],
            angleLabels: ["installation guide"],
        },
    })], { ...settings, maxVideos: 1, distribution: { close: 50, related: 50, newAngle: 0 } });

    assert.deepEqual(result, []);
});

test("returns the same order when all ranking inputs are equal", () => {
    const candidates = [candidate({ videoUrl: "zeta" }), candidate({ videoUrl: "alpha" })];

    const first = composeSmartMix(source, candidates, { ...settings, maxVideos: 2, distribution: { close: 100, related: 0, newAngle: 0 } });
    const second = composeSmartMix(source, candidates, { ...settings, maxVideos: 2, distribution: { close: 100, related: 0, newAngle: 0 } });

    assert.deepEqual(first.map(item => item.candidate.videoUrl), ["alpha", "zeta"]);
    assert.deepEqual(first.map(item => item.candidate.videoUrl), second.map(item => item.candidate.videoUrl));
});
