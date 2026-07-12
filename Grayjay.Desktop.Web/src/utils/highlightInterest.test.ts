import assert from 'node:assert/strict';
import test from 'node:test';

import type { IPlatformVideo } from '../backend/models/content/IPlatformVideo';
import type { IVideoHighlightSummary } from '../backend/models/highlights/IVideoHighlightSummary';

const { interestFromSummary } = await import(
    new URL('./highlightInterest.ts', import.meta.url).href
) as typeof import('./highlightInterest');

function summary(dateTime: string): IVideoHighlightSummary {
    return {
        videoUrl: 'https://example.com/video',
        source: 'test',
        updatedAt: '2026-07-12T12:00:00Z',
        segmentCount: 5,
        totalDuration: 1_000,
        interestingDuration: 700,
        averageScore: 0.81,
        topScore: 0.96,
        strongSegmentCount: 3,
        excellentSegmentCount: 1,
        video: { dateTime } as IPlatformVideo,
    };
}

test('keeps editorial interest independent from publication freshness', () => {
    const recent = interestFromSummary(summary('2026-07-11T12:00:00Z'));
    const old = interestFromSummary(summary('2021-07-11T12:00:00Z'));

    assert.equal(recent?.score, old?.score);
    assert.equal(recent?.stars, old?.stars);
});
