# ADR 002: Keep Smart TV editorial sequencing local and deterministic

- Status: Accepted
- Date: 2026-07-11

## Context

Smart TV currently turns a pool of analyzed chapters into a fixed session by sorting them by score and applying duration and repetition caps. That produces a useful shortlist but not a legible progression between passages. Smart Chapter data already includes scores, titles, summaries and per-video theses. It does not include cross-video embeddings or a persistent editorial graph.

## Decision

Keep session construction in the existing Home flow and introduce one pure TypeScript sequencer. It first enforces the existing hard constraints, then ranks eligible candidates with deterministic soft signals for score, subject proximity, creator variety, optional group variety and freshness. Each selected transition receives a stored label.

The sequencer does not call a model, generate a new Smart Chapter field, create an API endpoint or mutate a running session. The user selects an editorial profile for the next recalculation. Text similarity and angle cues are intentionally heuristic and must fall back to `Best available` when evidence is weak.

## Consequences

### Positive

- Fixed sessions become inspectable editorial snapshots rather than opaque score lists.
- Existing Smart Chapter computation remains optional and is never triggered by playback.
- The selection rules can be covered by focused Node tests without a browser or backend fixture.
- A future richer classifier can replace only the candidate signals while preserving the sequence contract.

### Negative

- Lexical similarity is weaker than a cross-video semantic model and can miss relationships across languages or vocabulary.
- The first profiles are starting hypotheses, not broadcast ratios proven for personalized video.
- Group variety is only available for candidates that retain an originating group.

### Rejected alternatives

- LLM call at session construction time.
- A generic rules engine or global recommendation service.
- Three independent playlists with fixed quotas for continuity, discovery and angle change.
