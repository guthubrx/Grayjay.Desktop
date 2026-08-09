# Implementation: Smart Chapters Queue

## Delivered behavior

- The backend persists queued and running work atomically in `Directories.Base/smart-chapters-queue.json`.
- A restarted process restores active work as queued work; completed history remains session-local and is capped at 100 rows.
- Manual requests have priority over playback requests. Scheduled precompute work uses the lowest priority and is labeled by the runtime helper.
- The global sidebar opens a Smart Chapters panel with running, queued, and recent sections. Queued rows can be prioritized or removed.
- Queue state is loaded on frontend startup and refreshed after every existing `HighlightsIndexChanged` websocket event.

## Validation

- `npm run build` in `Grayjay.Desktop.Web`: passed.
- `python3 -m py_compile /Users/moi/Nextcloud/10.Scripts/grayjay/refresh-highlights.py`: passed.
- Canonical full BlueJay build: passed from `bluejay/all-features` at `7f33ede`.
- Installed web assets match the generated application assets.
- The restarted application returned an empty but valid `GET /highlights/QueueStatus` response.

## Known boundary

The panel can only control jobs submitted to the BlueJay backend. If the external precompute script falls back to running the generator directly while BlueJay is unavailable, that external process cannot be observed or reordered by the application.
