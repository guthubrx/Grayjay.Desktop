# BlueJay Smart Analysis and Smart TV

Smart Analysis is optional. It adds locally generated context to videos: a global summary, key theses, scored Smart Chapters and, on the experimental Smart Block branch, promotion segments. BlueJay continues to work normally when no analysis exists.

## Smart Chapters workflow

1. Configure a Smart Chapters generator command in BlueJay.
2. Start **Generate Smart Chapters** from a video context menu, or run the generator against URLs, a playlist or local media.
3. BlueJay asks its own source plugin for subtitles when the command contains `{subtitles}`. The generator can then use them directly.
4. If no usable subtitles are available, the generator can fetch subtitles itself and fall back to Whisper audio transcription.
5. The generated JSON is written to BlueJay's local highlights store. The player, Highlights page and Smart TV reuse the same data.

The generator caches usable transcripts. Partial subtitles are not cached by default: this prevents a short or truncated transcript from permanently replacing a complete one.

## Quality and scoring

The analysis pass creates a global summary and theses before chaptering. The chapter count scales with the video duration. Scores represent estimated viewer value for each chapter, not a popularity metric for the whole video.

The generator retries recoverable malformed model responses, re-splits overly broad sections and aligns final boundaries with sentence starts. The player exposes the result through the heatmap, the X-Ray panel and its chapter filters.

## Smart TV

Smart TV creates a finite session from scored chapters. It does not create a giant playlist or continuously rebuild one while you watch.

- **Global mix** combines eligible sources.
- Contextual Smart TV tiles build a session from the videos in their own row.
- A session stores which chapters have already played, so starting it again resumes the remaining sequence.
- Clicking a tile intentionally recalculates the session from the current pool and begins playback.

In **Settings → Smart Analysis → Smart TV**, choose the target duration, maximum videos and chapters, maximum chapters per video, minimum score, candidate pool size, repeat-video penalty, tile thumbnails and intro-summary behaviour.

## Highlights and refresh

Highlights uses the same Smart Analysis summaries to rank eligible unwatched subscription videos for **Watch now** and to display consistent interest context. Subscription-group rows load from the local cache first, then refresh independently.

The reload control offers two distinct actions:

- **Reload cache**: immediately redraw from locally available data.
- **Update**: request a complete refresh from configured sources.

## Smart Block branch

`pr/smart-block-promotions` is currently a dependent experimental branch, not part of `bluejay/all-features` yet. It extends the same local analysis file with promotion segments from SponsorBlock-compatible data and the model analysis. When enabled, Smart Block can mark these intervals with a hatched grey layer on the heatmap and skip them. It is independent from SponsorBlock: either feature can remain enabled without the other.

## Operational limits

The generator needs a configured model provider. Transcript fallback can also require `yt-dlp`, `deno`, `ffmpeg` and a Whisper model depending on the source. Run `tools/generate_smart_chapters.py --check` to diagnose the local environment before indexing a batch.
