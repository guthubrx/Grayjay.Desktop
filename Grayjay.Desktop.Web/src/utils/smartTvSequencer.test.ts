import assert from 'node:assert/strict';
import test from 'node:test';

import type {
    SmartTvCandidate,
    SmartTvSequencerSettings,
} from './smartTvSequencer';

const { sequenceSmartTvCandidates } = await import(
    new URL('./smartTvSequencer.ts', import.meta.url).href
) as typeof import('./smartTvSequencer');

const settings: SmartTvSequencerSettings = {
    targetSeconds: 900,
    maxVideos: 4,
    maxChapters: 4,
    maxChaptersPerVideo: 1,
    minimumScore: 0.55,
    repeatVideoPenalty: 0.04,
    creatorVarietyPenalty: 0.06,
    editorialMix: 'balanced',
};

function candidate(overrides: Partial<SmartTvCandidate> & Pick<SmartTvCandidate, 'chapterKey'>): SmartTvCandidate {
    return {
        score: 0.8,
        durationSeconds: 180,
        videoKey: overrides.chapterKey.split(':')[0],
        creatorKey: 'creator-a',
        subjectText: 'artificial intelligence agents workflow',
        ...overrides,
    };
}

test('selects the highest-score eligible chapter as the anchor', () => {
    const result = sequenceSmartTvCandidates([
        candidate({ chapterKey: 'lower:0-180', score: 0.76 }),
        candidate({ chapterKey: 'anchor:0-180', score: 0.94 }),
    ], new Set(), settings);

    assert.equal(result[0]?.candidate.chapterKey, 'anchor:0-180');
});

test('excludes played chapters without excluding other chapters from the same video', () => {
    const result = sequenceSmartTvCandidates([
        candidate({ chapterKey: 'video-a:0-180', videoKey: 'video-a', score: 0.94 }),
        candidate({ chapterKey: 'video-a:200-380', videoKey: 'video-a', score: 0.91 }),
        candidate({ chapterKey: 'video-b:0-180', videoKey: 'video-b', score: 0.9 }),
    ], new Set(['video-a:0-180']), { ...settings, maxChaptersPerVideo: 2 });

    assert.ok(result.some(item => item.candidate.chapterKey === 'video-a:200-380'));
});

test('never exceeds the hard video and per-video chapter caps', () => {
    const result = sequenceSmartTvCandidates([
        candidate({ chapterKey: 'video-a:0-180', videoKey: 'video-a', score: 0.96 }),
        candidate({ chapterKey: 'video-a:200-380', videoKey: 'video-a', score: 0.95 }),
        candidate({ chapterKey: 'video-b:0-180', videoKey: 'video-b', score: 0.94 }),
        candidate({ chapterKey: 'video-c:0-180', videoKey: 'video-c', score: 0.93 }),
    ], new Set(), { ...settings, maxVideos: 2, maxChapters: 3, maxChaptersPerVideo: 1 });

    assert.deepEqual(result.map(item => item.candidate.videoKey), ['video-a', 'video-b']);
});

test('labels a related candidate as same topic when it deepens the anchor', () => {
    const result = sequenceSmartTvCandidates([
        candidate({ chapterKey: 'anchor:0-180', score: 0.96, creatorKey: 'creator-a', subjectText: 'artificial intelligence agents workflow' }),
        candidate({ chapterKey: 'depth:0-180', score: 0.91, creatorKey: 'creator-b', subjectText: 'artificial intelligence agent workflow patterns' }),
        candidate({ chapterKey: 'other:0-180', score: 0.9, creatorKey: 'creator-c', subjectText: 'bitcoin mining market update' }),
    ], new Set(), settings);

    assert.equal(result[1]?.transition?.kind, 'same-topic');
});

