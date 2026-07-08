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
DEFAULT_ROUTR_CLIENT = "bluejay-smart-chapters"
DEFAULT_ROUTR_PHASE = "precompute"
DEFAULT_ROUTR_PROFILE = "balanced-cheap"
DEFAULT_ROUTR_PROMPT_VERSION = "smart-chapters-v1"
DEFAULT_ROUTR_CALLER_ID = "bluejay-smart-chapters-precompute"


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


# --- Résolution robuste des binaires externes -------------------------------
# But : ne JAMAIS dépendre du PATH hérité. Quand BlueJay (via launchd) lance ce
# générateur, il fournit un PATH minimal (/usr/bin:/bin) où deno, ffmpeg et yt-dlp
# sont invisibles. On cherche donc dans le PATH courant PUIS dans les emplacements
# d'install standards, et on passe les chemins absolus explicitement à yt-dlp
# (--js-runtimes deno:<path>, --ffmpeg-location <dir>).

_EXTRA_BIN_DIRS = [
    "/opt/homebrew/bin",             # Homebrew (Apple Silicon)
    "/usr/local/bin",                # Homebrew (Intel) / installs manuelles
    "/opt/homebrew/anaconda3/bin",   # Anaconda (yt-dlp avec curl_cffi)
    str(Path.home() / ".deno" / "bin"),
    str(Path.home() / ".local" / "bin"),
    str(Path.home() / "bin"),
    "/opt/local/bin",                # MacPorts
    "/snap/bin",                     # Linux snap
]

_binary_cache: dict[str, str | None] = {}


def ensure_tool_path() -> None:
    """Ajoute les emplacements d'install connus (existants) à la FIN du PATH du
    process, pour que tous les sous-processus (yt-dlp, ffmpeg, whisper) les
    trouvent quel que soit le PATH hérité. On appending pour ne pas déclasser un
    yt-dlp déjà prioritaire dans le PATH (ex: celui d'Anaconda avec curl_cffi)."""
    parts = os.environ.get("PATH", "").split(os.pathsep)
    existing = set(p for p in parts if p)
    extra = [d for d in _EXTRA_BIN_DIRS if d not in existing and Path(d).is_dir()]
    if extra:
        os.environ["PATH"] = os.pathsep.join([p for p in parts if p] + extra)


def resolve_binary(name: str) -> str | None:
    """Chemin absolu d'un exécutable : PATH courant d'abord (shutil.which), puis
    les emplacements d'install connus. Mémoïsé. None si introuvable."""
    if name in _binary_cache:
        return _binary_cache[name]
    found = shutil.which(name)
    if not found:
        for directory in _EXTRA_BIN_DIRS:
            candidate = Path(directory) / name
            if candidate.is_file() and os.access(candidate, os.X_OK):
                found = str(candidate)
                break
    _binary_cache[name] = found
    return found


