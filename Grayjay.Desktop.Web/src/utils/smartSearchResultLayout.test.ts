import assert from 'node:assert/strict';
import test from 'node:test';

import { mixSmartSearchResultLanes, STANDARD_SMART_SEARCH_SOURCE } from './smartSearchResultLayout.ts';

type Content = {
    url: string;
    dateTime?: string;
};

const result = (url: string, languages: string[], translatedTitle?: string) => ({
    key: url,
    content: { url },
    originalTitle: url,
    translatedTitle,
    languages
});

test('round-robins lanes while preserving each lane rank', () => {
    const mixed = mixSmartSearchResultLanes<Content>([
        { results: [result('standard-1', [STANDARD_SMART_SEARCH_SOURCE]), result('standard-2', [STANDARD_SMART_SEARCH_SOURCE])] },
        { results: [result('ja-1', ['ja']), result('ja-2', ['ja'])] },
        { results: [result('ar-1', ['ar'])] }
    ]);

    assert.deepEqual(mixed.map(item => item.key), ['standard-1', 'ja-1', 'ar-1', 'standard-2', 'ja-2']);
});

test('deduplicates shared videos and keeps Smart translations', () => {
    const mixed = mixSmartSearchResultLanes<Content>([
        { results: [result('shared', [STANDARD_SMART_SEARCH_SOURCE])] },
        { results: [result('shared', ['ja', 'zh-Hans'], 'Titre traduit')] }
    ]);

    assert.equal(mixed.length, 1);
    assert.deepEqual(mixed[0].languages, [STANDARD_SMART_SEARCH_SOURCE, 'ja', 'zh-Hans']);
    assert.equal(mixed[0].translatedTitle, 'Titre traduit');
});

test('uses the public URL before a local backend URL for deduplication', () => {
    const mixed = mixSmartSearchResultLanes<Content & { backendUrl?: string }>([
        { results: [{ ...result('shared', [STANDARD_SMART_SEARCH_SOURCE]), content: { url: 'shared', backendUrl: 'internal://shared' } }] },
        { results: [result('shared', ['ja'])] }
    ]);

    assert.equal(mixed.length, 1);
    assert.deepEqual(mixed[0].languages, [STANDARD_SMART_SEARCH_SOURCE, 'ja']);
});

test('applies a global comparator after merging', () => {
    const mixed = mixSmartSearchResultLanes<Content>([
        { results: [result('late', [STANDARD_SMART_SEARCH_SOURCE])] },
        { results: [result('early', ['ja'])] }
    ], (first, second) => first.key.localeCompare(second.key));

    assert.deepEqual(mixed.map(item => item.key), ['early', 'late']);
});
