# Specification: Selective Smart Subtitle Translation

**Feature Branch**: `006-selective-subtitle-translation`
**Created**: 2026-07-12
**Status**: In progress

## User Scenarios and Testing

### User Story 1 - Select the languages worth translating (Priority: P1)

For every selected Smart Search language, the user can independently choose whether subtitles from that language should be translated when its video is opened. Search coverage and subtitle translation remain separate choices.

**Independent Test**: Select Japanese and English search lanes, enable translation only for Japanese, reload the application, and verify the choice persists beside each language.

### User Story 2 - Keep analysis universal but translation selective (Priority: P1)

With automatic analysis enabled, opening a video still requests Smart Chapters. It requests translated subtitles only when the effective transcript language is one of the selected source languages and differs from the configured output language.

**Independent Test**: Open one Japanese and one English video with equivalent automatic analysis settings. Both receive Smart Chapters; only the Japanese video receives a French translated subtitle source.

### User Story 3 - Do not repeat unnecessary work (Priority: P2)

The generated highlight data records the transcript language. On later openings, BlueJay skips a video whose Smart Chapters are present and whose translation policy has already been satisfied. Older highlight files without this information are safely completed once when needed.

**Independent Test**: Reopen a completed English video and verify it is not requeued. Reopen an existing Japanese Smart Chapter set without translated subtitles and verify it is completed once, then skipped afterwards.

## Requirements

- **FR-001**: Smart Search settings MUST display a `Translate subtitles` toggle beside every configured language slot.
- **FR-002**: The selected translation-source languages MUST persist with the Smart Search preferences and survive restart.
- **FR-003**: Smart Chapters generation MUST remain independent from subtitle translation selection.
- **FR-004**: Automatic and manual requests MUST pass the selected source-language policy to the indexer without modifying the user-configured generator command.
- **FR-005**: The generator MUST record a normalized transcript language in new highlight files.
- **FR-006**: The generator MUST only create translated subtitles when translation is explicitly requested, the transcript language is selected, and it differs from the output language.
- **FR-007**: Existing highlight files without transcript language MUST remain readable and be regenerated at most once when a selected translation could be required.
- **FR-008**: Background precompute MUST continue to generate Smart Chapters; translated subtitles remain lazy, generated at video-open time when the policy requires them.

## Success Criteria

- **SC-001**: An English video can receive Smart Chapters without an unnecessary translated subtitle track.
- **SC-002**: A Japanese video selected for translation exposes the translated subtitle source after automatic analysis completes.
- **SC-003**: No existing configured generator command needs to be edited by the user.
