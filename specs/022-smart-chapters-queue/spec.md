# Specification: Smart Chapters Queue

**Branch**: `pr/022-smart-chapters-queue`
**Date**: 2026-08-09

## User value

When Smart Chapters generation is requested from a video card, playback, or scheduled precompute, the user can see the active work, the waiting order, and recent outcomes in one global place. The user can move a waiting video to the front or remove it before execution.

## Functional requirements

- FR-001: queued and running jobs survive an application restart and resume as queued work.
- FR-002: manual requests have higher priority than automatic playback requests and scheduled precompute requests.
- FR-003: the global panel shows running jobs, waiting jobs in their effective order, and recent completed, failed, or removed jobs.
- FR-004: a queued job can be prioritized or removed without affecting a running generator process.
- FR-005: a video-card or player request passes its title, author, and thumbnail to the queue when those values are available.
- FR-006: the scheduled precompute script identifies work submitted through the BlueJay backend as `precompute`.

## Non-goals

- Stopping a generator process already running.
- Showing work executed by the external script after it has fallen back to its direct, non-BlueJay execution path.
- Changing the configured generator, LLM parallelism, or Whisper policy.

## Acceptance scenarios

1. A manual request is made while automatic or scheduled jobs wait: it is listed ahead of them and is selected by the next available worker.
2. The user opens Smart Chapters from the sidebar and sees the queue state without opening a video.
3. The user prioritizes a queued video: it becomes queue position 1.
4. The user removes a queued video: it no longer runs and is shown as removed in Recent.
5. BlueJay is restarted with queued or running work: the work reappears as queued and is resumed.
