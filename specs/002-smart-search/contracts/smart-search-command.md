# Contract: Smart Search translator command

## Invocation

BlueJay starts the configured executable without interpolating the search query in a shell command. It sends one JSON document on standard input and reads one JSON document from standard output.

The executable is responsible for provider-specific configuration, including Routr headers and credentials.

## Query translation input

```json
{
  "version": 1,
  "operation": "translate-queries",
  "sourceLanguage": "fr",
  "targetLanguages": ["ja", "zh-Hans", "ar", "ru"],
  "query": "dernieres informations sur Anthropic Fable 5"
}
```

## Query translation output

```json
{
  "version": 1,
  "translations": [
    { "language": "ja", "text": "Anthropic Fable 5 最新情報" },
    { "language": "zh-Hans", "text": "Anthropic Fable 5 最新消息" },
    { "language": "ar", "text": "أحدث أخبار Anthropic Fable 5" },
    { "language": "ru", "text": "Последние новости Anthropic Fable 5" }
  ]
}
```

## Title translation input

```json
{
  "version": 1,
  "operation": "translate-titles",
  "targetLanguage": "fr",
  "titles": [
    { "key": "youtube:abc123", "text": "Anthropic Fable 5 最新情報" }
  ]
}
```

## Title translation output

```json
{
  "version": 1,
  "translations": [
    { "key": "youtube:abc123", "text": "Dernieres informations sur Anthropic Fable 5" }
  ]
}
```

## Failure contract

- Exit status non-zero: BlueJay records a sanitized command failure and keeps normal search results.
- Invalid JSON: BlueJay rejects that phase, does not retry blindly, and leaves source titles visible.
- Missing requested language/key: BlueJay treats only that item as unavailable.
- Extra language/key: BlueJay ignores it.
