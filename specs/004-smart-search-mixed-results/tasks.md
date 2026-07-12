# Tasks: Smart Search Result Layouts

## Setup

- [x] T001 Document the persisted layout contract and the merge ordering rules.

## Preferences and Data

- [x] T002 Add the persisted result layout setting in `Grayjay.Desktop.Web/src/state/StateSmartSearch.ts`.
- [x] T003 Add the result layout dropdown in `Grayjay.Desktop.Web/src/components/settings/SmartSearchSettings/index.tsx`.
- [x] T004 Pass server order to the Standard request in `Grayjay.Desktop.Web/src/backend/SearchBackend.ts`.

## Result Rendering

- [x] T005 Add tested helpers for source keys, provenance merging, round-robin ordering, and global sorting.
- [x] T006 Keep a reactive snapshot of Standard pager results in `Grayjay.Desktop.Web/src/pages/Search/index.tsx`.
- [x] T007 Render readable provenance chips in grouped layout.
- [x] T008 Render the deduplicated mixed grid with Standard plus Smart lanes.
- [x] T009 Preserve Smart translated titles and creator names for a card shared with Standard.

## Verification

- [x] T010 Run the utility tests and `npm run build`.
- [ ] T011 Verify grouped and mixed layouts manually after installing the integration build.
