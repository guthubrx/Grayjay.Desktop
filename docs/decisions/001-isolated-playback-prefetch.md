# ADR 001: Isolate next-video prefetch from active playback state

- Status: Accepted
- Date: 2026-07-11

## Context

Loading the next queue item currently starts only after the queue index changes. `VideoLoad` both resolves remote details and mutates the window's active `DetailsState`. Calling it early would therefore replace state still used by playback, history tracking and media proxies.

## Decision

Keep one ephemeral next-video preparation inside each window's existing `DetailsState`. Preparation resolves video details, selects the automatic source and completes the DASH manifest in an isolated state without activating it. A matching, fresh result transfers those resources to the normal `VideoLoad` path, which remains the only place allowed to call the existing activation effects.

The feature uses the standard playback queue and has no dependency on Smart Chapters or Smart TV. It reuses the existing DASH cache and does not introduce a second media player or fetch media fragments before transition.

## Consequences

### Positive

- Removes the slow plugin-resolution step from prepared transitions.
- Preserves existing history, proxy, casting and playback semantics.
- Bounds memory and concurrent source work to one candidate per window.
- Benefits every deterministic queue consumer.

### Negative

- The first media segment still loads at transition time.
- A synchronous plugin request already running cannot be forcibly cancelled; a superseded result is discarded.
- Prepared source details need a finite lifetime because remote URLs may expire.

### Rejected alternatives

- Mutating the active `DetailsState` before transition.
- A global URL cache shared by all windows.
- A hidden second HLS/DASH player and transferable media buffer.
