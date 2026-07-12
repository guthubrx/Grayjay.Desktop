# Tasks: Smart Search

**Input**: Design documents from `specs/002-smart-search/`
**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `reuse-audit.md`

**Tests**: Contract, backend unit/integration and frontend build coverage are required because the feature launches an external command, composes asynchronous results and stores local cache entries.

## Phase 1: Setup

**Purpose**: Make the isolated branch buildable and establish test fixtures before feature code.

- [ ] T001 Initialize the repository submodules in `/Volumes/8TB2/50-repos-archives/11.Repositories/grayjay-session-002-smart-search` and inspect the concrete pager interfaces used by `StatePlatform.SearchLazy`; record the chosen composition point in `specs/002-smart-search/implementation.md`.
- [ ] T002 [P] Create translator JSON fixtures for valid query/title responses and malformed responses under `tools/tests/fixtures/smart_search/`, matching `specs/002-smart-search/contracts/smart-search-command.md`.
- [ ] T003 [P] Create `tools/tests/test_smart_search_translator.py` with offline contract tests for cardinality, empty text rejection and unknown output keys.

---

## Phase 2: Foundational contracts and safety

**Purpose**: Add the bounded data and command boundaries required by every user story.

- [ ] T004 Create Smart Search request, variant, enriched-result and translator-contract models in `Grayjay.ClientServer/Models/SmartSearch/`; validate bounded query length, unique supported languages and request/session identifiers.
- [ ] T005 Create `Grayjay.ClientServer/States/StateSmartSearchCommand.cs` to run a configured executable with redirected standard input/output, timeout and sanitized failures; verify no user query is interpolated into shell arguments.
- [ ] T006 Create `tools/smart_search_translator.py` as the local Routr/OpenAI-compatible reference implementation of the command contract, reusing the established `X-Routr-*` header values and validating structured JSON before output.
- [ ] T007 Add local query/title cache storage, expiration rules and deterministic result-key helpers in `Grayjay.ClientServer/States/StateSmartSearch.cs`; add unit tests for expiration and canonical URL/ID deduplication.
- [ ] T008 Verify `python3 -m pytest tools/tests/test_smart_search_translator.py` and the focused C# tests for models, command parsing and cache helpers.

**Checkpoint**: The command contract is executable offline, malformed output is rejected, and no provider secret is present in BlueJay settings.

---

## Phase 3: User Story 1 - Explore a topic through multiple languages (Priority: P1)

**Goal**: Run a normal search first, then compose bounded international first-page searches without replacing the normal pager.

**Independent Test**: Search in French, activate Japanese/Chinese/Arabic/Russian, and verify the normal grid stays visible while each international language resolves independently.

### Tests for User Story 1

- [ ] T009 [P] [US1] Add backend tests proving a Smart Search session does not mutate `SearchController.SearchState.SearchPager` in `Grayjay.Desktop.Tests/SmartSearch/SmartSearchSessionTests.cs`.
- [ ] T010 [P] [US1] Add backend tests for one valid translated query per selected language and for one-language failure isolation in `Grayjay.Desktop.Tests/SmartSearch/SmartSearchSessionTests.cs`.

### Implementation for User Story 1

- [ ] T011 [US1] Implement query-translation invocation, session identity and per-language state transitions in `Grayjay.ClientServer/States/StateSmartSearch.cs`, using `StatePlatform.SearchLazy` with the original type, filters and excluded sources.
- [ ] T012 [US1] Implement the chosen composed first-page pager/session adapter in `Grayjay.ClientServer/States/StateSmartSearch.cs`, retaining the existing distributed placeholders and limiting each language to one first page.
- [ ] T013 [US1] Add `Grayjay.ClientServer/Controllers/SmartSearchController.cs` endpoints for loading an international session and reading its current language sections; keep `SearchController.cs` unchanged except for shared DTO extraction when objectively necessary.
- [ ] T014 [US1] Add `Grayjay.Desktop.Web/src/backend/SmartSearchBackend.ts` and Smart Search frontend models in `Grayjay.Desktop.Web/src/backend/models/smartSearch/`, matching the backend contract.
- [ ] T015 [US1] Add `Grayjay.Desktop.Web/src/state/StateSmartSearch.ts` to persist the local translator command under `smartSearch.translatorCommand`, following the `highlights.generatorCommand` pattern without storing provider credentials.
- [ ] T016 [US1] Extend `Grayjay.Desktop.Web/src/pages/Search/index.tsx` so ordinary search starts first and explicit Smart Search activation begins an isolated international session for the current query.

**Checkpoint**: A four-language Smart Search returns independently labelled sections without replacing or delaying ordinary search.

---

## Phase 4: User Story 2 - Understand results and provenance (Priority: P1)

**Goal**: Present original titles, optional French translations and source-language labels without duplicate videos.

**Independent Test**: Return the same YouTube URL from two language queries and a non-French title; verify one card retains both language labels, original text and French translation.

### Tests for User Story 2

- [ ] T017 [P] [US2] Add unit tests for merging duplicate URLs while retaining all source language labels in `Grayjay.Desktop.Tests/SmartSearch/SmartSearchResultTests.cs`.
- [ ] T018 [P] [US2] Add frontend tests or focused pure utility tests for title display fallback in `Grayjay.Desktop.Web/src/utils/smartSearchResults.test.ts`.

