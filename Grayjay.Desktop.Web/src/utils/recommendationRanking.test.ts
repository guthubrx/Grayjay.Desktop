import assert from 'node:assert/strict';
import test from 'node:test';

import type { RecommendationCandidate } from './recommendationRanking';

const { rankRecommendationCandidates } = await import(
    new URL('./recommendationRanking.ts', import.meta.url).href
) as typeof import('./recommendationRanking');

const now = Date.parse('2026-07-12T12:00:00Z');

function candidate(overrides: Partial<RecommendationCandidate> & Pick<RecommendationCandidate, 'key'>): RecommendationCandidate {
    return { fallbackOrder: 0, ...overrides };
}

test('keeps editorial value ahead of raw view count', () => {
    const ranked = rankRecommendationCandidates([
        candidate({
            key: 'popular-old',
            viewCount: 10_000_000,
            publishedAt: '2023-07-12T12:00:00Z',
            contentInterest: 0.2,
        }),
        candidate({
            key: 'editorial-recent',
            viewCount: 20_000,
            publishedAt: '2026-07-10T12:00:00Z',
            contentInterest: 0.9,
        }),
    ], now);

    assert.equal(ranked[0]?.candidate.key, 'editorial-recent');
    assert.ok((ranked.find(item => item.candidate.key === 'popular-old')?.signals.popularity ?? 0) > 0);
});

test('does not penalize a candidate when optional metadata is absent', () => {
    const ranked = rankRecommendationCandidates([
        candidate({ key: 'known', contentInterest: 0.7, fallbackOrder: 1 }),
        candidate({ key: 'unknown', contentInterest: 0.8, fallbackOrder: 0 }),
    ], now);

    assert.equal(ranked[0]?.candidate.key, 'unknown');
    assert.equal(ranked[0]?.signals.popularity, undefined);
    assert.equal(ranked[0]?.signals.freshness, undefined);
});

test('uses a stable fallback order when available signals are equal', () => {
    const ranked = rankRecommendationCandidates([
        candidate({ key: 'second', fallbackOrder: 1 }),
        candidate({ key: 'first', fallbackOrder: 0 }),
    ], now);

    assert.deepEqual(ranked.map(item => item.candidate.key), ['first', 'second']);
});

test('uses semantic relevance when an optional caller provides it', () => {
    const ranked = rankRecommendationCandidates([
        candidate({ key: 'broad', semanticRelevance: 0.45, fallbackOrder: 0 }),
        candidate({ key: 'precise', semanticRelevance: 0.92, fallbackOrder: 1 }),
    ], now);

    assert.equal(ranked[0]?.candidate.key, 'precise');
    assert.ok((ranked[0]?.signals.semanticRelevance ?? 0) > 0.9);
});

test('keeps the historical freshness curve when no editorial horizon is available', () => {
    const ranked = rankRecommendationCandidates([
        candidate({ key: 'legacy', publishedAt: '2026-06-21T12:00:00Z' }),
    ], now);

    assert.equal(ranked[0]?.signals.freshness, 0.5);
});

test('keeps durable editorial videos discoverable longer than timely ones', () => {
    const ranked = rankRecommendationCandidates([
        candidate({
            key: 'timely',
            publishedAt: '2026-05-13T12:00:00Z',
            freshnessHalfLifeDays: 30,
        }),
        candidate({
            key: 'durable',
            publishedAt: '2026-05-13T12:00:00Z',
            freshnessHalfLifeDays: 365,
        }),
    ], now);

    assert.equal(ranked[0]?.candidate.key, 'durable');
    assert.ok((ranked[0]?.signals.freshness ?? 0) > (ranked[1]?.signals.freshness ?? 0));
});
