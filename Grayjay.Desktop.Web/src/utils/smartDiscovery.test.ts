import assert from 'node:assert/strict';
import test from 'node:test';

import type { ISmartSearchSession } from '../backend/SmartSearchBackend';

const { smartDiscoveryQuery, smartDiscoveryVideos } = await import(
    new URL('./smartDiscovery.ts', import.meta.url).href
) as typeof import('./smartDiscovery');

test('builds a French discovery query enriched with canonical profile labels', () => {
    assert.equal(smartDiscoveryQuery({
        topics: ['ai agents', 'developer productivity'],
        relatedTopics: ['software engineering'],
    }, 'Presentation des nouveaux outils.'), 'Presentation des nouveaux outils. ai agents developer productivity software engineering');
});

test('falls back to the global summary when no profile label exists', () => {
    assert.equal(smartDiscoveryQuery(undefined, 'A concise summary.\nIgnored continuation.'), 'A concise summary.');
});

test('truncates a long summary at a natural clause boundary', () => {
    const summary = 'Cette video explique que le climatiseur et la pompe a chaleur sont une meme machine, puis developpe longuement les effets des normes sur la sante publique et les politiques de rafraichissement dans les villes francaises.';
    assert.equal(smartDiscoveryQuery(undefined, summary), 'Cette video explique que le climatiseur et la pompe a chaleur sont une meme machine');
});

test('deduplicates search videos and excludes the source', () => {
    const session = {
        sessionId: 'test',
        variants: [{ language: 'ja', query: 'query', status: 'ready', results: [
            { key: 'source', content: { url: 'https://www.youtube.com/watch?v=source' } },
            { key: 'first', content: { url: 'https://www.youtube.com/watch?v=first' } },
            { key: 'duplicate', content: { url: 'https://youtu.be/first' } },
            { key: 'second', content: { url: 'https://www.youtube.com/watch?v=second' } },
        ] }]
    } as unknown as ISmartSearchSession;

    assert.deepEqual(smartDiscoveryVideos(session, 'https://youtu.be/source', 2).map(video => video.url), [
        'https://www.youtube.com/watch?v=first',
        'https://www.youtube.com/watch?v=second',
    ]);
});
