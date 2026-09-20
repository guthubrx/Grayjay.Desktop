import assert from 'node:assert/strict';
import test from 'node:test';

import {
    DEFAULT_SMART_PREFILL_SETTINGS,
    normalizeSmartPrefillSettings,
    smartPrefillUrlKey,
    takePreparationWindow,
    takePrefillCandidates,
    takeUniquePrefillCandidates,
} from './smartPrefill';

test('normalizes Smart Prefill settings within their documented bounds', () => {
    assert.deepEqual(normalizeSmartPrefillSettings(undefined), DEFAULT_SMART_PREFILL_SETTINGS);
    assert.deepEqual(normalizeSmartPrefillSettings({ llmParallelism: 99, maxCandidatesPerSource: 0, preparationDepth: -1, maxQueuedJobs: 999 }), {
        ...DEFAULT_SMART_PREFILL_SETTINGS,
        llmParallelism: 32,
        maxCandidatesPerSource: 1,
        preparationDepth: 0,
        maxQueuedJobs: 500,
    });
});

test('deduplicates candidate videos across YouTube URL variants and honors the cap', () => {
    const scheduled = new Set<string>();
    const candidates = takePrefillCandidates([
        { url: 'https://www.youtube.com/watch?v=first' },
        { url: 'https://youtu.be/first' },
        { url: 'https://www.youtube.com/watch?v=second' },
        { url: 'https://www.youtube.com/watch?v=third' },
    ], 2, scheduled);

    assert.deepEqual(candidates.map(candidate => candidate.url), [
        'https://www.youtube.com/watch?v=first',
        'https://www.youtube.com/watch?v=second',
    ]);
    assert.equal(smartPrefillUrlKey('https://youtu.be/first'), 'youtube:first');
});

test('keeps a bounded preparation window and probes unique candidates without reserving them', () => {
    const videos = [
        { url: 'https://www.youtube.com/watch?v=first' },
        { url: 'https://youtu.be/first' },
        { url: 'https://www.youtube.com/watch?v=second' },
        { url: 'https://www.youtube.com/watch?v=third' },
    ];

    assert.deepEqual(takePreparationWindow(videos, 1, 1).map(video => video.url), [
        'https://youtu.be/first',
        'https://www.youtube.com/watch?v=second',
    ]);
    assert.deepEqual(takeUniquePrefillCandidates(videos, 3).map(video => video.url), [
        'https://www.youtube.com/watch?v=first',
        'https://www.youtube.com/watch?v=second',
        'https://www.youtube.com/watch?v=third',
    ]);
});
