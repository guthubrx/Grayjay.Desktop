# ADR 002: Smart Search uses an external local translator command

**Date**: 2026-07-12
**Status**: Accepted

## Context

Smart Search needs multilingual query variants and optional translated display titles. The current Smart Chapters feature already delegates model calls to a user-configured local command, which preserves provider credentials and Routr headers outside the desktop application.

## Decision

Use a dedicated Smart Search command with a constrained JSON standard-input/standard-output contract. BlueJay keeps the ordinary search path untouched, invokes the command only after explicit Smart Search activation, and composes the international results in an isolated search session.

## Consequences

### Positive

- No API key or provider routing configuration is stored in Grayjay settings.
- No modification is required in the separately distributed YouTube plugin.
- The command can reuse the established Routr `balanced-cheap` profile and headers.
- Missing configuration degrades to ordinary search rather than a broken search page.

### Negative

- Smart Search requires one local command setup, like Smart Chapters.
- Query translation adds a network/model round trip before international variants start.
- It produces language-oriented search angles, not a guarantee of country-specific platform ranking.

## Alternatives rejected

- Direct provider configuration in the BlueJay settings: duplicates secret management.
- Hard-coding a Routr endpoint: not portable and unsuitable for upstream adoption.
- Editing the YouTube plugin locale: changes the baseline search behavior and is overwritten by plugin updates.
