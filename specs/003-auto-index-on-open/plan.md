# Implementation Plan: Automatic Smart Analysis On Video Open

**Branch**: `003-auto-index-on-open`
**Spec**: `specs/003-auto-index-on-open/spec.md`

## Technical Context

- Existing queue: `Grayjay.ClientServer/States/StateHighlightsIndexer.cs`.
- Existing persistence and live refresh: `StateHighlights`, `HighlightsChanged`, and `VideoDetailView`.
- Existing generator command placeholders: `{url}`, `{subtitles}`, and `{language}`.
- Existing generation language: `GrayjaySettings.XrayPanel.GenerationLanguage`.

## Design

1. Keep manual generation as an unconditional enqueue.
2. Add a conditional automatic enqueue endpoint. It checks the persisted highlight set before creating a job.
3. Add a priority lane to the existing in-memory indexer queue. Only automatic playback requests explicitly enabled in settings use it; manual generation and LaunchAgent precompute remain normal priority.
4. Add one Smart Analysis setting controlling automatic enqueue on video open.
5. In the video detail view, wait for the highlight lookup to settle, then call the conditional endpoint without awaiting it for playback.
6. Reuse the existing `HighlightsChanged` websocket refresh for newly generated chapters and subtitle sources.

## Constitution Check

- Reuses the existing queue, command template, store, websocket, and player view.
- Adds no dependency, daemon, duplicate transcript store, or new generator.
- Is inert without an existing Smart Chapters command.
- Keeps external generation opt-in through the configured command and visible Smart Analysis setting.

## Verification

- `dotnet build Grayjay.ClientServer/Grayjay.ClientServer.csproj --no-restore`
- `npm run build` from `Grayjay.Desktop.Web`
- Manual: open unindexed and indexed videos with an explicit generation language.
