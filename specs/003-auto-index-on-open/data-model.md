# Data Model: Automatic Smart Analysis On Video Open

## Index Job

Existing job fields remain: `url`, `status`, and optional `error`.

The conditional request may return `skipped` when the requested video already has all required generated data, or when automatic generation is disabled. A skipped result is not a queued worker job.

## Completion Rule

A video is complete when:

1. its highlight set has at least one Smart Chapter; and
2. either the generation language is Auto, or `translatedSubtitles.language` equals the configured explicit generation language.

## Queue Rule

- Priority queue: video opened by the user or manually generated.
- Normal queue: LaunchAgent precompute.
- Deduplication: one queued or running job per video URL across both queues.
