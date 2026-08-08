# Plan: Output-Language Smart Subtitle Translation

## Reused Components

- `StateSmartSearch`: persists the six selected international language slots for discovery.
- `SmartSearchSettings`: presents discovery controls only.
- `VideoDetailView`: requests automatic Smart Chapters after video details are loaded.
- `StateHighlightsIndexer`: validates, queues, and runs the existing external command.
- `tools/generate_smart_chapters.py`: writes highlight JSON and optional translated subtitle cues.

## Design

1. Reuse the Smart Analysis generation language as the sole subtitle output-language setting.
2. Keep Smart Search language slots limited to discovery; remove their subtitle translation controls and persisted policy.
3. Keep index requests simple. The indexer preserves the configured generator command and appends `--translate-subtitles` whenever an output language is configured.
4. Ask the first Smart Chapters analysis pass for a normalized transcript language, then write it as `transcriptLanguage` in the highlight JSON.
5. The generator translates every known transcript language different from the configured output language.
6. Use `transcriptLanguage` plus the output language in `HasRequiredOutput`, without a global backfill of existing files.

## Verification

- Add Node tests for Smart Search language preference normalization.
- Add Python unit tests for language normalization and translation eligibility.
- Run the frontend build and the focused Python tests.
- Rebuild the all-features integration application and manually test Japanese-to-French / French-without-duplicate behavior.
