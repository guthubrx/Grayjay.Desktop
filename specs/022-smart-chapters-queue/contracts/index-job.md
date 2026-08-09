# Index Job Contract

## API fields

```json
{
  "url": "https://www.youtube.com/watch?v=example",
  "status": "queued",
  "title": "Optional video title",
  "author": "Optional channel name",
  "thumbnail": "https://example.com/thumb.jpg",
  "source": "manual",
  "priority": 2,
  "position": 1,
  "queuedAt": "2026-08-09T12:00:00Z"
}
```

`status` is one of `queued`, `running`, `done`, `error`, or `skipped`.

`source` is one of `manual`, `playback`, or `precompute`.

`position` is populated for queued work only. It is the effective worker order after priority and user promotion are applied.

## Endpoints

- `GET /highlights/QueueStatus` returns the current ordered snapshot.
- `POST /highlights/Prioritize` accepts `{ "url": "..." }` and only changes queued work.
- `POST /highlights/RemoveFromQueue` accepts `{ "url": "..." }` and only removes queued work.
