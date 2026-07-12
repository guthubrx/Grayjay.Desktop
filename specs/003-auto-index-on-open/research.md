# Research: Automatic Smart Analysis On Video Open

## Decision: Reuse the existing indexer queue

**Rationale**: `StateHighlightsIndexer` already deduplicates by URL, materializes Grayjay subtitle VTT files, executes the configured generator, and emits websocket updates. A second queue would split status and duplicate failure handling.

**Alternative considered**: Launch the generator directly from the video view. Rejected because it would bypass queue concurrency, deduplication, and subtitle reuse.

**Future-maintainer impact**: One queue remains the single observable place for all Smart Chapters work.

## Decision: Conditional enqueue is server-side

**Rationale**: The server owns the highlight store and knows the configured generation language. It can decide atomically whether chapters or a translated track are missing.

**Alternative considered**: Let the web view inspect highlights and choose. Rejected because the decision would be duplicated and could race against another job.

**Future-maintainer impact**: The client requests intent; the indexer owns generation policy.

## Decision: Generation language is the subtitle target

**Rationale**: There is no active global UI locale contract available to the generator. Smart Analysis already exposes a deliberate language preference and passes it through `{language}`.

**Alternative considered**: Infer a browser or operating-system locale. Rejected because it could disagree with user intent and would introduce a second language preference.

**Future-maintainer impact**: One language setting controls chapters, summaries, and translated subtitles.

## Decision: Priority lane for opened videos

**Rationale**: A user-selected video must not wait behind a long precompute backlog. A priority queue still respects the existing concurrency limit.

**Alternative considered**: Increase worker concurrency for playback. Rejected because it could saturate Routr or Whisper.

**Future-maintainer impact**: The priority rule remains visible in the existing queue implementation.
