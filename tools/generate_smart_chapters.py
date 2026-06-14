#!/usr/bin/env python3
"""
Generate Grayjay Smart Chapters from YouTube subtitles or Whisper fallback.

Examples:
  python3 tools/generate_smart_chapters.py --url https://www.youtube.com/watch?v=oQ0luPrzcJM
  python3 tools/generate_smart_chapters.py --playlist "Metacognition" --model qwen3:8b
  python3 tools/generate_smart_chapters.py --grayjay-video "Bitter Lesson" --overwrite
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import textwrap
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_GRAYJAY_DIR = Path.home() / "Library/Application Support/Grayjay"
DEFAULT_WHISPER_SCRIPT = Path("/Users/moi/11.Repositories/whisper.cpp/transcribe.sh")


@dataclass
class VideoTask:
    url: str
    title: str | None = None
    duration: float | None = None
    video: dict[str, Any] | None = None
    local_file: str | None = None


@dataclass
class TranscriptCue:
    start: float
    end: float
    text: str


def log(message: str) -> None:
    print(message, flush=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate Smart Chapters JSON files in Grayjay's highlights store."
    )
    targets = parser.add_argument_group("targets")
    targets.add_argument("--url", action="append", default=[], help="Video URL. Can be repeated.")
    targets.add_argument("--media-file", action="append", default=[], help="Local audio/video file. Can be repeated.")
    targets.add_argument("--urls-file", help="Text file containing one video URL per line.")
    targets.add_argument("--playlist", action="append", default=[], help="Grayjay playlist name, Id, or file id. Can be repeated.")
    targets.add_argument("--grayjay-video", action="append", default=[], help="Search local Grayjay videos by URL, YouTube id, or title substring.")
    targets.add_argument("--list-playlists", action="store_true", help="List local Grayjay playlists and exit.")
    targets.add_argument("--interactive", action="store_true", help="Interactive wizard that prints a non-interactive command.")

    generation = parser.add_argument_group("generation")
    generation.add_argument(
        "--provider",
        choices=["ollama", "openai"],
        default="ollama",
        help="LLM backend. 'ollama' for local Ollama, 'openai' for any OpenAI-compatible chat API (DeepSeek, OpenAI, etc.).",
    )
    generation.add_argument("--model", default="qwen3:8b", help="Model name (e.g. qwen3:8b for Ollama, deepseek-chat for DeepSeek).")
    generation.add_argument("--ollama-url", default="http://127.0.0.1:11434", help="Ollama base URL.")
    generation.add_argument(
        "--api-base",
        default="https://api.deepseek.com/v1",
        help="Base URL of the OpenAI-compatible API (used when --provider openai).",
    )
    generation.add_argument(
        "--api-key",
        default=os.environ.get("DEEPSEEK_API_KEY") or os.environ.get("OPENAI_API_KEY"),
        help="API key for the OpenAI-compatible endpoint. Defaults to $DEEPSEEK_API_KEY or $OPENAI_API_KEY.",
    )
    generation.add_argument("--max-segments", type=int, default=16, help="Maximum Smart Chapter segments.")
    generation.add_argument("--max-theses", type=int, default=2, help="Maximum number of main theses extracted in the analysis pass (1-3).")
    generation.add_argument("--min-segment-seconds", type=int, default=45, help="Preferred minimum segment duration.")
    generation.add_argument("--max-segment-seconds", type=int, default=360, help="Preferred maximum segment duration.")
    generation.add_argument("--max-transcript-chars", type=int, default=52000, help="Transcript character budget sent to LLM.")
    generation.add_argument("--language", default="fr", help="Preferred transcript/Whisper language.")
    generation.add_argument("--sub-langs", default="fr.*,fr,en.*,en", help="yt-dlp subtitle languages.")
    generation.add_argument("--refresh-analysis", action="store_true", help="Ignore cached analysis (theses + global summary) and re-run pass 1.")

    fallback = parser.add_argument_group("transcription")
    fallback.add_argument("--transcript-cache-dir", help="Directory to cache transcripts. Defaults to <grayjay-dir>/transcripts_cache.")
    fallback.add_argument("--no-transcript-cache", action="store_true", help="Do not read or write the transcript cache.")
    fallback.add_argument("--refresh-transcript", action="store_true", help="Ignore any cached transcript and fetch it again.")
    fallback.add_argument("--skip-youtube-transcript", action="store_true", help="Skip yt-dlp subtitles and use Whisper fallback.")
    fallback.add_argument("--no-whisper", action="store_true", help="Do not use Whisper fallback.")
    fallback.add_argument("--whisper-script", default=str(DEFAULT_WHISPER_SCRIPT), help="Path to whisper.cpp transcribe.sh.")
    fallback.add_argument("--whisper-model", default="base", help="Whisper model passed to transcribe.sh.")
    fallback.add_argument("--cookies-from-browser", help="Pass browser cookies to yt-dlp (e.g. firefox) to avoid HTTP 429 on subtitles.")

    output = parser.add_argument_group("output")
    output.add_argument("--grayjay-dir", default=str(DEFAULT_GRAYJAY_DIR), help="Grayjay application data directory.")
    output.add_argument("--output-dir", help="Override highlights output directory.")
    output.add_argument("--overwrite", action="store_true", help="Overwrite an existing highlights file.")
    output.add_argument("--dry-run", action="store_true", help="Do not write files.")
    output.add_argument("--keep-workdir", action="store_true", help="Keep temporary transcript files.")

    args = parser.parse_args()
    if not args.list_playlists and not args.interactive and not any([args.url, args.media_file, args.urls_file, args.playlist, args.grayjay_video]):
        parser.error("Provide --url, --media-file, --urls-file, --playlist, --grayjay-video, or --list-playlists.")
    return args


def load_json(path: Path) -> Any | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def grayjay_playlists(grayjay_dir: Path) -> list[tuple[Path, dict[str, Any]]]:
    playlists_dir = grayjay_dir / "playlists"
    if not playlists_dir.exists():
        return []

    playlists: list[tuple[Path, dict[str, Any]]] = []
    for path in playlists_dir.iterdir():
        if not path.is_file():
            continue
        data = load_json(path)
        if isinstance(data, dict) and isinstance(data.get("Videos"), list):
            playlists.append((path, data))
    return playlists


def print_playlists(grayjay_dir: Path) -> None:
    playlists = grayjay_playlists(grayjay_dir)
    for path, data in sorted(playlists, key=lambda item: (item[1].get("Name") or "").lower()):
        videos = data.get("Videos") or []
        print(f"{data.get('Name', '(unnamed)')} | id={data.get('Id')} | file={path.name} | videos={len(videos)}")


def interactive_command(args: argparse.Namespace) -> int:
    grayjay_dir = Path(args.grayjay_dir).expanduser()
    script_path = Path(__file__).resolve()
    command = ["python3", str(script_path)]

    print("Smart Chapters generator wizard")
    print("")
    print("Target:")
    print("  1. Video URL")
    print("  2. Grayjay playlist")
    print("  3. Grayjay video search")
    print("  4. URLs file")
    print("  5. Local media file")
    target_choice = ask_choice("Choose target", ["1", "2", "3", "4", "5"], default="1")

    if target_choice == "1":
        command += ["--url", ask_required("Video URL")]
    elif target_choice == "2":
        playlists = sorted(grayjay_playlists(grayjay_dir), key=lambda item: (item[1].get("Name") or "").lower())
        if not playlists:
            raise SystemExit(f"No playlists found in {grayjay_dir / 'playlists'}")
        print("")
        for index, (path, data) in enumerate(playlists, start=1):
            videos = data.get("Videos") or []
            print(f"  {index}. {data.get('Name', '(unnamed)')} | videos={len(videos)} | id={data.get('Id')} | file={path.name}")
        selected = ask_int("Playlist number", 1, len(playlists))
        selected_path, _ = playlists[selected - 1]
        command += ["--playlist", selected_path.name]
    elif target_choice == "3":
        command += ["--grayjay-video", ask_required("Search by title, URL, or YouTube id")]
    elif target_choice == "4":
        command += ["--urls-file", ask_required("URLs file path")]
    elif target_choice == "5":
        command += ["--media-file", ask_required("Local media file path")]

    print("")
    print("LLM backend:")
    print("  1. Ollama (local)")
    print("  2. OpenAI-compatible (DeepSeek, OpenAI, ...)")
    provider_choice = ask_choice("Choose backend", ["1", "2"], default="1" if args.provider == "ollama" else "2")

    if provider_choice == "2":
        command += ["--provider", "openai"]
        default_model = "deepseek-chat" if args.model == "qwen3:8b" else args.model
        model = ask_default("Model name", default_model)
        command += ["--model", model]

        api_base = ask_default("API base URL", args.api_base)
        command += ["--api-base", api_base]

        if not args.api_key:
            print("(no API key found in $DEEPSEEK_API_KEY / $OPENAI_API_KEY)")
            api_key = input("API key (leave blank to set it via env var later): ").strip()
            if api_key:
                command += ["--api-key", api_key]
    else:
        command += ["--provider", "ollama"]
        model = ask_default("Ollama model", args.model)
        command += ["--model", model]

    whisper_model = ask_default("Whisper fallback model", args.whisper_model)
    command += ["--whisper-model", whisper_model]

    max_segments = ask_default("Max Smart Chapters segments", str(args.max_segments))
    command += ["--max-segments", max_segments]

    max_theses = ask_default("Max theses extracted (1-3)", str(args.max_theses))
    command += ["--max-theses", max_theses]

    overwrite = ask_yes_no("Overwrite existing Smart Chapters?", default=False)
    if overwrite:
        command.append("--overwrite")

    skip_youtube = ask_yes_no("Force Whisper instead of YouTube subtitles?", default=False)
    if skip_youtube:
        command.append("--skip-youtube-transcript")

    refresh_transcript = ask_yes_no("Ignore cached transcript and fetch it again?", default=False)
    if refresh_transcript:
        command.append("--refresh-transcript")

    refresh_analysis = ask_yes_no("Ignore cached analysis (theses + summary) and re-run?", default=False)
    if refresh_analysis:
        command.append("--refresh-analysis")

    no_cache = ask_yes_no("Disable transcript cache entirely?", default=False)
    if no_cache:
        command.append("--no-transcript-cache")

    dry_run = ask_yes_no("Dry run only?", default=False)
    if dry_run:
        command.append("--dry-run")

    if str(grayjay_dir) != str(DEFAULT_GRAYJAY_DIR):
        command += ["--grayjay-dir", str(grayjay_dir)]

    print("")
    print("Non-interactive command:")
    print(" ".join(shlex.quote(part) for part in command))
    return 0


def ask_required(label: str) -> str:
    while True:
        value = input(f"{label}: ").strip()
        if value:
            return value


def ask_default(label: str, default: str) -> str:
    value = input(f"{label} [{default}]: ").strip()
    return value or default


def ask_choice(label: str, choices: list[str], default: str) -> str:
    suffix = "/".join(choices)
    while True:
        value = input(f"{label} ({suffix}) [{default}]: ").strip() or default
        if value in choices:
            return value


def ask_int(label: str, minimum: int, maximum: int) -> int:
    while True:
        raw = input(f"{label} [{minimum}-{maximum}]: ").strip()
        try:
            value = int(raw)
        except ValueError:
            continue
        if minimum <= value <= maximum:
            return value


def ask_yes_no(label: str, default: bool) -> bool:
    suffix = "Y/n" if default else "y/N"
    while True:
        raw = input(f"{label} ({suffix}): ").strip().lower()
        if not raw:
            return default
        if raw in {"y", "yes", "o", "oui"}:
            return True
        if raw in {"n", "no", "non"}:
            return False


def canonical_url(value: str) -> str:
    youtube_id = extract_youtube_id(value)
    if youtube_id:
        return f"https://www.youtube.com/watch?v={youtube_id}"
    return value.strip()


def extract_youtube_id(value: str | None) -> str | None:
    if not value:
        return None
    patterns = [
        r"(?:youtube(?:-nocookie)?\.com/(?:watch\?[^#\s]*v=|embed/|shorts/|live/)|youtu\.be/)([A-Za-z0-9_-]{11})",
        r"(?:[?&]v=)([A-Za-z0-9_-]{11})",
        r"^[A-Za-z0-9_-]{11}$",
    ]
    for pattern in patterns:
        match = re.search(pattern, value, flags=re.IGNORECASE)
        if match:
            return match.group(1) if match.groups() else match.group(0)
    return None


def video_from_grayjay_item(item: dict[str, Any]) -> VideoTask | None:
    url = item.get("Url") or item.get("ShareUrl")
    video_id = ((item.get("ID") or {}).get("Value") if isinstance(item.get("ID"), dict) else None)
    if not url and video_id:
        url = canonical_url(video_id)
    if not url:
        return None

    return VideoTask(
        url=canonical_url(url),
        title=item.get("Name"),
        duration=to_float(item.get("Duration")),
        video=item,
    )


def to_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def iter_grayjay_videos(grayjay_dir: Path) -> list[VideoTask]:
    tasks: list[VideoTask] = []

    for _, playlist in grayjay_playlists(grayjay_dir):
        for item in playlist.get("Videos") or []:
            if isinstance(item, dict):
                task = video_from_grayjay_item(item)
                if task:
                    tasks.append(task)

    for folder_name in ["watchLater", "downloaded"]:
        folder = grayjay_dir / folder_name
        if not folder.exists():
            continue
        for path in folder.iterdir():
            if not path.is_file():
                continue
            data = load_json(path)
            if isinstance(data, dict):
                task = video_from_grayjay_item(data)
                if task:
                    tasks.append(task)

    return dedupe_tasks(tasks)


def resolve_tasks(args: argparse.Namespace) -> list[VideoTask]:
    grayjay_dir = Path(args.grayjay_dir).expanduser()
    tasks: list[VideoTask] = []

    for url in args.url:
        tasks.append(VideoTask(url=canonical_url(url)))

    for media_file in args.media_file:
        path = Path(media_file).expanduser().resolve()
        grayjay_task = find_grayjay_video_by_local_file(grayjay_dir, path)
        if grayjay_task:
            grayjay_task.local_file = str(path)
            tasks.append(grayjay_task)
        else:
            tasks.append(VideoTask(url=path.as_uri(), title=path.stem, local_file=str(path)))

    if args.urls_file:
        for line in Path(args.urls_file).expanduser().read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                tasks.append(VideoTask(url=canonical_url(line)))

    playlists = grayjay_playlists(grayjay_dir)
    for selector in args.playlist:
        selector_lower = selector.lower()
        matches = [
            data for path, data in playlists
            if selector_lower in {
                str(data.get("Id", "")).lower(),
                str(data.get("Name", "")).lower(),
                path.name.lower(),
            }
        ]
        if not matches:
            matches = [
                data for _, data in playlists
                if selector_lower in str(data.get("Name", "")).lower()
            ]
        if not matches:
            raise SystemExit(f"No Grayjay playlist matched: {selector}")
        for playlist in matches:
            for item in playlist.get("Videos") or []:
                if isinstance(item, dict):
                    task = video_from_grayjay_item(item)
                    if task:
                        tasks.append(task)

    if args.grayjay_video:
        all_videos = iter_grayjay_videos(grayjay_dir)
        for query in args.grayjay_video:
            query_lower = query.lower()
            query_youtube_id = extract_youtube_id(query)
            matches: list[VideoTask] = []
            for task in all_videos:
                task_youtube_id = extract_youtube_id(task.url)
                if query_youtube_id and task_youtube_id == query_youtube_id:
                    matches.append(task)
                elif query_lower in task.url.lower() or query_lower in (task.title or "").lower():
                    matches.append(task)
            if not matches:
                raise SystemExit(f"No Grayjay video matched: {query}")
            tasks.extend(matches)

    return dedupe_tasks(tasks)


def find_grayjay_video_by_local_file(grayjay_dir: Path, media_file: Path) -> VideoTask | None:
    for folder_name in ["downloaded", "downloads_ongoing"]:
        folder = grayjay_dir / folder_name
        if not folder.exists():
            continue
        for path in folder.iterdir():
            if not path.is_file():
                continue
            data = load_json(path)
            if isinstance(data, dict) and json_contains_file_path(data, media_file):
                return video_from_grayjay_item(data)
    return None


def json_contains_file_path(value: Any, media_file: Path) -> bool:
    if isinstance(value, dict):
        file_path = value.get("FilePath")
        if isinstance(file_path, str):
            try:
                if Path(file_path).expanduser().resolve() == media_file:
                    return True
            except OSError:
                pass
        return any(json_contains_file_path(child, media_file) for child in value.values())
    if isinstance(value, list):
        return any(json_contains_file_path(child, media_file) for child in value)
    return False


def dedupe_tasks(tasks: list[VideoTask]) -> list[VideoTask]:
    seen: set[str] = set()
    result: list[VideoTask] = []
    for task in tasks:
        key = canonical_url(task.url)
        if key in seen:
            continue
        seen.add(key)
        task.url = key
        result.append(task)
    return result


def run_command(cmd: list[str], *, cwd: Path | None = None, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=str(cwd) if cwd else None,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=check,
    )


def ytdlp_cookie_args(args: argparse.Namespace) -> list[str]:
    return ["--cookies-from-browser", args.cookies_from_browser] if getattr(args, "cookies_from_browser", None) else []


def fetch_video_metadata(task: VideoTask, args: argparse.Namespace) -> VideoTask:
    if task.title and task.duration:
        return task
    if not extract_youtube_id(task.url):
        return task
    try:
        proc = run_command(["yt-dlp", "--dump-json", "--skip-download", *ytdlp_cookie_args(args), task.url], check=True)
        data = json.loads(proc.stdout)
        task.title = task.title or data.get("title")
        task.duration = task.duration or to_float(data.get("duration"))
    except Exception as exc:
        log(f"  metadata warning: {exc}")
    return task


def transcript_cache_dir(args: argparse.Namespace) -> Path:
    if args.transcript_cache_dir:
        return Path(args.transcript_cache_dir).expanduser()
    return Path(args.grayjay_dir).expanduser() / "transcripts_cache"


def transcript_cache_path(url: str, args: argparse.Namespace) -> Path:
    digest = hashlib.sha256(url.strip().encode("utf-8")).hexdigest()
    return transcript_cache_dir(args) / f"{digest}.json"


def load_cached_transcript(task: VideoTask, args: argparse.Namespace) -> list[TranscriptCue] | None:
    if args.no_transcript_cache or args.refresh_transcript:
        return None
    data = load_json(transcript_cache_path(task.url, args))
    if not isinstance(data, dict):
        return None
    raw_cues = data.get("cues")
    if not isinstance(raw_cues, list):
        return None
    cues: list[TranscriptCue] = []
    for item in raw_cues:
        if not isinstance(item, dict):
            continue
        start = to_float(item.get("start"))
        end = to_float(item.get("end"))
        text = item.get("text")
        if start is None or end is None or not isinstance(text, str):
            continue
        cues.append(TranscriptCue(start=start, end=end, text=text))
    return cues or None


def save_cached_transcript(task: VideoTask, cues: list[TranscriptCue], source: str, args: argparse.Namespace) -> None:
    if args.no_transcript_cache:
        return
    cache_dir = transcript_cache_dir(args)
    cache_dir.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")
    payload = {
        "schemaVersion": 1,
        "videoUrl": task.url,
        "title": task.title,
        "source": source,
        "updatedAt": now,
        "cues": [{"start": cue.start, "end": cue.end, "text": cue.text} for cue in cues],
    }
    transcript_cache_path(task.url, args).write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def analysis_cache_path(url: str, args: argparse.Namespace) -> Path:
    digest = hashlib.sha256(url.strip().encode("utf-8")).hexdigest()
    base = Path(args.transcript_cache_dir).expanduser() if args.transcript_cache_dir else Path(args.grayjay_dir).expanduser() / "transcripts_cache"
    return base.parent / "analysis_cache" / f"{digest}.json"


def load_cached_analysis(task: VideoTask, args: argparse.Namespace) -> dict[str, Any] | None:
    if args.no_transcript_cache or args.refresh_analysis:
        return None
    data = load_json(analysis_cache_path(task.url, args))
    if not isinstance(data, dict):
        return None
    if not isinstance(data.get("theses"), list) or not isinstance(data.get("globalSummary"), str):
        return None
    return data


def save_cached_analysis(task: VideoTask, analysis: dict[str, Any], args: argparse.Namespace) -> None:
    if args.no_transcript_cache:
        return
    path = analysis_cache_path(task.url, args)
    path.parent.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")
    payload = {
        "schemaVersion": 1,
        "videoUrl": task.url,
        "updatedAt": now,
        **analysis,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def get_transcript(task: VideoTask, args: argparse.Namespace, workdir: Path) -> list[TranscriptCue]:
    cached = load_cached_transcript(task, args)
    if cached:
        log(f"  transcript: cached ({len(cached)} cues)")
        return cached

    if not args.skip_youtube_transcript and extract_youtube_id(task.url):
        cues = get_youtube_subtitle_transcript(task.url, args, workdir)
        if cues:
            log(f"  transcript: YouTube subtitles ({len(cues)} cues)")
            save_cached_transcript(task, cues, "youtube-subtitles", args)
            return cues

    if args.no_whisper:
        raise RuntimeError("No YouTube transcript found and --no-whisper is set.")

    cues = get_whisper_transcript(task, args, workdir)
    if cues:
        log(f"  transcript: Whisper fallback ({len(cues)} cues)")
        save_cached_transcript(task, cues, f"whisper-{args.whisper_model}", args)
        return cues
    raise RuntimeError("No transcript could be produced.")


def get_youtube_subtitle_transcript(url: str, args: argparse.Namespace, workdir: Path) -> list[TranscriptCue]:
    if not shutil.which("yt-dlp"):
        return []
    before = set(workdir.glob("*"))
    cmd = [
        "yt-dlp",
        "--skip-download",
        "--write-subs",
        "--write-auto-subs",
        "--sub-langs",
        args.sub_langs,
        "--sub-format",
        "vtt/best",
        "-o",
        "%(id)s.%(ext)s",
        # Attenuer le rate-limit YouTube (HTTP 429) sur les sous-titres.
        "--retries", "3",
        "--sleep-subtitles", "1",
        *ytdlp_cookie_args(args),
        url,
    ]
    # On ignore le returncode : yt-dlp peut echouer sur une langue (ex 429 sur
    # fr) tout en ayant ecrit une autre (en). On se fie aux .vtt reellement
    # produits.
    run_command(cmd, cwd=workdir, check=False)

    candidates = [path for path in workdir.glob("*.vtt") if path not in before]
    candidates += [path for path in workdir.glob("*.vtt") if path not in candidates]
    if not candidates:
        return []

    candidates.sort(key=lambda path: subtitle_priority(path.name))
    for path in candidates:
        cues = parse_vtt(path.read_text(encoding="utf-8", errors="ignore"))
        if cues:
            return cues
    return []


def subtitle_priority(name: str) -> tuple[int, str]:
    lower = name.lower()
    if ".fr" in lower:
        return (0, lower)
    if ".en" in lower:
        return (1, lower)
    return (2, lower)


def parse_vtt(text: str) -> list[TranscriptCue]:
    cues: list[TranscriptCue] = []
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if "-->" not in line:
            i += 1
            continue
        start_text, end_text = line.split("-->", 1)
        start = parse_timestamp(start_text.strip())
        end = parse_timestamp(end_text.split()[0].strip())
        i += 1
        payload: list[str] = []
        while i < len(lines) and lines[i].strip():
            payload.append(lines[i].strip())
            i += 1
        clean = clean_caption_text(" ".join(payload))
        if clean and (not cues or cues[-1].text != clean):
            cues.append(TranscriptCue(start=start, end=max(end, start + 0.1), text=clean))
        i += 1
    return merge_short_cues(cues)


def parse_timestamp(value: str) -> float:
    value = value.replace(",", ".")
    parts = value.split(":")
    if len(parts) == 3:
        hours, minutes, seconds = parts
    elif len(parts) == 2:
        hours = "0"
        minutes, seconds = parts
    else:
        return 0.0
    return int(hours) * 3600 + int(minutes) * 60 + float(seconds)


def clean_caption_text(value: str) -> str:
    value = re.sub(r"<[^>]+>", "", value)
    value = re.sub(r"\{\\an\d+\}", "", value)
    value = html.unescape(value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def merge_short_cues(cues: list[TranscriptCue], target_seconds: float = 18.0) -> list[TranscriptCue]:
    if not cues:
        return []
    merged: list[TranscriptCue] = []
    current = TranscriptCue(cues[0].start, cues[0].end, cues[0].text)
    for cue in cues[1:]:
        if current.end - current.start < target_seconds and len(current.text) < 700:
            current.end = max(current.end, cue.end)
            if cue.text not in current.text:
                current.text = f"{current.text} {cue.text}".strip()
        else:
            merged.append(current)
            current = TranscriptCue(cue.start, cue.end, cue.text)
    merged.append(current)
    return merged


def get_whisper_transcript(task: VideoTask, args: argparse.Namespace, workdir: Path) -> list[TranscriptCue]:
    script = Path(args.whisper_script).expanduser()
    if not script.exists():
        raise RuntimeError(f"Whisper script not found: {script}")
    output = workdir / "whisper.txt"
    input_value = task.local_file or task.url
    cmd = [
        str(script),
        "--input",
        input_value,
        "--output",
        str(output),
        "--model",
        args.whisper_model,
    ]
    proc = run_command(cmd, check=False)
    if proc.returncode != 0:
        raise RuntimeError(f"Whisper failed: {proc.stderr.strip() or proc.stdout.strip()}")
    return parse_whisper_text(output.read_text(encoding="utf-8", errors="ignore"), task.duration)


def parse_whisper_text(text: str, duration: float | None) -> list[TranscriptCue]:
    timestamped: list[TranscriptCue] = []
    pattern = re.compile(
        r"^\s*\[?(\d{2}:\d{2}:\d{2}(?:[\.,]\d+)?)\s*-->\s*(\d{2}:\d{2}:\d{2}(?:[\.,]\d+)?)\]?\s*(.*)$"
    )
    for line in text.splitlines():
        match = pattern.match(line)
        if not match:
            continue
        body = clean_caption_text(match.group(3))
        if not body:
            continue
        timestamped.append(TranscriptCue(parse_timestamp(match.group(1)), parse_timestamp(match.group(2)), body))
    if timestamped:
        return merge_short_cues(timestamped)

    paragraphs = [clean_caption_text(p) for p in re.split(r"\n\s*\n", text) if clean_caption_text(p)]
    if not paragraphs:
        return []
    total = duration or max(60.0, len(paragraphs) * 20.0)
    step = total / len(paragraphs)
    return [
        TranscriptCue(start=i * step, end=min(total, (i + 1) * step), text=paragraph)
        for i, paragraph in enumerate(paragraphs)
    ]


def cues_to_prompt_transcript(cues: list[TranscriptCue], max_chars: int) -> str:
    lines = [f"[{format_time(cue.start)} - {format_time(cue.end)}] {cue.text}" for cue in cues]
    text = "\n".join(lines)
    if len(text) <= max_chars:
        return text
    head = text[: int(max_chars * 0.7)]
    tail = text[-int(max_chars * 0.3):]
    return head + "\n\n[... transcript truncated ...]\n\n" + tail


def format_time(seconds: float) -> str:
    seconds = max(0, int(seconds))
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


def build_analysis_prompt(task: VideoTask, cues: list[TranscriptCue], args: argparse.Namespace) -> str:
    transcript = cues_to_prompt_transcript(cues, args.max_transcript_chars)
    duration = task.duration or (cues[-1].end if cues else None)
    return textwrap.dedent(f"""
    You are an analyst summarizing a video.

    Return only valid JSON with this exact shape:
    {{
      "globalSummary": "3 to 5 sentences covering the whole video: topic, approach, conclusion.",
      "theses": [
        {{
          "id": 1,
          "statement": "The main argument or claim the video is making, in one sentence."
        }}
      ]
    }}

    Rules:
    - Extract {args.max_theses} thesis at most (fewer if the video only defends one central idea).
    - Each thesis is a complete sentence stating an argument, not just a topic label.
    - globalSummary is in the video's main language.
    - theses are in the video's main language.
    - Be precise: prefer a thesis like "X causes Y because Z" over "the video talks about X".

    Video title: {task.title or "(unknown)"}
    Video URL: {task.url}
    Duration seconds: {duration or "(unknown)"}

    Transcript:
    {transcript}
    """).strip()


def validate_analysis(data: dict[str, Any]) -> dict[str, Any]:
    global_summary = str(data.get("globalSummary") or "").strip()
    if not global_summary:
        raise RuntimeError("Analysis JSON is missing globalSummary.")
    raw_theses = data.get("theses")
    if not isinstance(raw_theses, list) or not raw_theses:
        raise RuntimeError("Analysis JSON is missing theses array.")
    theses: list[dict[str, Any]] = []
    for item in raw_theses:
        if not isinstance(item, dict):
            continue
        statement = str(item.get("statement") or "").strip()
        thesis_id = item.get("id")
        if not statement:
            continue
        theses.append({"id": int(thesis_id) if thesis_id is not None else len(theses) + 1, "statement": statement})
    if not theses:
        raise RuntimeError("No valid theses in analysis JSON.")
    return {"globalSummary": global_summary[:2000], "theses": theses}


def run_analysis(task: VideoTask, cues: list[TranscriptCue], args: argparse.Namespace) -> dict[str, Any]:
    cached = load_cached_analysis(task, args)
    if cached:
        log(f"  analysis: cached ({len(cached['theses'])} thesis/theses)")
        return cached
    log(f"  analysis pass 1/{args.provider}: extracting theses + global summary")
    prompt = build_analysis_prompt(task, cues, args)
    raw = call_model(prompt, args)
    analysis = validate_analysis(raw)
    log(f"  analysis: {len(analysis['theses'])} thesis/theses extracted")
    save_cached_analysis(task, analysis, args)
    return analysis


def build_prompt(task: VideoTask, cues: list[TranscriptCue], args: argparse.Namespace, analysis: dict[str, Any]) -> str:
    transcript = cues_to_prompt_transcript(cues, args.max_transcript_chars)
    duration = task.duration or (cues[-1].end if cues else None)
    theses = analysis.get("theses") or []
    theses_block = "\n".join(f"  {t['id']}. {t['statement']}" for t in theses)
    thesis_ids = ", ".join(str(t["id"]) for t in theses)
    return textwrap.dedent(f"""
    You generate Smart Chapters for a video player used to skip to key moments and display an information overlay.

    The video defends the following main thesis/theses:
    {theses_block}

    Return only valid JSON with this exact shape:
    {{
      "segments": [
        {{
          "title": "short title, max 7 words",
          "start": 123.0,
          "end": 245.0,
          "summary": "2 to 3 dense sentences: what is said, which argument is made, why it matters for the thesis.",
          "score": 0.91,
          "thesis_id": 1
        }}
      ]
    }}

    Rules:
    - Use seconds for start/end.
    - Select passages that best serve the theses: key arguments, definitions, turning points, conclusions, supporting evidence, counterarguments addressed.
    - Deprioritize: introductions, anecdotes, digressions, transitions, repeated points.
    - Keep {args.max_segments} segments or fewer.
    - Prefer segments between {args.min_segment_seconds} and {args.max_segment_seconds} seconds when possible.
    - Do not overlap segments.
    - score >= 0.93: directly proves or illustrates a thesis. 0.88-0.92: strong supporting point. 0.55-0.87: useful context.
    - thesis_id: which thesis ({thesis_ids}) this segment primarily serves. Use null for intro/outro/transition segments.
    - Titles and summaries must be in the video's main language.
    - If the transcript is sparse, infer cautiously from available timestamps.

    Video title: {task.title or "(unknown)"}
    Video URL: {task.url}
    Duration seconds: {duration or "(unknown)"}

    Transcript:
    {transcript}
    """).strip()


def call_model(prompt: str, args: argparse.Namespace) -> dict[str, Any]:
    if args.provider == "openai":
        return call_openai(prompt, args)
    return call_ollama(prompt, args)


def call_openai(prompt: str, args: argparse.Namespace) -> dict[str, Any]:
    if not args.api_key:
        raise RuntimeError(
            "No API key provided. Pass --api-key or set $DEEPSEEK_API_KEY / $OPENAI_API_KEY."
        )
    url = args.api_base.rstrip("/") + "/chat/completions"
    payload = {
        "model": args.model,
        "messages": [
            {"role": "system", "content": "You output only valid JSON matching the requested shape."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.15,
        "stream": False,
        "response_format": {"type": "json_object"},
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {args.api_key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=600) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"OpenAI-compatible request failed ({exc.code}): {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"OpenAI-compatible request failed: {exc}") from exc

    try:
        raw = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError("OpenAI-compatible response did not contain a message.") from exc
    if not isinstance(raw, str):
        raise RuntimeError("OpenAI-compatible response content was not text.")
    return parse_model_json(raw)


def call_ollama(prompt: str, args: argparse.Namespace) -> dict[str, Any]:
    url = args.ollama_url.rstrip("/") + "/api/generate"
    payload = {
        "model": args.model,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.15,
        },
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=600) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Ollama request failed: {exc}") from exc

    raw = data.get("response")
    if not isinstance(raw, str):
        raise RuntimeError("Ollama response did not contain a text response.")
    return parse_model_json(raw)


def parse_model_json(raw: str) -> dict[str, Any]:
    raw = raw.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw, flags=re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def validate_segments(data: dict[str, Any], duration: float | None, args: argparse.Namespace) -> list[dict[str, Any]]:
    raw_segments = data.get("segments")
    if not isinstance(raw_segments, list):
        raise RuntimeError("Ollama JSON is missing a segments array.")

    segments: list[dict[str, Any]] = []
    for item in raw_segments:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        summary = str(item.get("summary") or "").strip()
        start = to_float(item.get("start"))
        end = to_float(item.get("end"))
        score = to_float(item.get("score"))
        raw_thesis_id = item.get("thesis_id")
        thesis_id = int(raw_thesis_id) if raw_thesis_id is not None else None
        if not title or start is None or end is None or end <= start:
            continue
        if duration:
            start = max(0.0, min(duration, start))
            end = max(0.0, min(duration, end))
        if end <= start:
            continue
        segments.append({
            "title": title[:90],
            "start": round(start, 3),
            "end": round(end, 3),
            "summary": summary[:600] if summary else None,
            "score": round(max(0.0, min(1.0, score if score is not None else 0.75)), 3),
            "thesis_id": thesis_id,
        })

    segments.sort(key=lambda item: item["start"])
    cleaned: list[dict[str, Any]] = []
    last_end = -1.0
    for segment in segments[: args.max_segments]:
        if segment["start"] < last_end:
            segment["start"] = round(last_end, 3)
        if segment["end"] <= segment["start"]:
            continue
        last_end = segment["end"]
        cleaned.append({key: value for key, value in segment.items() if value is not None})

    if not cleaned:
        raise RuntimeError("No valid Smart Chapter segments were generated.")
    return cleaned


def highlights_path(video_url: str, output_dir: Path) -> Path:
    digest = hashlib.sha256(video_url.strip().encode("utf-8")).hexdigest()
    return output_dir / f"{digest}.json"


def write_highlights(task: VideoTask, segments: list[dict[str, Any]], analysis: dict[str, Any], args: argparse.Namespace) -> Path:
    output_dir = Path(args.output_dir).expanduser() if args.output_dir else Path(args.grayjay_dir).expanduser() / "highlights"
    output_dir.mkdir(parents=True, exist_ok=True)
    path = highlights_path(task.url, output_dir)
    if path.exists() and not args.overwrite:
        raise FileExistsError(f"Highlights already exist: {path} (use --overwrite)")

    now = datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")
    existing = load_json(path) if path.exists() else None
    created_at = existing.get("createdAt") if isinstance(existing, dict) and existing.get("createdAt") else now
    payload: dict[str, Any] = {
        "schemaVersion": 2,
        "videoUrl": task.url,
        "source": f"smart-chapters-generator+{args.provider}-{args.model}",
        "createdAt": created_at,
        "updatedAt": now,
        "globalSummary": analysis.get("globalSummary"),
        "theses": analysis.get("theses"),
        "segments": segments,
    }
    if task.video:
        payload["video"] = task.video

    if not args.dry_run:
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def process_task(task: VideoTask, args: argparse.Namespace) -> Path | None:
    task = fetch_video_metadata(task, args)
    title = task.title or task.url
    log(f"\n==> {title}")
    log(f"  url: {task.url}")

    with tempfile.TemporaryDirectory(prefix="smart_chapters_") as temp_name:
        workdir = Path(temp_name)
        if args.keep_workdir:
            keep_dir = Path(tempfile.mkdtemp(prefix="smart_chapters_keep_"))
            workdir = keep_dir
            log(f"  workdir: {workdir}")
        cues = get_transcript(task, args, workdir)

        analysis = run_analysis(task, cues, args)

        prompt = build_prompt(task, cues, args, analysis)
        log(f"  chaptering pass 2/{args.provider}: {args.model}")
        generated = call_model(prompt, args)
        duration = task.duration or (cues[-1].end if cues else None)
        segments = validate_segments(generated, duration, args)
        log(f"  segments: {len(segments)}")
        path = write_highlights(task, segments, analysis, args)
        if args.dry_run:
            log(f"  dry-run output: {path}")
            print(json.dumps({
                "videoUrl": task.url,
                "globalSummary": analysis.get("globalSummary"),
                "theses": analysis.get("theses"),
                "segments": segments,
            }, ensure_ascii=False, indent=2))
        else:
            log(f"  written: {path}")
        return path


def main() -> int:
    args = parse_args()
    grayjay_dir = Path(args.grayjay_dir).expanduser()

    if args.list_playlists:
        print_playlists(grayjay_dir)
        return 0

    if args.interactive:
        return interactive_command(args)

    tasks = resolve_tasks(args)
    if not tasks:
        raise SystemExit("No videos to process.")

    log(f"Videos to process: {len(tasks)}")
    failures = 0
    for index, task in enumerate(tasks, start=1):
        log(f"\n[{index}/{len(tasks)}]")
        try:
            process_task(task, args)
        except Exception as exc:
            failures += 1
            log(f"  ERROR: {exc}")

    if failures:
        log(f"\nCompleted with {failures} failure(s).")
        return 1
    log("\nCompleted successfully.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        raise SystemExit(130)
