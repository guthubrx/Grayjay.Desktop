# Plan: Smart Search Result Layouts

## Reused Components

- `StateSmartSearch`: persisted Smart Search preferences.
- `SearchPage`: owns both Standard pager and Smart Search session, selected source exclusions, server ordering, filters, and local sort.
- `SmartSearchResults`: Smart result renderer and translated title display.
- `VideoThumbnailView`: existing card visual and playback integration.

## Implementation

1. Add a persisted `resultLayout` preference to `StateSmartSearch` and expose it in Smart Search settings.
2. Extract deterministic result merge helpers into a small frontend utility with Node tests.
3. Feed the current Standard pager results into `SmartSearchResults` and refresh that input as pager events arrive.
4. Render grouped sections for the existing layout and a single mixed grid for the new layout.
5. Use compact provenance chips with `Standard` and human-readable language labels.
6. Preserve Smart Search translations while merging duplicate cards.
7. Include `order` in the Standard search request so both paths receive the same server order.

## Verification

- Run utility tests through Node TypeScript stripping.
- Run `npm run build`.
- Verify the default layout does not change existing grouped Smart Search behavior.
- Verify mixed layout merges Standard and Smart results without duplicate cards.