def ytdlp_runtime_args() -> list[str]:
    """Chemins absolus de deno et ffmpeg passés explicitement à yt-dlp. YouTube
    exige désormais un runtime JS (deno) pour l'extraction ; ffmpeg/ffprobe
    servent au post-traitement et au fallback Whisper. Ainsi yt-dlp fonctionne
    même si ces binaires ne sont pas dans le PATH."""
    extra: list[str] = []
    deno = resolve_binary("deno")
    if deno:
        extra += ["--js-runtimes", f"deno:{deno}"]
    ffmpeg = resolve_binary("ffmpeg")
    if ffmpeg:
        extra += ["--ffmpeg-location", str(Path(ffmpeg).parent)]
    return extra


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
    targets.add_argument("--check", action="store_true", help="Check that all external dependencies (yt-dlp, deno, ffmpeg, model backend) are available, then exit.")
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
    generation.add_argument("--max-segments", type=int, default=None, help="Maximum Smart Chapter segments. Auto-derived from duration when omitted (~1 per 3 min, 6-40).")
    generation.add_argument("--max-theses", type=int, default=None, help="Maximum theses/topics extracted in the analysis pass. Auto-derived from duration when omitted (~1 per 15 min, 1-8).")
    generation.add_argument("--min-segment-seconds", type=int, default=45, help="Preferred minimum segment duration.")
    generation.add_argument("--max-segment-seconds", type=int, default=360, help="Preferred maximum segment duration.")
    generation.add_argument("--max-transcript-chars", type=int, default=120000, help="Transcript character budget sent to LLM. Above this, cues are uniformly down-sampled across the whole duration (never dropping the middle).")
    generation.add_argument("--language", default="fr", help="Preferred transcript/Whisper language.")
    generation.add_argument("--output-language", default=None, help="Force the language of generated titles/summaries (e.g. French, English). Defaults to the video's own language.")
    generation.add_argument("--sub-langs", default="fr.*,fr,en.*,en", help="yt-dlp subtitle languages.")
    generation.add_argument("--refresh-analysis", action="store_true", help="Ignore cached analysis (theses + global summary) and re-run pass 1.")
    generation.add_argument("--routr-client", default=os.environ.get("ROUTR_CLIENT", DEFAULT_ROUTR_CLIENT), help="X-Routr-Client metadata header for Routr.")
    generation.add_argument("--routr-phase", default=os.environ.get("ROUTR_PHASE", DEFAULT_ROUTR_PHASE), help="X-Routr-Phase metadata header for Routr.")
    generation.add_argument("--routr-profile", default=os.environ.get("ROUTR_PROFILE", DEFAULT_ROUTR_PROFILE), help="X-Routr-Profile metadata header for Routr.")
    generation.add_argument("--routr-prompt-version", default=os.environ.get("ROUTR_PROMPT_VERSION", DEFAULT_ROUTR_PROMPT_VERSION), help="X-Routr-Prompt-Version metadata header for Routr.")
    generation.add_argument("--routr-run-id", default=os.environ.get("ROUTR_RUN_ID", ""), help="X-Routr-Run-Id metadata header for Routr.")
    generation.add_argument("--routr-caller-id", default=os.environ.get("ROUTR_CALLER_ID", DEFAULT_ROUTR_CALLER_ID), help="X-Routr-Caller-Id metadata header for Routr.")
    generation.add_argument("--routr-session-mode", default=os.environ.get("ROUTR_SESSION_MODE", "none"), choices=["none", "sticky", "stateful"], help="X-Routr-Session-Mode metadata header for Routr.")
    generation.add_argument("--routr-session-id", default=os.environ.get("ROUTR_SESSION_ID", ""), help="X-Routr-Session-Id metadata header for Routr.")

    fallback = parser.add_argument_group("transcription")
    fallback.add_argument("--subtitle-file", help="Use this VTT/subtitle file directly (skips yt-dlp/Whisper). Used by BlueJay to pass Grayjay's own subtitles.")
    fallback.add_argument("--min-coverage", type=float, default=0.85, help="Minimum transcript coverage (last cue / video duration) below which the transcript is treated as incomplete and not cached.")
    fallback.add_argument("--cache-partial", action="store_true", help="Cache transcripts even when coverage is below --min-coverage.")
    fallback.add_argument("--transcript-cache-dir", help="Directory to cache transcripts. Defaults to <grayjay-dir>/transcripts_cache.")
    fallback.add_argument("--no-transcript-cache", action="store_true", help="Do not read or write the transcript cache.")
    fallback.add_argument("--refresh-transcript", action="store_true", help="Ignore any cached transcript and fetch it again.")
    fallback.add_argument("--skip-youtube-transcript", action="store_true", help="Skip yt-dlp subtitles and use Whisper fallback.")
    fallback.add_argument("--no-whisper", action="store_true", help="Do not use Whisper fallback.")
    fallback.add_argument("--whisper-script", default=None, help="Optional custom transcription script (overrides the built-in whisper.cpp path when present).")
    fallback.add_argument("--whisper-cli", default=None, help="Path to the whisper.cpp 'whisper-cli' binary. Auto-detected if omitted.")
    fallback.add_argument("--whisper-models-dir", default=None, help="Directory containing ggml-<model>.bin files. Auto-detected if omitted.")
    fallback.add_argument("--whisper-model", default="base", help="Whisper model name (e.g. base, small, large-v3).")
    fallback.add_argument("--cookies-from-browser", help="Pass browser cookies to yt-dlp (e.g. firefox) to avoid HTTP 429 on subtitles.")

    output = parser.add_argument_group("output")
    output.add_argument("--grayjay-dir", default=str(DEFAULT_GRAYJAY_DIR), help="Grayjay application data directory.")
    output.add_argument("--output-dir", help="Override highlights output directory.")
    output.add_argument("--overwrite", action="store_true", help="Overwrite an existing highlights file.")
    output.add_argument("--dry-run", action="store_true", help="Do not write files.")
    output.add_argument("--keep-workdir", action="store_true", help="Keep temporary transcript files.")

    args = parser.parse_args()
    if not args.list_playlists and not args.interactive and not args.check and not any([args.url, args.media_file, args.urls_file, args.playlist, args.grayjay_video]):
        parser.error("Provide --url, --media-file, --urls-file, --playlist, --grayjay-video, --list-playlists, or --check.")
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
    ytdlp = resolve_binary("yt-dlp")
    if not ytdlp:
        log("  metadata warning: yt-dlp introuvable (voir --check)")
        return task
    try:
        proc = run_command([ytdlp, "--dump-json", "--skip-download", *ytdlp_runtime_args(), *ytdlp_cookie_args(args), task.url], check=True)
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
    # Un transcript rafraîchi rend l'analyse (thèses + résumé) obsolète : on la
    # recalcule pour rester cohérent avec le nouveau transcript.
    if args.no_transcript_cache or args.refresh_analysis or args.refresh_transcript:
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