test('uses matching canonical profile labels when chapter text differs', () => {
    const result = sequenceSmartTvCandidates([
        candidate({ chapterKey: 'anchor:0-180', score: 0.96, subjectText: 'analyse francaise des outils', profileTopics: ['ai agents'] }),
        candidate({ chapterKey: 'profile-match:0-180', score: 0.91, creatorKey: 'creator-b', subjectText: 'japanese product release', profileTopics: ['ai agents'] }),
        candidate({ chapterKey: 'unrelated:0-180', score: 0.9, creatorKey: 'creator-c', subjectText: 'agriculture water policy', profileTopics: ['agriculture policy'] }),
    ], new Set(), settings);

    assert.equal(result[1]?.candidate.chapterKey, 'profile-match:0-180');
    assert.equal(result[1]?.transition?.kind, 'same-topic');
});

test('prefers a related new creator in the explore profile', () => {
    const result = sequenceSmartTvCandidates([
        candidate({ chapterKey: 'anchor:0-180', score: 0.96, creatorKey: 'creator-a', subjectText: 'artificial intelligence agents workflow' }),
        candidate({ chapterKey: 'same-creator:0-180', score: 0.94, creatorKey: 'creator-a', subjectText: 'artificial intelligence agents workflow patterns' }),
        candidate({ chapterKey: 'new-creator:0-180', score: 0.91, creatorKey: 'creator-b', subjectText: 'artificial intelligence agents workflow patterns' }),
    ], new Set(), { ...settings, editorialMix: 'explore' });

    assert.equal(result[1]?.candidate.chapterKey, 'new-creator:0-180');
});

test('labels an explicit related counterpoint as a new angle', () => {
    const result = sequenceSmartTvCandidates([
        candidate({ chapterKey: 'anchor:0-180', score: 0.96, subjectText: 'artificial intelligence agents workflow' }),
        candidate({ chapterKey: 'counterpoint:0-180', score: 0.9, creatorKey: 'creator-b', subjectText: 'artificial intelligence agents risks and limits', angleSignal: true }),
    ], new Set(), settings);

    assert.equal(result[1]?.transition?.kind, 'new-angle');
});

test('labels an unrelated fallback as best available', () => {
    const result = sequenceSmartTvCandidates([
        candidate({ chapterKey: 'anchor:0-180', score: 0.96, subjectText: 'artificial intelligence agents workflow' }),
        candidate({ chapterKey: 'fallback:0-180', score: 0.9, creatorKey: 'creator-b', subjectText: 'agriculture water policy' }),
    ], new Set(), settings);

    assert.equal(result[1]?.transition?.kind, 'best-available');
});

test('falls back when a same-topic candidate violates a hard cap', () => {
    const result = sequenceSmartTvCandidates([
        candidate({ chapterKey: 'video-a:0-180', videoKey: 'video-a', score: 0.96, subjectText: 'artificial intelligence agents workflow' }),
        candidate({ chapterKey: 'video-a:200-380', videoKey: 'video-a', score: 0.95, subjectText: 'artificial intelligence agents workflow patterns' }),
        candidate({ chapterKey: 'video-b:0-180', videoKey: 'video-b', score: 0.84, creatorKey: 'creator-b', subjectText: 'agriculture water policy' }),
    ], new Set(), { ...settings, maxChapters: 2, maxChaptersPerVideo: 1 });

    assert.equal(result[1]?.transition?.kind, 'best-available');
});

test('is deterministic when candidates have equal scores', () => {
    const candidates = [
        candidate({ chapterKey: 'zeta:0-180', score: 0.9, subjectText: 'artificial intelligence agents workflow' }),
        candidate({ chapterKey: 'alpha:0-180', score: 0.9, subjectText: 'artificial intelligence agents workflow' }),
    ];
    const first = sequenceSmartTvCandidates(candidates, new Set(), settings);
    const second = sequenceSmartTvCandidates(candidates, new Set(), settings);

    assert.deepEqual(first.map(item => item.candidate.chapterKey), second.map(item => item.candidate.chapterKey));
});
