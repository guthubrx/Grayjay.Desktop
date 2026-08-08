# Specification: Output-Language Smart Subtitle Translation

**Feature Branch**: `006-selective-subtitle-translation`
**Created**: 2026-07-12
**Status**: In progress

## User Scenarios and Testing

### User Story 1 - Choose one output language (Priority: P1)

The user configures one generation language in Smart Analysis. When a video is analyzed, subtitles are translated into that language whenever its detected transcript language differs.

**Independent Test**: Set French as the generation language, then generate a Japanese and an English video. Both receive a French translated subtitle source without configuring Smart Search languages.

### User Story 2 - Keep Smart Search independent (Priority: P1)

Smart Search language lanes control discovery only. Changing them never changes subtitle translation eligibility.

**Independent Test**: Change the configured Smart Search languages, open a Japanese video, and verify it still receives French translated subtitles.

### User Story 3 - Do not repeat unnecessary work (Priority: P2)

The generated highlight data records the transcript language. On later openings, BlueJay skips a video whose Smart Chapters are present and whose translation policy has already been satisfied. There is no global backfill; older files without a known transcript language remain unchanged until an explicit regeneration.

**Independent Test**: Reopen a completed French video and verify it is not requeued. Reopen a Japanese Smart Chapter set with a missing French translation and verify it is queued only when automatic analysis is enabled.

## Requirements

- **FR-001**: Smart Analysis settings MUST expose one generation language used as the translated subtitle output language.
- **FR-002**: Smart Search language settings MUST not influence subtitle translation eligibility.
- **FR-003**: Smart Chapters generation MUST remain independent from Smart Search configuration.
- **FR-004**: Automatic and manual requests MUST request translated subtitles whenever a generation language is configured, without modifying the user-configured generator command.
- **FR-005**: The generator MUST record a normalized transcript language in new highlight files.
- **FR-006**: The generator MUST only create translated subtitles when translation is requested, the transcript language is known, and it differs from the output language.
- **FR-007**: Existing highlight files without transcript language MUST remain readable and must not be globally reprocessed.
- **FR-008**: Background precompute MUST continue to generate Smart Chapters; translated subtitles remain lazy, generated at video-open time or by explicit generation when the policy requires them.

## Success Criteria

- **SC-001**: An English video can receive Smart Chapters without an unnecessary translated subtitle track.
- **SC-002**: A Japanese video exposes the translated subtitle source after automatic analysis completes when French is the generation language.
- **SC-003**: No existing configured generator command needs to be edited by the user.
