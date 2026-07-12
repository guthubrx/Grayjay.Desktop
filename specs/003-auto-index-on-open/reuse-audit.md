# Audit de reutilisation de l'existant - Automatic Smart Analysis On Video Open

## Decision

Status: PASS

## Reuse

| Proposed behavior | Existing component | Decision |
|---|---|---|
| Background work | `StateHighlightsIndexer` | Reuse and add priority selection only. |
| Subtitle acquisition | `MaterializeSubtitle` | Reuse unchanged. |
| Generator process | Configured command and `{language}` | Reuse unchanged. |
| Completion persistence | `StateHighlights` | Reuse unchanged. |
| UI refresh | `HighlightsChanged` websocket handler | Reuse unchanged. |
| Manual action | `indexCurrentVideo` | Preserve as forced generation. |

## No duplication

No new worker, storage format, subtitle downloader, websocket event, or generator wrapper is required.

## Gate before tasks

- [x] Existing queue and highlight store are reused.
- [x] Existing language and subtitle translation path are reused.
- [x] No duplicate background service is introduced.
