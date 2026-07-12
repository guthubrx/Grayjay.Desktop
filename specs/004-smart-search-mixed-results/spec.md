# Specification: Smart Search Result Layouts

**Feature Branch**: `004-smart-search-mixed-results`
**Created**: 2026-07-12
**Status**: Implemented, pending manual validation

## User Scenarios and Testing

### User Story 1 - Inspect provenance without visual noise (Priority: P1)

When Smart Search displays a video, the languages that found it appear as compact readable chips below the card instead of an unstructured line of codes.

**Independent Test**: Search with multiple languages and verify a duplicate result displays one card with one chip for every language that returned it.

### User Story 2 - Browse one mixed international result set (Priority: P1)

When the user selects the mixed layout, Smart Search displays a single deduplicated grid containing the Standard search results and all configured Smart Search languages.

**Independent Test**: Search a topic returned by Standard and at least two Smart Search languages. Verify every unique video appears once, Standard is represented, and provenance chips retain every matching lane.

### User Story 3 - Preserve intentional ordering (Priority: P2)

Without a user-selected local ordering, the mixed grid alternates Standard and international lanes while preserving each lane's native rank. With an explicit local ordering, the resulting unique cards are ordered globally.

**Independent Test**: Verify the default mixed layout rotates lanes. Enable Date or Views ordering and verify cards from all lanes use the requested global order.

### Edge Cases

- Grouped layout remains the default and keeps the current language sections.
- Standard and Smart queries receive the same selected source exclusions, server ordering, and content filters.
- A card found in Standard and Smart Search is shown once in mixed layout and includes `Standard` plus all matching language chips.
- Empty Standard or language lanes do not create blank sections or interrupt the mixed grid.
- Translated titles and translated creator names from a Smart Search match are retained when the corresponding Standard card is the display representative.

## Requirements

- **FR-001**: Smart Search settings MUST expose a persisted `Result layout` choice with `Group by language` as the default and `Mix all results` as the alternative.
- **FR-002**: Language provenance MUST render as compact chips using human-readable language names. The Standard lane MUST render as a `Standard` chip.
- **FR-003**: In mixed layout, Standard and Smart results MUST be merged and deduplicated by backend URL, URL, or platform identifier.
- **FR-004**: In mixed layout without a local sort, cards MUST round-robin the Standard lane then configured Smart Search lanes, preserving native rank within each lane.
- **FR-005**: With a local result sort, cards in mixed layout MUST be sorted globally by the selected criteria.
- **FR-006**: Source exclusions, server ordering, and filters MUST be passed consistently to Standard and Smart search requests.
- **FR-007**: Grouped layout MUST remain gracefully usable when Standard results are unavailable or Smart Search is not configured.

## Success Criteria

- **SC-001**: A shared video never appears more than once in mixed layout.
- **SC-002**: A user can immediately identify every language and Standard lane that produced a card.
- **SC-003**: Changing the persisted layout updates an already displayed Smart session without rerunning network requests.
- **SC-004**: Standard server ordering is included in the Standard search request.
