# Plan: Selective Smart Subtitle Translation

## Reused Components

- `StateSmartSearch`: persists the six selected international language slots.
- `SmartSearchSettings`: presents the per-language controls.
- `VideoDetailView`: requests automatic Smart Chapters after video details are loaded.
- `StateHighlightsIndexer`: validates, queues, and runs the existing external command.
- `tools/generate_smart_chapters.py`: writes highlight JSON and optional translated subtitle cues.

## Design

1. Store `subtitleTranslationLanguages` alongside the existing Smart Search `languages` setting. On migration, select the existing non-French/non-English search languages so the setting immediately reflects the user's current international search configuration.
2. Add a checkbox beside each of the six Smart Search language dropdowns. Removing or replacing a language also removes stale translation selections.
3. Pass the selected language codes with each index request. The indexer preserves the user command and appends its own generator flags only when necessary.
4. Ask the first Smart Chapters analysis pass for a normalized transcript language, then write it as `transcriptLanguage` in the highlight JSON.
5. Make subtitle translation opt-in in the generator. It compares the detected transcript language and output language against the requested source-language list.
6. Use `transcriptLanguage` plus the selected policy in `HasRequiredOutput`, so existing files are completed once and completed videos are not continuously requeued.

## Verification

- Add Node tests for Smart Search language preference normalization and migration.
- Add Python unit tests for language normalization and translation eligibility.
- Run the frontend build and the focused Python tests.
- Rebuild the all-features integration application and manually test Japanese selected / English unselected behavior.
