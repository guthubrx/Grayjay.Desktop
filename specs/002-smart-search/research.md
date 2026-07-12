# Research: Smart Search

## Existing application findings

### Search has one active pager per client state

`SearchController.SearchLoadLazy` stores its result in `State().SearchState.SearchPager`. Reissuing the normal endpoint for every language would replace the prior search pager. Smart Search therefore needs an isolated composed pager/session on the server; the browser must not fan out calls to the existing endpoint itself.

Evidence:
- `Grayjay.ClientServer/Controllers/SearchController.cs:19-46`
- `Grayjay.ClientServer/States/StatePlatform.cs:278-284`

### Existing search is already lazy and source-parallel

`StatePlatform.SearchLazy` creates a distributed lazy pager across enabled sources. A Smart Search variant can reuse that operation once per validated language query, while bounding the initial page count and preserving the normal source filters.

Evidence:
- `Grayjay.ClientServer/States/StatePlatform.cs:278-284`
- `Grayjay.ClientServer/States/StatePlatform.cs:601-631`

### The installed YouTube plugin does not translate titles

The plugin posts the given query to YouTube, then maps the returned `videoRenderer.title` directly into the platform content name. It has no title translation layer.

Evidence:
- `/Users/moi/Library/Application Support/Grayjay/plugin_scripts/35ae969a-a7db-11ed-afa1-0242ac120002:738-750`
- `/Users/moi/Library/Application Support/Grayjay/plugin_scripts/35ae969a-a7db-11ed-afa1-0242ac120002:9315-9325`
- `/Users/moi/Library/Application Support/Grayjay/plugin_scripts/35ae969a-a7db-11ed-afa1-0242ac120002:9415-9424`

### Smart Chapters already use an external command without putting provider secrets in Grayjay

The current Smart Chapters pattern stores only an external command in local persistent storage. The server runs that command and passes data to it. It is the correct local precedent for Smart Search because Routr credentials and routing headers stay outside the application settings.

Evidence:
- `Grayjay.Desktop.Web/src/state/StateHighlightsIndexer.ts`
- `Grayjay.ClientServer/States/StateHighlightsIndexer.cs`
- `tools/generate_smart_chapters.py:1462-1519`

## Live validation

### YouTube language and regional relevance are meaningful dimensions

Google documents `relevanceLanguage` as a ranking preference and `regionCode` as a viewability/content-region constraint; results in other languages may still appear. This supports exposing the language angle in BlueJay rather than claiming a perfect simulation of a local user or region.

Source: [YouTube Data API search.list](https://developers.google.com/youtube/v3/docs/search/list).

### Localized YouTube metadata is possible but not guaranteed

Google documents that localized video text is returned only when a requested UI language has localized text available. BlueJay must retain the source title and treat a French display title as optional enrichment, not authoritative replacement.

Source: [YouTube Data API videos](https://developers.google.com/youtube/v3/docs/videos).

### Structured output should be validated at the boundary

OpenAI documents JSON-schema structured outputs as preferred over older JSON mode where supported. Routr is OpenAI-compatible but can route different providers, so the external command must still validate exact response cardinality, language tags and non-empty strings before returning data to BlueJay.

Source: [OpenAI structured outputs reference](https://platform.openai.com/docs/api-reference/evals/run-output-item-object?lang=node).

## Decisions

### Decision: optional external translator command

**Decision**: Smart Search invokes an opt-in local command configured by the user. The command receives a JSON request through standard input and returns a constrained JSON response through standard output.

**Rationale**: It preserves the existing Smart Chapters boundary, keeps Routr credentials out of `settings.json`, and allows the user to retain their current `balanced-cheap` routing configuration and headers.

**Alternatives considered**:
- Store Routr URL and API key in `GrayjaySettings`: rejected because it duplicates secret handling inside the app and broadens the configuration surface.
- Modify the YouTube plugin locale: rejected because it is a separately distributed component and affects standard search globally.
- Translate in the browser: rejected because browser code cannot safely own local provider credentials.

### Decision: normal search first, international enrichment second

**Decision**: The ordinary search starts immediately. Smart Search runs as an opt-in parallel enrichment that adds international sections as each language resolves.

**Rationale**: An LLM round trip is unavoidable for a query written in a different language. Making it a prerequisite would degrade every search and contradict the responsiveness objective.

### Decision: one translation request for all query variants and one bounded batch for visible titles

**Decision**: One command invocation creates all selected language variants. A later bounded invocation translates only the visible non-French titles not already cached.

**Rationale**: This limits latency and routing overhead while keeping the source title immediately usable. A per-title call would amplify latency and costs without user value.

### Decision: language-angle search, not false regional impersonation

**Decision**: The first PR searches translated queries and labels the language used. It does not promise a Japanese, Chinese, Arabic or Russian network/location context.

**Rationale**: Query language reliably changes vocabulary and reachable sources. Region-specific ranking requires plugin support and should remain a later, separately validated concern.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Slow or unavailable Routr route | Normal results remain independent; language-level errors are shown without clearing content. |
| Excess platform fan-out | Cap selected languages, use one first page per language, and delay title translation until results are visible. |
| Wrong translation or invented query terms | Preserve the original query/result title, require structured output, validate every requested language, and allow inspection of each generated query. |
| Stale async response | Bind all outputs to a generated session id and ignore results from superseded sessions. |
| Public metadata sent to provider | Send only the query and public titles needed for a user-triggered request; cache locally and document the boundary. |
