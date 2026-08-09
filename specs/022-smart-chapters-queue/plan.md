# Implementation Plan: Smart Chapters Queue

**Branch**: `pr/022-smart-chapters-queue` | **Date**: 2026-08-09 | **Spec**: [spec.md](spec.md)

## Summary

Replace the two in-memory FIFO queues with a single persisted queue ordered by priority and insertion order. Expose the ordered snapshot and queue actions through the existing Highlights controller. Reuse the existing Smart Chapters websocket event and state store to render a global modal from the sidebar.

## Technical context

- **Languages**: C#, TypeScript, SolidJS, CSS modules, Python runtime helper.
- **Persistence**: atomic JSON snapshot in `Directories.Base/smart-chapters-queue.json`.
- **Compatibility**: existing `Generate`, `GenerateIfNeeded`, websocket event, and generator command remain valid.
- **Priority**: manual `2`, playback `1`, scheduled precompute `0`; user prioritization moves a queued job to the head of priority `2`.
- **Scope boundary**: only jobs submitted to the BlueJay backend can be monitored and reordered.

## Structure

```text
Grayjay.ClientServer/
├── Controllers/HighlightsController.cs
└── States/StateHighlightsIndexer.cs

Grayjay.Desktop.Web/src/
├── backend/HighlightsBackend.ts
├── state/StateHighlightsIndexer.ts
├── overlays/OverlaySmartChaptersQueue/
└── components/menus/SideBar/

/Users/moi/Nextcloud/10.Scripts/grayjay/
└── refresh-highlights.py
```

## Validation

1. Build the web application with Vite.
2. Validate the Python helper with `py_compile`.
3. Integrate the branch into `bluejay/all-features` and use the canonical BlueJay build script for full C# compilation and application delivery.