### Implementation for User Story 2

- [ ] T019 [US2] Implement result merging and title-translation batch selection in `Grayjay.ClientServer/States/StateSmartSearch.cs`; skip already French, empty and cached titles.
- [ ] T020 [US2] Add endpoint support for title enrichment updates in `Grayjay.ClientServer/Controllers/SmartSearchController.cs`, tied to the active session id.
- [ ] T021 [US2] Create `Grayjay.Desktop.Web/src/components/search/SmartSearchSection/` and `Grayjay.Desktop.Web/src/components/search/SmartSearchVideoView/`, reusing normal navigation and content actions while showing original title, French translation and language labels.
- [ ] T022 [US2] Integrate international sections and incremental title updates into `Grayjay.Desktop.Web/src/pages/Search/index.tsx` and `index.module.css`; keep the standard `ContentGrid` untouched for ordinary results.

**Checkpoint**: Every international result is attributable to one or more languages and stays readable when title translation is absent.

---

## Phase 5: User Story 3 - Keep search fast and controllable (Priority: P2)

**Goal**: Bound concurrency and data volume, reuse cache, and discard stale asynchronous results.

**Independent Test**: Start a four-language search, immediately search a different query, and verify only the newer session is rendered; repeat a query and verify cached translations are reused.

### Tests for User Story 3

- [ ] T023 [P] [US3] Add session supersession and stale-result rejection tests in `Grayjay.Desktop.Tests/SmartSearch/SmartSearchSessionTests.cs`.
- [ ] T024 [P] [US3] Add cache-hit/cache-expiry tests for query and title entries in `Grayjay.Desktop.Tests/SmartSearch/SmartSearchCacheTests.cs`.

### Implementation for User Story 3

- [ ] T025 [US3] Enforce maximum selected languages, first-page-only behavior, title batch size and per-session cancellation/ignore rules in `Grayjay.ClientServer/States/StateSmartSearch.cs`.
- [ ] T026 [US3] Add Smart Search language selection, loading state and cancellation-on-query-change behavior to `Grayjay.Desktop.Web/src/pages/Search/index.tsx`.
- [ ] T027 [US3] Add minimal observable timing/error logs in `Grayjay.ClientServer/States/StateSmartSearch.cs` without logging raw provider credentials or full title batches.

**Checkpoint**: Changing a query cannot restore stale sections, and repeated text does not cause unnecessary translator calls.

---

## Phase 6: User Story 4 - Graceful optional behavior (Priority: P3)

**Goal**: Make the feature inactive by default and actionable when unconfigured or unavailable.

**Independent Test**: Delete the persisted Smart Search command, search normally, then explicitly activate Smart Search and verify only a configuration prompt/error is shown.

- [ ] T028 [US4] Add the first-use command configuration prompt and error presentation in `Grayjay.Desktop.Web/src/state/StateSmartSearch.ts` and `Grayjay.Desktop.Web/src/pages/Search/index.tsx`.
- [ ] T029 [US4] Add backend failure mapping for missing command, process timeout, non-zero exit and invalid JSON in `Grayjay.ClientServer/States/StateSmartSearchCommand.cs` and controller responses.
- [ ] T030 [US4] Verify ordinary search behavior with no Smart Search configuration using `Grayjay.Desktop.Web/src/pages/Search/index.tsx` and the relevant backend tests.

---

## Phase 7: Polish and verification

- [ ] T031 Update `README.md` and `specs/002-smart-search/quickstart.md` with the optional local command setup, privacy boundary, `balanced-cheap` Routr example and international-search limitation.
- [ ] T032 Run `python3 -m pytest tools/tests/test_smart_search_translator.py`, the focused C# Smart Search tests, `npm run build` from `Grayjay.Desktop.Web`, and `dotnet build Grayjay.ClientServer/Grayjay.ClientServer.csproj --no-restore`; record exact results in `specs/002-smart-search/implementation.md`.
- [ ] T033 Perform manual BlueJay verification: ordinary search, four-language Smart Search, duplicate merging, delayed title translation, query replacement and missing-command degradation; record observed results in `specs/002-smart-search/implementation.md`.
- [ ] T034 Review the final diff against Futo patterns and the reuse audit; remove any wrapper, setting, API or dependency that lacks a direct requirement, and update `specs/002-smart-search/implementation.md`.

## Dependencies and execution order

- Phase 1 blocks all later phases.
- Phase 2 blocks every user story.
- US1 is the first independently useful increment.
- US2 depends on US1 result/session models.
- US3 depends on US1 session orchestration and cache foundations.
- US4 depends on the command state from Phase 2 and UI activation from US1.
- Phase 7 runs only after every story.

## Parallel opportunities

- T002 and T003 can run together.
- T004, T005 and T006 are separate files after the contract is agreed.
- T009/T010 and T017/T018 can run beside their corresponding implementation preparation.
- T023/T024 can run beside UI work that does not alter state orchestration.

## Implementation strategy

1. Deliver and verify the external command boundary and isolated session first.
2. Make multilingual first-page results work while preserving normal search.
3. Add provenance and translated-title enrichment.
4. Add cache, cancellation and degraded states.
5. Build, test and manually verify before proposing integration into `bluejay/all-features`.
