# Contract: Conditional Highlight Generation

## Request

`POST /highlights/GenerateIfNeeded`

```json
{
  "url": "https://www.youtube.com/watch?v=example",
  "command": "/absolute/path/to/gen-chapters.sh {url} {subtitles} {language}"
}
```

## Response

```json
{
  "url": "https://www.youtube.com/watch?v=example",
  "status": "queued"
}
```

Possible statuses are `queued`, `running`, `done`, `error`, and `skipped`.

`skipped` means the automatic request needs no work. It does not alter a manual job path.
