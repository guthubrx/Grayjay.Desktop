# Specification: Automatic Smart Analysis On Video Open

**Feature Branch**: `003-auto-index-on-open`
**Created**: 2026-07-12
**Status**: Implemented, pending manual validation

## User Scenarios and Testing

### User Story 1 - Read immediately, analyze in background (Priority: P1)

When a user opens a video without Smart Chapters, playback begins without waiting for analysis. The video is queued for Smart Analysis in the background and the analysis appears in the current video view when it is ready.

**Independent Test**: Open an unindexed supported video with a configured generator. Playback starts normally, the job becomes queued or running, and Smart Chapters appear without reopening the video.

### User Story 2 - Receive subtitles in the selected language (Priority: P2)

When the user selected an explicit Smart Analysis generation language, an opened video is analyzed until it has both Smart Chapters and a translated subtitle track in that language. Existing matching translated subtitles are reused.

**Independent Test**: Select French as the generation language and open a video with no French translated track. When the job completes, the subtitle source menu offers a French translated track.

### User Story 3 - Avoid unnecessary work (Priority: P3)

Videos that already have Smart Chapters and, when requested, a matching translated subtitle track are not requeued. Repeated opens of a video while its work is queued or running also do not create duplicates.

**Independent Test**: Open the same indexed video repeatedly and verify that no new worker job is created. Open the same unindexed video twice before completion and verify one job exists.

### Edge Cases

- When Smart Analysis auto-generation is disabled, opening a video must not queue work.
- When no generator command is configured, playback must be unaffected and no prompt must appear.
- Live and planned videos must not be queued automatically.
- If the configured generation language is `Auto (video language)`, existing Smart Chapters are sufficient and a translated subtitle track is not required.
- A failed job must remain visible as a failure and must not block a manual retry.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST start playback independently from automatic Smart Analysis work.
- **FR-002**: The system MUST enqueue an opened eligible video only when Smart Chapters are missing, or when an explicit generation language lacks a matching translated subtitle track.
- **FR-003**: The system MUST give an automatic job opened by the user priority over background precompute jobs while preserving the configured worker concurrency limit.
- **FR-004**: The system MUST deduplicate jobs by canonical video URL across manual, automatic, and background callers.
- **FR-005**: The system MUST use the existing Smart Analysis generation language for chapter text and translated subtitles. `Auto (video language)` MUST not require a translated track.
- **FR-006**: The system MUST expose an `Auto-generate on video open` setting in Smart Analysis, enabled by default and safely inert when no generator is configured.
- **FR-007**: The system MUST preserve the existing manual `Generate smart chapters` action as a forced generation path.
- **FR-008**: The system MUST refresh the current video analysis and subtitle sources when a background job completes.
- **FR-009**: The feature MUST degrade gracefully when the Smart Chapters feature or external generator is not configured.

## Success Criteria

- **SC-001**: Opening an eligible video does not add a visible startup delay to playback.
- **SC-002**: Reopening the same video while generation is active produces one active job for that URL.
- **SC-003**: An already complete video produces no generator process when opened.
- **SC-004**: With an explicit generation language, the completed highlight set contains a translated subtitle track in that language.
- **SC-005**: With auto-generation disabled or no configured command, opening videos behaves as before.

## Assumptions

- The existing Smart Analysis `Generation language` is the explicit user choice for generated chapter text and translated subtitles.
- Existing generated highlights and translated subtitle caches remain authoritative when their stored language and transcript hash match.
- The existing background queue is the integration point; no second worker service is introduced.
