#!/usr/bin/env python3
"""Traducteur JSON stdin/stdout pour BlueJay Smart Search."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(2)


def read_request() -> dict:
    try:
        request = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        fail(f"Invalid Smart Search request JSON: {exc.msg}")
    if not isinstance(request, dict) or request.get("version") != 1:
        fail("Unsupported Smart Search request.")
    return request


def headers() -> dict[str, str]:
    values = {
        "X-Routr-Client": os.environ.get("ROUTR_CLIENT", "bluejay-smart-search"),
        "X-Routr-Phase": os.environ.get("ROUTR_PHASE", "interactive-search"),
        "X-Routr-Profile": os.environ.get("ROUTR_PROFILE", "balanced-cheap"),
        "X-Routr-Prompt-Version": os.environ.get("ROUTR_PROMPT_VERSION", "smart-search-v1"),
        "X-Routr-Caller-Id": os.environ.get("ROUTR_CALLER_ID", "bluejay-smart-search"),
        "X-Routr-Session-Mode": os.environ.get("ROUTR_SESSION_MODE", "none"),
    }
    return {"Content-Type": "application/json", "Authorization": f"Bearer {os.environ.get('ROUTR_API_KEY', 'routr-local')}", **{k: v for k, v in values.items() if v}}


def call_model(prompt: str) -> dict:
    payload = {
        "model": os.environ.get("ROUTR_MODEL", "balanced-cheap"),
        "messages": [
            {"role": "system", "content": "Return only valid JSON matching the requested schema."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0,
        "stream": False,
        "response_format": {"type": "json_object"},
    }
    url = os.environ.get("ROUTR_API_BASE", "http://127.0.0.1:7205/v1").rstrip("/") + "/chat/completions"
    request = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers(), method="POST")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = json.loads(response.read().decode("utf-8"))
        return json.loads(raw["choices"][0]["message"]["content"])
    except (urllib.error.URLError, urllib.error.HTTPError, KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        fail(f"Smart Search translator failed: {exc}")


def non_empty_text(value: object) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def translate_queries(request: dict) -> dict:
    query = non_empty_text(request.get("query"))
    languages = request.get("targetLanguages")
    if not query or not isinstance(languages, list) or not languages or any(not isinstance(x, str) for x in languages):
        fail("Invalid query translation request.")
    prompt = (
        "Translate this web-video search query into each requested language. Preserve quoted terms, proper names, product names, operators and URLs. "
        "Return JSON only: {\"translations\":[{\"language\":\"requested tag\",\"text\":\"query\"}]}. "
        f"Query: {query}\nRequested languages: {json.dumps(languages)}"
    )
    response = call_model(prompt)
    entries = response.get("translations") if isinstance(response, dict) else None
    if not isinstance(entries, list):
        fail("Translator response has no translations array.")
    translated = {item.get("language"): non_empty_text(item.get("text")) for item in entries if isinstance(item, dict)}
    result = []
    for language in languages:
        text = translated.get(language)
        if text:
            result.append({"language": language, "text": text})
    if not result:
        fail("Translator returned no usable query translation.")
    return {"version": 1, "translations": result}


def translate_titles(request: dict) -> dict:
    target = non_empty_text(request.get("targetLanguage"))
    titles = request.get("titles")
    if not target or not isinstance(titles, list):
        fail("Invalid title translation request.")
    valid = [{"key": item.get("key"), "text": non_empty_text(item.get("text"))} for item in titles if isinstance(item, dict)]
    valid = [item for item in valid if isinstance(item["key"], str) and item["text"]]
    if not valid:
        return {"version": 1, "translations": []}
    prompt = (
        f"Translate these public video titles into {target}. Preserve names, acronyms and product names. "
        "Return JSON only: {\"translations\":[{\"key\":\"input key\",\"text\":\"translated title\"}]}. "
        f"Titles: {json.dumps(valid, ensure_ascii=False)}"
    )
    response = call_model(prompt)
    entries = response.get("translations") if isinstance(response, dict) else None
    if not isinstance(entries, list):
        fail("Translator response has no translations array.")
    allowed = {item["key"] for item in valid}
    return {"version": 1, "translations": [{"key": item.get("key"), "text": text} for item in entries if isinstance(item, dict) and item.get("key") in allowed and (text := non_empty_text(item.get("text")))]}


def main() -> None:
    request = read_request()
    operation = request.get("operation")
    if operation == "translate-queries":
        result = translate_queries(request)
    elif operation == "translate-titles":
        result = translate_titles(request)
    else:
        fail("Unsupported Smart Search operation.")
    json.dump(result, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
