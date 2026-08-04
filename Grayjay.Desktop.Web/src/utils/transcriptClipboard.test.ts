import assert from 'node:assert/strict';
import test from 'node:test';

import { formatTranscriptForClipboard } from './transcriptClipboard';

test('formats transcript cues with timestamps and removes consecutive duplicate subtitles', () => {
    assert.equal(formatTranscriptForClipboard([
        { start: 3.8, text: ' First   sentence. ' },
        { start: 5, text: 'First sentence.' },
        { start: 65, text: 'Second sentence.' },
        { start: 3661, text: 'Third sentence.' },
    ]), '[00:03] First sentence.\n[01:05] Second sentence.\n[01:01:01] Third sentence.');
});
