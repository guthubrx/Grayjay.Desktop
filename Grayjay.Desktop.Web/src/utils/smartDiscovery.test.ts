import assert from 'node:assert/strict';
import test from 'node:test';

import type { ISmartSearchSession } from '../backend/SmartSearchBackend';
import { smartDiscoveryPlan, smartDiscoveryQuery, smartDiscoveryUserLanguage, smartDiscoveryVideos } from './smartDiscovery';

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

test('builds the four ordered discovery axes for the normalized user language', () => {
    const plan = smartDiscoveryPlan({
        version: 1,
        axes: ["core", "context", "impact", "debate"].map(id => ({ id, label: id, queries: { en: `${id} English`, fr: `${id} Francais` } })),
    }, 'fr-FR');

    assert.equal(plan?.userLanguage, 'fr');
    assert.deepEqual(plan?.axes.map(axis => axis.id), ['core', 'context', 'impact', 'debate']);
});

test('prefers a core result when metadata signals are otherwise equal', () => {
    const session = {
        sessionId: 'test',
        variants: [
            { id: '0:fr:debate', language: 'fr', axis: 'debate', stage: 0, query: 'debat', status: 'ready', results: [{ key: 'debate', content: { url: 'https://www.youtube.com/watch?v=debate', viewCount: 100, dateTime: '2026-07-01' } }] },
            { id: '0:fr:core', language: 'fr', axis: 'core', stage: 0, query: 'core', status: 'ready', results: [{ key: 'core', content: { url: 'https://www.youtube.com/watch?v=core', viewCount: 100, dateTime: '2026-07-01' } }] },
        ]
    } as unknown as ISmartSearchSession;

    assert.deepEqual(smartDiscoveryVideos(session, 'https://youtu.be/source', 2).map(video => video.url), [
        'https://www.youtube.com/watch?v=core',
        'https://www.youtube.com/watch?v=debate',
    ]);
});

test('uses completed Smart Chapter interest to rerank a discovery tail', () => {
    const session = {
        sessionId: 'test',
        variants: [{ language: 'en', axis: 'core', query: 'query', status: 'ready', results: [
            { key: 'unscored', content: { url: 'https://www.youtube.com/watch?v=unscored', viewCount: 100, dateTime: '2026-07-01', duration: 1200 } },
            { key: 'scored', content: { url: 'https://www.youtube.com/watch?v=scored', viewCount: 100, dateTime: '2026-07-01', duration: 1200 } },
        ] }]
    } as unknown as ISmartSearchSession;

    assert.deepEqual(smartDiscoveryVideos(session, 'https://youtu.be/source', 2, [{
        videoUrl: 'https://youtu.be/scored',
        source: 'external',
        updatedAt: '2026-07-13',
        segmentCount: 4,
        totalDuration: 900,
        interestingDuration: 850,
        averageScore: 0.96,
        topScore: 0.98,
        strongSegmentCount: 4,
        excellentSegmentCount: 3,
    }]).map(video => video.url), [
        'https://www.youtube.com/watch?v=scored',
        'https://www.youtube.com/watch?v=unscored',
    ]);
});

test('normalizes browser language tags used by discovery stages', () => {
    assert.equal(smartDiscoveryUserLanguage('zh-TW'), 'zh-Hant');
    assert.equal(smartDiscoveryUserLanguage('fr-FR'), 'fr');
});