def _accept_transcript(task: VideoTask, cues: list[TranscriptCue], source: str, args: argparse.Namespace) -> list[TranscriptCue]:
    """Valide la couverture (dernière cue vs durée vidéo) avant mise en cache.
    Un transcript qui couvre nettement moins que la durée (Whisper tronqué, sous-
    titres partiels) N'EST PAS mis en cache : sinon il empoisonne durablement les
    régénérations suivantes et produit un dernier chapitre géant et vide."""
    duration = task.duration
    end = cues[-1].end if cues else 0.0
    if duration and duration > 0:
        coverage = end / duration
        if coverage < args.min_coverage:
            log(f"  ⚠ transcript incomplet : couvre {coverage * 100:.0f}% "
                f"({format_time(end)} / {format_time(duration)}) via {source}")
            if not args.cache_partial:
                log("    → non mis en cache (relance possible ; --cache-partial pour forcer)")
                return cues
    save_cached_transcript(task, cues, source, args)
    return cues


def get_transcript(task: VideoTask, args: argparse.Namespace, workdir: Path) -> list[TranscriptCue]:
    # Transcript fourni de l'extérieur (ex: BlueJay passe le VTT du moteur Grayjay).
    # Prioritaire : évite yt-dlp/deno/ffmpeg quand l'app a déjà les sous-titres.
    if args.subtitle_file:
        sub = Path(args.subtitle_file).expanduser()
        if sub.exists():
            cues = parse_vtt(sub.read_text(encoding="utf-8", errors="ignore"))
            if cues:
                log(f"  transcript: provided subtitle file ({len(cues)} cues)")
                return _accept_transcript(task, cues, "provided-subtitle", args)
        log(f"  provided subtitle file unusable, falling back: {sub}")

    cached = load_cached_transcript(task, args)
    if cached:
        log(f"  transcript: cached ({len(cached)} cues)")
        return cached

    if not args.skip_youtube_transcript and extract_youtube_id(task.url):
        cues = get_youtube_subtitle_transcript(task.url, args, workdir)
        if cues:
            log(f"  transcript: YouTube subtitles ({len(cues)} cues)")
            return _accept_transcript(task, cues, "youtube-subtitles", args)

    if args.no_whisper:
        raise RuntimeError("No YouTube transcript found and --no-whisper is set.")

    cues = get_whisper_transcript(task, args, workdir)
    if cues:
        log(f"  transcript: Whisper fallback ({len(cues)} cues)")
        return _accept_transcript(task, cues, f"whisper-{args.whisper_model}", args)
    raise RuntimeError("No transcript could be produced.")


