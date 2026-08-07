import assert from 'node:assert/strict';
import test from 'node:test';

import type { IPlatformVideo } from '../backend/models/content/IPlatformVideo';
import type { IVideoHighlightEditorialProfile } from '../backend/models/highlights/IVideoHighlightEditorialProfile';
import type { IVideoHighlightSet } from '../backend/models/highlights/IVideoHighlightSet';
import type { IVideoHighlightSummary } from '../backend/models/highlights/IVideoHighlightSummary';

const {
    editorialFreshnessHalfLifeDays,
    editorialScoreFromProfile,
    interestFromSet,
    interestFromSummary,
    interestRatingFromScore,
} = await import(
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

function editorialProfile(overrides: Partial<IVideoHighlightEditorialProfile> = {}): IVideoHighlightEditorialProfile {
    return {
        version: 1,
        genre: 'documentary',
        substance: 0.90,
        rigor: 0.80,
        clarity: 0.85,
        distinctiveness: 0.75,
        audienceValue: 0.80,
        temporalSensitivity: 0.15,
        confidence: 0.85,
        ...overrides,
    };
}

test('keeps editorial interest independent from publication freshness', () => {
    const recent = interestFromSummary(summary('2026-07-11T12:00:00Z'));
    const old = interestFromSummary(summary('2021-07-11T12:00:00Z'));

    assert.equal(recent?.score, old?.score);
    assert.equal(recent?.stars, old?.stars);
});

test('maps the video-interest signal to all ten half-star levels', () => {
    const cases = [
        { score: 0, stars: 0.5, label: 'Très faible', text: '0,5 / 5' },
        { score: 0.15, stars: 1, label: 'Faible', text: '1,0 / 5' },
        { score: 0.30, stars: 1.5, label: 'Anecdotique', text: '1,5 / 5' },
        { score: 0.39, stars: 2, label: 'À picorer', text: '2,0 / 5' },
        { score: 0.48, stars: 2.5, label: 'Utile', text: '2,5 / 5' },
        { score: 0.57, stars: 3, label: 'Intéressante', text: '3,0 / 5' },
        { score: 0.66, stars: 3.5, label: 'Très intéressante', text: '3,5 / 5' },
        { score: 0.74, stars: 4, label: 'Remarquable', text: '4,0 / 5' },
        { score: 0.82, stars: 4.5, label: 'Excellente', text: '4,5 / 5' },
        { score: 0.91, stars: 5, label: 'Passionnante', text: '5,0 / 5' },
    ];

    for (const expected of cases) {
        const rating = interestRatingFromScore(expected.score);
        assert.equal(rating.stars, expected.stars);
        assert.equal(rating.label, expected.label);
        assert.equal(rating.text, expected.text);
        assert.equal(rating.ariaLabel, `${expected.text} étoiles sur 5 - ${expected.label}`);
    }
});

test('keeps half-star thresholds deterministic and bounds invalid scores', () => {
    assert.equal(interestRatingFromScore(0.149).stars, 0.5);
    assert.equal(interestRatingFromScore(0.299).stars, 1);
    assert.equal(interestRatingFromScore(0.909).stars, 4.5);
    assert.equal(interestRatingFromScore(Number.NaN).stars, 0.5);
    assert.equal(interestRatingFromScore(Number.POSITIVE_INFINITY).stars, 0.5);
});

test('derives a rating from legacy highlights without requiring regeneration', () => {
    const legacySet = {
        schemaVersion: 1,
        videoUrl: 'https://example.com/video',
        source: 'test',
        createdAt: '2026-08-06T12:00:00Z',
        updatedAt: '2026-08-06T12:00:00Z',
        segments: [
            { start: 0, end: 180, title: 'Intro', summary: 'Introduction', score: 0.32 },
            { start: 180, end: 420, title: 'Key point', summary: 'Useful detail', score: 0.82 },
        ],
    } as IVideoHighlightSet;

    const interest = interestFromSet(legacySet);

    assert.ok(interest);
    assert.equal(interest.score > 0, true);
    assert.equal(interest.stars % 0.5, 0);
});

test('derives a rating from the compact data retained for video cards', () => {
    const interest = interestFromSummary({
        segmentCount: 5,
        totalDuration: 1_000,
        interestingDuration: 700,
        averageScore: 0.81,
        topScore: 0.96,
        strongSegmentCount: 3,
        excellentSegmentCount: 1,
    }, { duration: 1_200 } as IPlatformVideo);

    assert.ok(interest);
    assert.equal(interest.ratingText, '3,5 / 5');
    assert.equal(interest.label, 'Très intéressante');
});

test('derives a stable rating from a valid editorial profile', () => {
    const profile = editorialProfile();
    const recent = interestFromSummary({ ...summary('2026-07-11T12:00:00Z'), editorialProfile: profile });
    const old = interestFromSummary({ ...summary('2021-07-11T12:00:00Z'), editorialProfile: profile });

    assert.equal(editorialScoreFromProfile(profile), 0.8305);
    assert.equal(recent?.score, old?.score);
    assert.equal(recent?.stars, 4.5);
    assert.equal(recent?.hasEditorialProfile, true);
});

test('keeps temporal sensitivity outside the editorial rating', () => {
    const durable = editorialProfile({ temporalSensitivity: 0.05 });
    const timely = editorialProfile({ temporalSensitivity: 0.95 });

    assert.equal(editorialScoreFromProfile(durable), editorialScoreFromProfile(timely));
    assert.ok((editorialFreshnessHalfLifeDays(durable) ?? 0) > (editorialFreshnessHalfLifeDays(timely) ?? 0));
});

test('falls back to chapter interest when an editorial profile is invalid', () => {
    const interest = interestFromSummary({
        ...summary('2026-07-11T12:00:00Z'),
        editorialProfile: editorialProfile({ genre: 'unknown' }),
    });

    assert.equal(interest?.hasEditorialProfile, false);
    assert.equal(interest?.ratingText, '3,5 / 5');
});

test('does not invent a rating when no highlight signal exists', () => {
    assert.equal(interestFromSummary(undefined), undefined);
    assert.equal(interestFromSet({
        schemaVersion: 1,
        videoUrl: 'https://example.com/video',
        createdAt: '2026-08-06T12:00:00Z',
        updatedAt: '2026-08-06T12:00:00Z',
        segments: [],
    }), undefined);
});
