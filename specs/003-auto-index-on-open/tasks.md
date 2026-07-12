# Tasks: Automatic Smart Analysis On Video Open

**Input**: `specs/003-auto-index-on-open/spec.md`

## Phase 1: Setup

- [x] T001 Verify the command template and current Smart Analysis language settings in `Grayjay.ClientServer/States/StateHighlightsIndexer.cs` and `Grayjay.ClientServer/Settings/GrayjaySettings.cs`.

## Phase 2: Queue and Contract

- [x] T002 Add a priority lane and conditional completion check in `Grayjay.ClientServer/States/StateHighlightsIndexer.cs` while preserving URL deduplication and configured concurrency.
- [x] T003 Add `GenerateIfNeeded` and the `skipped` response contract in `Grayjay.ClientServer/Controllers/HighlightsController.cs` and `Grayjay.Desktop.Web/src/backend/HighlightsBackend.ts`.
- [x] T004 Add the `Auto-generate on video open` Smart Analysis setting in `Grayjay.ClientServer/Settings/GrayjaySettings.cs`.

## Phase 3: User Story 1 - Read immediately, analyze in background

- [x] T005 [US1] Add a non-blocking conditional enqueue from `Grayjay.Desktop.Web/src/components/contentDetails/VideoDetailView/index.tsx` after the current highlight lookup settles.
- [x] T006 [US1] Extend `Grayjay.Desktop.Web/src/state/StateHighlightsIndexer.ts` with the automatic conditional request and status handling.
- [ ] T007 [US1] Manually verify an unindexed opened video starts playback before its job completes and refreshes through the existing websocket.

## Phase 4: User Story 2 - Receive subtitles in the selected language

- [x] T008 [US2] Verify the completion rule in `StateHighlightsIndexer.cs` requests regeneration only when the configured explicit generation language lacks matching `translatedSubtitles`.
- [x] T009 [US2] Verify the existing `{language}` command path still feeds the selected language into `tools/generate_smart_chapters.py` without a second subtitle process.

## Phase 5: User Story 3 - Avoid unnecessary work

- [x] T010 [US3] Verify repeated opens, existing complete highlights, disabled auto-generation, missing generator configuration, and live videos do not create duplicate automatic jobs.

## Phase 6: Verification

- [x] T011 Run `dotnet build Grayjay.ClientServer/Grayjay.ClientServer.csproj --no-restore` and `npm run build` from `Grayjay.Desktop.Web`.
- [ ] T012 Perform the manual quickstart in `specs/003-auto-index-on-open/quickstart.md` after installing the integration build.
