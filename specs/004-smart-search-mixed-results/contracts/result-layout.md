# Contract: Smart Search Result Layout

The existing persisted `smartSearch.settings` JSON gains an optional field:

```json
{
  "resultLayout": "grouped"
}
```

Allowed values:

- `grouped`: render language sections, preserving existing behavior.
- `mixed`: merge Standard and Smart result lanes into one grid.

Missing or invalid values resolve to `grouped`.

No server API response changes are required. The frontend combines the existing Standard pager data and Smart Search session snapshot.