def get_youtube_subtitle_transcript(url: str, args: argparse.Namespace, workdir: Path) -> list[TranscriptCue]:
    ytdlp = resolve_binary("yt-dlp")
    if not ytdlp:
        return []
    before = set(workdir.glob("*"))
    cmd = [
        ytdlp,
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
        *ytdlp_runtime_args(),
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


# --- Whisper autonome (whisper.cpp) -----------------------------------------
# Le fallback ne dépend plus d'un script externe : la glue (download audio →
# WAV 16 kHz → whisper-cli) est internalisée ici. Seul le moteur whisper.cpp
# (binaire whisper-cli + modèle ggml) reste une dépendance système DÉTECTÉE,
# jamais supposée. --whisper-script permet de repointer sur un script maison.

_WHISPER_CLI_CANDIDATES = [
    Path.home() / "11.Repositories" / "whisper.cpp" / "build" / "bin" / "whisper-cli",
    Path.home() / "whisper.cpp" / "build" / "bin" / "whisper-cli",
]


def resolve_whisper_cli(args: argparse.Namespace) -> str | None:
    if args.whisper_cli:
        path = Path(args.whisper_cli).expanduser()
        return str(path) if path.exists() else None
    # whisper.cpp installe 'whisper-cli' ; le paquet Homebrew 'whisper-cpp' aussi.
    found = resolve_binary("whisper-cli") or resolve_binary("whisper-cpp")
    if found:
        return found
    for candidate in _WHISPER_CLI_CANDIDATES:
        if candidate.exists():
            return str(candidate)
    return None


def resolve_whisper_model(args: argparse.Namespace, cli_path: str | None) -> str | None:
    name = f"ggml-{args.whisper_model}.bin"
    dirs: list[Path] = []
    if args.whisper_models_dir:
        dirs.append(Path(args.whisper_models_dir).expanduser())
    if cli_path:
        # build/bin/whisper-cli -> <repo>/models
        dirs.append(Path(cli_path).resolve().parent.parent.parent / "models")
    dirs += [
        Path.home() / "11.Repositories" / "whisper.cpp" / "models",
        Path.home() / "whisper.cpp" / "models",
    ]
    for directory in dirs:
        candidate = directory / name
        if candidate.exists():
            return str(candidate)
    return None


def _download_audio_wav(task: VideoTask, args: argparse.Namespace, workdir: Path) -> Path:
    """Produit un WAV mono 16 kHz (format attendu par whisper.cpp)."""
    ffmpeg = resolve_binary("ffmpeg")
    if task.local_file:
        if not ffmpeg:
            raise RuntimeError("ffmpeg introuvable pour convertir l'audio (voir --check).")
        wav = workdir / "audio.wav"
        run_command([ffmpeg, "-i", str(Path(task.local_file).expanduser()),
                     "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
                     str(wav), "-y", "-loglevel", "warning"], check=True)
        return wav
    ytdlp = resolve_binary("yt-dlp")
    if not ytdlp:
        raise RuntimeError("yt-dlp introuvable pour télécharger l'audio (voir --check).")
    run_command([ytdlp, "-x", "--audio-format", "wav", "--audio-quality", "0",
                 "--postprocessor-args", "ffmpeg:-ac 1 -ar 16000",
                 "-o", str(workdir / "audio.%(ext)s"),
                 *ytdlp_runtime_args(), *ytdlp_cookie_args(args), task.url], check=True)
    produced = list(workdir.glob("audio.wav")) or list(workdir.glob("audio.*"))
    if not produced:
        raise RuntimeError("Le téléchargement audio n'a produit aucun fichier.")
    return produced[0]


def get_whisper_transcript(task: VideoTask, args: argparse.Namespace, workdir: Path) -> list[TranscriptCue]:
    # Override optionnel : script maison si explicitement fourni ET présent.
    if args.whisper_script:
        script = Path(args.whisper_script).expanduser()
        if script.exists():
            output = workdir / "whisper.txt"
            proc = run_command([str(script), "--input", task.local_file or task.url,
                                "--output", str(output), "--model", args.whisper_model], check=False)
            if proc.returncode != 0:
                raise RuntimeError(f"Whisper script failed: {proc.stderr.strip() or proc.stdout.strip()}")
            return parse_whisper_text(output.read_text(encoding="utf-8", errors="ignore"), task.duration)
        log(f"  whisper script introuvable, bascule sur whisper.cpp interne: {script}")

    # Chemin autonome : whisper.cpp détecté + glue interne.
    cli = resolve_whisper_cli(args)
    if not cli:
        raise RuntimeError(
            "Whisper indisponible : whisper-cli introuvable. Installe whisper.cpp "
            "(ou 'brew install whisper-cpp'), ou passe --whisper-cli / --whisper-script. Voir --check.")
    model = resolve_whisper_model(args, cli)
    if not model:
        raise RuntimeError(
            f"Modèle Whisper 'ggml-{args.whisper_model}.bin' introuvable. "
            "Passe --whisper-models-dir ou télécharge le modèle. Voir --check.")
    wav = _download_audio_wav(task, args, workdir)
    proc = run_command([cli, "-m", model, "-f", str(wav), "-l", args.language], check=False)
    if proc.returncode != 0:
        raise RuntimeError(f"whisper-cli failed: {proc.stderr.strip() or proc.stdout.strip()}")
    return parse_whisper_text(proc.stdout, task.duration)


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
    # Sur une vidéo longue, on NE jette PAS le milieu (sinon le LLM ne chapitre
    # que le début et la fin, et le cœur de la vidéo disparaît). On sous-échantillonne
    # uniformément : on garde des cues réparties sur TOUTE la durée, dans le budget.
    avg = max(1, len(text) // max(1, len(lines)))
    keep = max(1, max_chars // avg)
    if keep >= len(lines):
        return text[:max_chars]
    step = len(lines) / keep
    indices = sorted({min(len(lines) - 1, int(i * step)) for i in range(keep)})
    sampled = "\n".join(lines[i] for i in indices)
    note = (f"[... transcript sous-échantillonné : {len(indices)}/{len(lines)} "
            f"segments répartis sur toute la durée pour tenir dans le budget ...]")
    return note + "\n" + sampled


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
          "statement": "A main argument, claim, OR distinct topic the video covers, in one sentence."
        }}
      ]
    }}

    Rules:
    - Extract up to {args.max_theses} main theses OR topics (fewer only if the video is genuinely narrow).
    - For interviews, podcasts and multi-topic videos, cover the DIFFERENT topics discussed across the WHOLE video (technical points AND business, strategy, personal, advice, etc.) — not only the topic of the opening minutes.
    - Each item is a complete sentence stating an argument, or clearly naming a distinct topic covered.
    - globalSummary is in {args.output_language or "the video's main language"}.
    - theses are in {args.output_language or "the video's main language"}.
    - Be precise: prefer "X causes Y because Z" or "the guest explains how they run board meetings" over vague labels.

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

    The video's main theses/topics (for reference only — see scoring rules):
    {theses_block}

    Return only valid JSON with this exact shape:
    {{
      "segments": [
        {{
          "title": "short title, max 7 words",
          "start": 123.0,
          "end": 245.0,
          "summary": "2 to 3 dense sentences: what is actually said and why a viewer would care.",
          "score": 0.91,
          "thesis_id": 1
        }}
      ]
    }}

    Rules:
    - Use seconds for start/end.
    - COVER THE ENTIRE VIDEO: the sections must be CONTIGUOUS and span the full duration, from 0 to the end. Each section's start must equal the previous section's end. No gaps, no overlaps. Do not skip "boring" parts: include them as their own low-score sections.
    - Keep around {args.max_segments} sections (merge flat stretches into longer sections rather than dropping them).
    - Prefer sections between {args.min_segment_seconds} and {args.max_segment_seconds} seconds, but extend low-interest stretches into longer sections so the whole video stays covered.
    - DISTRIBUTE sections EVENLY across the ENTIRE timeline: the density of sections must stay similar from the first minute to the last. The FINAL section MUST NOT be a catch-all. If the last part of the transcript (e.g. the final 10-20 minutes) still contains speech, split it into several sections exactly like the earlier parts. A single section longer than {args.max_segment_seconds}s is allowed ONLY when the transcript for that whole span is genuinely empty of speech.
    - score = how VALUABLE this section is TO A VIEWER, based on information density, insight, specificity and memorability. It is NOT about whether it proves a thesis. A gripping personal story, a concrete example, a piece of advice, a governance detail or a strong opinion can score HIGH even if it matches no thesis.
      * >= 0.90: high insight — a key idea, striking fact, concrete example, strong argument or memorable takeaway
      * 0.70-0.89: solid, genuinely informative content clearly worth watching
      * 0.55-0.69: real but secondary content — a minor point that still teaches something specific
      * 0.30-0.54: LOW interest — intros, the guest's self-introduction and bio, how people met, background/context setting, logistics, pleasantries, mild small talk, meandering anecdotes. These are COHERENT and have words, but they are NOT what makes the video worth watching. Put them HERE even though they contain content.
      * < 0.30: true filler — ads/sponsor, dead air, pure transitions, repetition.
    - Be STRICT and stingy with the green+ band. The opening of a video (intro, who the guest is, their background, how the project started, scene-setting) is rarely the most valuable part: score it in the 0.30-0.54 LOW band unless it contains a genuinely striking claim. Reserve 0.55+ for sections that actually teach, argue or reveal something.
    - Judge each section on its OWN merit. A long stretch of the video being off the main thesis (e.g. an interview moving from tech to strategy, leadership or personal advice) is usually still valuable — score it on its content, not its distance from the thesis.
    - SPREAD the scores across the FULL range and score RELATIVELY within THIS video, not in absolute terms. Compare the sections to each other: the single best moment(s) MUST reach >= 0.93, the weakest/most introductory parts MUST go down to about 0.30-0.45, and genuine filler below 0.30. Do NOT cluster everything in 0.60-0.85 — that defeats the purpose. Aim for real contrast: a few clear peaks (>= 0.90), a spread of middle values, and clearly cold intros/low points. If two sections differ in value, their scores MUST differ.
    - thesis_id: OPTIONAL link to which thesis/topic ({thesis_ids}) the section relates to, or null. A null thesis_id MUST NOT lower the score.
    - Titles and summaries must be in {args.output_language or "the video's main language"}.
    - NEVER invent content. Base every title and summary strictly on what the transcript ACTUALLY says for that time span. Do NOT claim "music", "silence", "no dialogue", "intro sequence" or similar unless the transcript truly has no words there. If the transcript has text in a span, describe THAT text; if a span has no transcript text, merge it into an adjacent section rather than fabricating a description.

    Video title: {task.title or "(unknown)"}
    Video URL: {task.url}
    Duration seconds: {duration or "(unknown)"}

    Transcript:
    {transcript}
    """).strip()


def call_model(prompt: str, args: argparse.Namespace) -> dict[str, Any]:
    # Les LLM renvoient parfois un JSON légèrement malformé (virgule manquante).
    # On régénère jusqu'à 3 fois avant d'abandonner — c'est le remède le plus
    # fiable pour ce type d'aléa, plus sûr qu'une réparation à l'aveugle.
    for attempt in range(3):
        try:
            if args.provider == "openai":
                return call_openai(prompt, args)
            return call_ollama(prompt, args)
        except json.JSONDecodeError as exc:
            if attempt == 2:
                raise RuntimeError(f"Model kept returning invalid JSON after 3 attempts: {exc}")
            log(f"  model returned invalid JSON (attempt {attempt + 1}/3), retrying…")
    raise RuntimeError("unreachable")


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
        headers=openai_request_headers(args),
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


def openai_request_headers(args: argparse.Namespace) -> dict[str, str]:
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {args.api_key}",
    }
    routr_headers = {
        "X-Routr-Client": getattr(args, "routr_client", ""),
        "X-Routr-Phase": getattr(args, "routr_phase", ""),
        "X-Routr-Profile": getattr(args, "routr_profile", ""),
        "X-Routr-Prompt-Version": getattr(args, "routr_prompt_version", ""),
        "X-Routr-Run-Id": getattr(args, "routr_run_id", ""),
        "X-Routr-Caller-Id": getattr(args, "routr_caller_id", ""),
        "X-Routr-Session-Mode": getattr(args, "routr_session_mode", ""),
        "X-Routr-Session-Id": getattr(args, "routr_session_id", ""),
    }
    for key, value in routr_headers.items():
        value = str(value or "").strip()
        if value:
            headers[key] = value
    return headers


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
        pass
    match = re.search(r"\{.*\}", raw, flags=re.DOTALL)
    candidate = match.group(0) if match else raw
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        # Réparation basique des virgules traînantes avant } ou ] ; si ça ne
        # suffit pas, l'exception remonte et call_model régénère.
        repaired = re.sub(r",(\s*[}\]])", r"\1", candidate)
        return json.loads(repaired)


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
    # Couvre jusqu'a la vraie fin : si le LLM s'est arrete avant (souvent parce
    # que les sous-titres ne couvrent pas l'outro), on etend la derniere section.
    if duration and cleaned[-1]["end"] < duration - 1:
        cleaned[-1]["end"] = round(float(duration), 3)
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


def auto_max_theses(duration: float | None) -> int:
    # ~1 sujet/thèse par 15 min de vidéo, borné [1, 8].
    if not duration or duration <= 0:
        return 3
    return max(1, min(8, round(duration / 60 / 15)))


def auto_max_segments(duration: float | None) -> int:
    # ~1 section par 3 min de vidéo, borné [6, 40].
    if not duration or duration <= 0:
        return 12
    return max(6, min(40, round(duration / 60 / 3)))


def rechapter_span(task: VideoTask, span_cues: list[TranscriptCue], start: float, end: float,
                   args: argparse.Namespace, analysis: dict[str, Any]) -> list[dict[str, Any]] | None:
    """Re-chapitre UNE tranche trop longue en plusieurs sous-sections via un appel
    LLM ciblé. Levier robuste contre le biais du modèle qui regroupe la fin d'une
    longue vidéo en un seul bloc fourre-tout."""
    if not span_cues:
        return None
    n = max(2, min(10, round((end - start) / max(1, args.max_segment_seconds))))
    transcript = cues_to_prompt_transcript(span_cues, args.max_transcript_chars)
    lang = args.output_language or "the video's main language"
    prompt = textwrap.dedent(f"""
    You split ONE part of a video into chapters. This part runs from {format_time(start)} ({start:.0f}s) to {format_time(end)} ({end:.0f}s).

    Return only valid JSON: {{"segments":[{{"title":"max 7 words","start":{start:.0f},"end":123.0,"summary":"2-3 dense sentences","score":0.5,"thesis_id":null}}]}}

    Rules:
    - Produce {n} CONTIGUOUS sections covering EXACTLY this span. First start = {start:.0f}, last end = {end:.0f}. No gaps, no overlaps.
    - This span is NOT filler: it contains real spoken content. Give each section a SPECIFIC title based on what is actually said (never "conclusion", "thanks", "outro" unless the transcript truly is that), and a fair score spread across the range (viewer value, not thesis-adherence).
    - Titles and summaries in {lang}. Base everything strictly on the transcript. Never invent.

    Transcript (this span only):
    {transcript}
    """).strip()
    try:
        data = call_model(prompt, args)
    except Exception as exc:
        log(f"    re-split failed for {format_time(start)}-{format_time(end)}: {exc}")
        return None
    raw = data.get("segments")
    if not isinstance(raw, list) or len(raw) < 2:
        return None
    subs: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        s = to_float(item.get("start"))
        e = to_float(item.get("end"))
        if not title or s is None or e is None:
            continue
        s = max(start, min(end, s))
        e = max(start, min(end, e))
        if e <= s:
            continue
        score = to_float(item.get("score"))
        tid = item.get("thesis_id")
        subs.append({
            "title": title[:90],
            "start": round(s, 3),
            "end": round(e, 3),
            "summary": (str(item.get("summary") or "").strip()[:600]) or None,
            "score": round(max(0.0, min(1.0, score if score is not None else 0.75)), 3),
            "thesis_id": int(tid) if tid is not None else None,
        })
    if len(subs) < 2:
        return None
    subs.sort(key=lambda x: x["start"])
    subs[0]["start"] = round(start, 3)
    for i in range(1, len(subs)):
        subs[i]["start"] = subs[i - 1]["end"]
    subs[-1]["end"] = round(end, 3)
    subs = [x for x in subs if x["end"] > x["start"]]
    if len(subs) < 2:
        return None
    return [{k: v for k, v in x.items() if v is not None} for x in subs]


def resplit_long_segments(task: VideoTask, cues: list[TranscriptCue], segments: list[dict[str, Any]],
                          args: argparse.Namespace, analysis: dict[str, Any]) -> list[dict[str, Any]]:
    """Re-découpe les sections anormalement longues qui contiennent du transcript
    (typiquement le bloc fourre-tout de fin), sans toucher aux sections normales."""
    threshold = max(args.max_segment_seconds * 2, 600)
    result: list[dict[str, Any]] = []
    for seg in segments:
        span = seg["end"] - seg["start"]
        span_cues = [c for c in cues if c.start < seg["end"] and c.end > seg["start"]]
        text_len = sum(len(c.text) for c in span_cues)
        if span > threshold and text_len > 800:
            log(f"    re-splitting long section {format_time(seg['start'])}-{format_time(seg['end'])} ({span / 60:.0f} min)")
            subs = rechapter_span(task, span_cues, seg["start"], seg["end"], args, analysis)
            if subs:
                result.extend(subs)
                continue
        result.append(seg)
    return result


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

        # Nombre de thèses/sections adapté à la durée (sauf override explicite).
        duration = task.duration or (cues[-1].end if cues else None)
        if args.max_theses is None:
            args.max_theses = auto_max_theses(duration)
        if args.max_segments is None:
            args.max_segments = auto_max_segments(duration)
        log(f"  targets: {args.max_theses} theses/topics, ~{args.max_segments} sections")

        analysis = run_analysis(task, cues, args)

        prompt = build_prompt(task, cues, args, analysis)
        log(f"  chaptering pass 2/{args.provider}: {args.model}")
        generated = call_model(prompt, args)
        duration = task.duration or (cues[-1].end if cues else None)
        segments = validate_segments(generated, duration, args)
        segments = resplit_long_segments(task, cues, segments, args, analysis)
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


def run_doctor(args: argparse.Namespace) -> int:
    """Vérifie que toutes les dépendances externes sont trouvables, et où.
    Transforme un « rien ne se passe » en diagnostic actionnable."""
    ensure_tool_path()
    log("Smart Chapters — vérification de l'environnement\n")
    ok = True
    binaries = [
        ("yt-dlp", "extraction vidéo / sous-titres", "conda install -c conda-forge yt-dlp  (ou brew install yt-dlp)"),
        ("deno", "runtime JS requis par YouTube", "brew install deno"),
        ("ffmpeg", "post-traitement / audio Whisper", "brew install ffmpeg"),
        ("ffprobe", "sonde média (paquet ffmpeg)", "brew install ffmpeg"),
    ]
    for name, why, hint in binaries:
        path = resolve_binary(name)
        if path:
            log(f"  ✓ {name:8s} {path}   ({why})")
        else:
            ok = False
            log(f"  ✗ {name:8s} INTROUVABLE   ({why})\n      → {hint}")

    if args.whisper_script and Path(args.whisper_script).expanduser().exists():
        log(f"  ✓ {'whisper':8s} script maison : {Path(args.whisper_script).expanduser()}")
    else:
        cli = resolve_whisper_cli(args)
        if cli:
            model = resolve_whisper_model(args, cli)
            log(f"  ✓ {'whisper':8s} {cli}")
            if model:
                log(f"    {'':8s} modèle : {model}")
            else:
                log(f"    {'':8s} · modèle 'ggml-{args.whisper_model}.bin' introuvable (--whisper-models-dir)")
        else:
            log(f"  · {'whisper':8s} whisper.cpp non détecté (fallback indisponible ; sous-titres YouTube requis)")

    if args.provider == "openai":
        if args.api_key:
            log(f"  ✓ {'api-key':8s} présente   (provider openai / {args.model})")
        else:
            ok = False
            log(f"  ✗ {'api-key':8s} ABSENTE   → --api-key ou $DEEPSEEK_API_KEY / $OPENAI_API_KEY")
    else:
        try:
            urllib.request.urlopen(args.ollama_url.rstrip("/") + "/api/tags", timeout=3)
            log(f"  ✓ {'ollama':8s} {args.ollama_url}   ({args.model})")
        except Exception:
            ok = False
            log(f"  ✗ {'ollama':8s} {args.ollama_url} injoignable   → démarre 'ollama serve'")

    log("")
    log("Environnement OK — la génération peut tourner." if ok
        else "Des dépendances manquent (voir ci-dessus). La génération échouera tant qu'elles ne sont pas résolues.")
    return 0 if ok else 1


def main() -> int:
    args = parse_args()
    grayjay_dir = Path(args.grayjay_dir).expanduser()

    # Rend le PATH auto-suffisant : les sous-processus (yt-dlp, ffmpeg, whisper)
    # trouvent leurs binaires même lancés depuis BlueJay avec un PATH minimal.
    ensure_tool_path()

    if args.check:
        return run_doctor(args)

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
