import assert from "node:assert/strict";
import test from "node:test";

const { replaceUnplayedSmartMixTail } = await import(
    new URL("./smartMixQueue.ts", import.meta.url).href
) as typeof import("./smartMixQueue");

const video = (url: string) => ({ url }) as any;

test("replaces only the unplayed Smart Mix tail for the active session", () => {
    const queue = [video("played"), video("current"), video("old-next")];
    const metadata = [
        { source: "smart-mix", sessionId: "mix-1" },
        { source: "smart-mix", sessionId: "mix-1" },
        { source: "smart-mix", sessionId: "mix-1" },
    ];

    const result = replaceUnplayedSmartMixTail(queue, metadata, 1, "mix-1", [video("new-next")], [{ source: "smart-mix", sessionId: "mix-1" }]);

    assert.deepEqual(result?.queue.map(item => item.url), ["played", "current", "new-next"]);
    assert.equal(result?.metadata[1]?.sessionId, "mix-1");
});

test("does not mutate another queue or another Smart Mix session", () => {
    const queue = [video("current"), video("next")];
    const metadata = [{ source: "smart-mix", sessionId: "mix-1" }, { source: "smart-mix", sessionId: "mix-1" }];

    assert.equal(replaceUnplayedSmartMixTail(queue, metadata, 0, "mix-2", [video("new")], []), undefined);
    assert.equal(replaceUnplayedSmartMixTail(queue, [{ source: "other" }], 0, "mix-1", [video("new")], []), undefined);
});
