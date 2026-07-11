import assert from 'node:assert/strict';
import test from 'node:test';

import type { SubscriptionPagerCandidate } from './subscriptionBootstrap';

const { selectSubscriptionPager } = await import(
    new URL('./subscriptionBootstrap.ts', import.meta.url).href
) as typeof import('./subscriptionBootstrap');

function candidate(value: string, itemCount = 1): SubscriptionPagerCandidate<string> {
    return { value, itemCount };
}

test('keeps the bootstrap pager while cache and live pagers are pending', () => {
    const bootstrap = candidate('bootstrap');

    assert.equal(selectSubscriptionPager({ bootstrap }), bootstrap);
});

test('replaces bootstrap with a usable cache pager', () => {
    const bootstrap = candidate('bootstrap');
    const cache = candidate('cache');

    assert.equal(selectSubscriptionPager({ bootstrap, cache }), cache);
});

test('uses the live pager after its initial update', () => {
    const cache = candidate('cache');
    const live = candidate('live');

    assert.equal(selectSubscriptionPager({ cache, live, liveReady: true }), live);
});

test('uses a live pager when no cache or bootstrap data exists', () => {
    const live = candidate('live');

    assert.equal(selectSubscriptionPager({ live }), live);
});

test('never selects an empty bootstrap or cache pager', () => {
    const live = candidate('live');

    assert.equal(selectSubscriptionPager({ bootstrap: candidate('empty-bootstrap', 0), cache: candidate('empty-cache', 0), live }), live);
});
