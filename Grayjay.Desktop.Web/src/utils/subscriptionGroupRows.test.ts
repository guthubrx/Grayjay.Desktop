import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeSubscriptionGroupRows } from './subscriptionGroupRows.ts';

type Video = {
    url: string;
    dateTime: string;
};

test('keeps existing group videos when an incoming page is smaller', () => {
    const rows = mergeSubscriptionGroupRows<Video>(
        [{
            name: 'AI',
            videos: [
                { url: 'video-1', dateTime: '2026-07-11T12:00:00Z' },
                { url: 'video-2', dateTime: '2026-07-11T11:00:00Z' }
            ]
        }],
        [{
            name: 'AI',
            videos: [{ url: 'video-1', dateTime: '2026-07-11T12:00:00Z' }]
        }],
        20
    );

    assert.deepEqual(rows[0].videos.map(video => video.url), ['video-1', 'video-2']);
});

test('adds newer videos, deduplicates by URL, and enforces the row limit', () => {
    const rows = mergeSubscriptionGroupRows<Video>(
        [{ name: 'AI', videos: [{ url: 'video-1', dateTime: '2026-07-10T12:00:00Z' }] }],
        [{
            name: 'AI',
            videos: [
                { url: 'video-1', dateTime: '2026-07-10T12:00:00Z' },
                { url: 'video-2', dateTime: '2026-07-11T12:00:00Z' },
                { url: 'video-3', dateTime: '2026-07-09T12:00:00Z' }
            ]
        }],
        2
    );

    assert.deepEqual(rows[0].videos.map(video => video.url), ['video-2', 'video-1']);
});
