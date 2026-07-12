# Tasks: Selective Smart Subtitle Translation

## Specification

- [x] T001 Document the independent Smart Chapters and subtitle-translation rules.

## Preferences and UI

- [x] T002 Extend persisted Smart Search settings with normalized translation source languages and migration defaults.
- [x] T003 Add a per-language `Translate subtitles` control to Smart Search settings.
- [x] T004 Add focused frontend preference tests.

## Indexing and Generator

- [x] T005 Pass translation source languages through index requests and queue jobs.
- [x] T006 Use the persisted transcript language to decide whether an automatic job is complete.
- [x] T007 Detect, normalize, and persist transcript language in generated highlight JSON.
- [x] T008 Make translated subtitle generation explicit and selective.
- [x] T009 Add focused Python tests for language normalization and translation eligibility.

## Integration

- [x] T010 Run focused tests, the frontend build, and the server build.
- [ ] T011 Merge the feature into `bluejay/all-features`, rebuild `BlueJay.app`, install it after the application is closed, and manually verify the two-language scenario.
