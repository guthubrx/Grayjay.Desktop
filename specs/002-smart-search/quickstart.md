# Quickstart: Smart Search

## Preconditions

1. BlueJay standard search works with at least one enabled source.
2. A local Smart Search translator command is configured. It owns the Routr `balanced-cheap` routing settings and credentials outside BlueJay.
3. The command implements [the JSON contract](contracts/smart-search-command.md).

## Scenario 1: normal search unchanged

1. Search for a French query without enabling Smart Search.
2. Verify that the regular results and pagination behave as before.
3. Verify that no translator command is started.

## Scenario 2: international search

1. Search for `dernieres informations sur Anthropic Fable 5`.
2. Enable Smart Search and select Japanese, Simplified Chinese, Arabic and Russian.
3. Verify that standard results remain visible while international sections load.
4. Verify that each section shows its language, generated query and any localized results.
5. Verify a duplicated URL occurs only once and carries all relevant language labels.

## Scenario 3: translated title

1. Open an international section containing a non-French title.
2. Verify the original title remains visible.
3. Verify the French translation appears beneath it when the command returns it.
4. Repeat the search and verify cached translations do not trigger a new title translation call.

## Scenario 4: degraded mode

1. Remove or break the Smart Search command configuration.
2. Run a normal search: it must remain functional.
3. Request Smart Search: verify a local configuration/error message appears and no existing result disappears.
