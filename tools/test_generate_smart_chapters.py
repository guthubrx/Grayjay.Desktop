import argparse
import hashlib
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).with_name("generate_smart_chapters.py")
SPEC = importlib.util.spec_from_file_location("generate_smart_chapters", MODULE_PATH)
assert SPEC and SPEC.loader
GENERATOR = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = GENERATOR
SPEC.loader.exec_module(GENERATOR)


def args_for(root: Path, **overrides):
    values = {
        "grayjay_dir": str(root),
        "output_dir": None,
        "dry_run": False,
        "no_transcript_cache": False,
        "refresh_transcript": False,
        "transcript_cache_dir": None,
        "cached_transcript_only": True,
        "subtitle_file": None,
        "output_language": None,
        "discovery_languages": "en,fr,ja",
        "editorial_backfill_overwrite": False,
    }
    values.update(overrides)
    return argparse.Namespace(**values)


class AnalysisOnlyTests(unittest.TestCase):
    def test_cached_transcript_only_never_falls_back_to_network(self):
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            task = GENERATOR.VideoTask(url="https://www.youtube.com/watch?v=cached")
            cache_path = root / "transcripts_cache" / f"{hashlib.sha256(task.url.encode('utf-8')).hexdigest()}.json"
            cache_path.parent.mkdir(parents=True)
            cache_path.write_text(json.dumps({
                "videoUrl": task.url,
                "title": "Cached title",
                "cues": [{"start": 0, "end": 2, "text": "cached transcript"}],
            }), encoding="utf-8")

            with tempfile.TemporaryDirectory() as work_name:
                cues = GENERATOR.get_transcript(task, args_for(root), Path(work_name))
            self.assertEqual([cue.text for cue in cues], ["cached transcript"])
            self.assertEqual(task.title, "Cached title")
            self.assertEqual(task.duration, 2)

            missing = GENERATOR.VideoTask(url="https://www.youtube.com/watch?v=missing")
            with tempfile.TemporaryDirectory() as work_name:
                with self.assertRaisesRegex(RuntimeError, "No cached transcript"):
                    GENERATOR.get_transcript(missing, args_for(root), Path(work_name))

    def test_analysis_only_preserves_existing_chapters_and_subtitles(self):
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            task = GENERATOR.VideoTask(url="https://www.youtube.com/watch?v=preserve")
            highlight_path = root / "highlights" / f"{hashlib.sha256(task.url.encode('utf-8')).hexdigest()}.json"
            highlight_path.parent.mkdir(parents=True)
            existing = {
                "schemaVersion": 5,
                "videoUrl": task.url,
                "createdAt": "2026-07-12T10:00:00Z",
                "updatedAt": "2026-07-12T10:00:00Z",
                "globalSummary": "Old summary",
                "theses": [{"id": 1, "statement": "Old thesis"}],
                "segments": [{"title": "Existing chapter", "start": 0, "end": 120, "score": 0.8}],
                "promotionSegments": [{"start": 30, "end": 45, "source": "sponsorblock"}],
                "translatedSubtitles": {"language": "fr", "cues": [{"start": 0, "end": 1, "text": "Bonjour"}]},
            }
            highlight_path.write_text(json.dumps(existing), encoding="utf-8")
            analysis = {
                "transcriptLanguage": "en",
                "globalSummary": "Updated summary",
                "theses": [{"id": 1, "statement": "Updated thesis"}],
                "mixProfile": {"topics": ["ai agents"], "relatedTopics": [], "angleLabels": []},
                "discoveryProfile": {
                    "version": 1,
                    "axes": [
                        {"id": axis, "label": axis, "queries": {"en": f"{axis} query"}}
                        for axis in GENERATOR.DISCOVERY_AXIS_IDS
                    ],
                },
            }

            GENERATOR.update_highlights_analysis(task, analysis, args_for(root))
            updated = json.loads(highlight_path.read_text(encoding="utf-8"))

            self.assertEqual(updated["schemaVersion"], 8)
            self.assertEqual(updated["globalSummary"], "Updated summary")
            self.assertEqual(updated["mixProfile"], analysis["mixProfile"])
            self.assertEqual(updated["discoveryProfile"], analysis["discoveryProfile"])
            self.assertEqual(updated["segments"], existing["segments"])
            self.assertEqual(updated["promotionSegments"], existing["promotionSegments"])
            self.assertEqual(updated["translatedSubtitles"], existing["translatedSubtitles"])

    def test_discovery_profile_requires_all_axes_and_requested_queries(self):
        args = args_for(Path(tempfile.gettempdir()), discovery_languages="fr,ja")
        valid = {
            "version": 1,
            "axes": [
                {"id": axis, "label": axis, "queries": {"en": f"{axis} english", "fr": f"{axis} francais", "ja": f"{axis} japanese"}}
                for axis in GENERATOR.DISCOVERY_AXIS_IDS
            ],
        }
        self.assertEqual(GENERATOR.validate_discovery_profile(valid, args), valid)

        invalid = {**valid, "axes": valid["axes"][:-1]}
        self.assertIsNone(GENERATOR.validate_discovery_profile(invalid, args))

    def test_analysis_cache_path_changes_when_discovery_languages_change(self):
        root = Path(tempfile.gettempdir())
        first = GENERATOR.analysis_cache_path("https://www.youtube.com/watch?v=cache", args_for(root, discovery_languages="en,fr"))
        second = GENERATOR.analysis_cache_path("https://www.youtube.com/watch?v=cache", args_for(root, discovery_languages="en,ja"))
        self.assertNotEqual(first, second)

    def test_analysis_omits_an_invalid_discovery_profile(self):
        args = args_for(Path(tempfile.gettempdir()), discovery_languages="en")
        analysis = {
            "globalSummary": "A summary",
            "theses": [{"id": 1, "statement": "A thesis"}],
            "mixProfile": {"topics": ["ai agents"], "relatedTopics": [], "angleLabels": []},
        }

        parsed = GENERATOR.validate_analysis(analysis, args)
        self.assertNotIn("discoveryProfile", parsed)

    def test_editorial_profile_requires_normalized_dimensions(self):
        valid = {
            "version": 1,
            "genre": "documentary",
            "substance": 0.9,
            "rigor": 0.8,
            "clarity": 0.7,
            "distinctiveness": 0.6,
            "audienceValue": 0.5,
            "temporalSensitivity": 0.2,
            "confidence": 0.85,
            "rationale": "  Useful   long-form explanation. ",
        }

        parsed = GENERATOR.validate_editorial_profile(valid)
        self.assertEqual(parsed["rationale"], "Useful long-form explanation.")
        self.assertEqual(parsed["substance"], 0.9)
        self.assertIsNone(GENERATOR.validate_editorial_profile({**valid, "genre": "invalid"}))
        self.assertIsNone(GENERATOR.validate_editorial_profile({**valid, "rigor": 1.1}))
        self.assertIsNone(GENERATOR.validate_editorial_profile({**valid, "clarity": True}))

    def test_editorial_backfill_preserves_the_original_update_timestamp(self):
        with tempfile.TemporaryDirectory() as temp_name:
            root = Path(temp_name)
            url = "https://www.youtube.com/watch?v=editorial"
            path = root / "highlights" / f"{hashlib.sha256(url.encode('utf-8')).hexdigest()}.json"
            path.parent.mkdir(parents=True)
            existing = {
                "schemaVersion": 7,
                "videoUrl": url,
                "updatedAt": "2026-07-01T10:00:00Z",
                "globalSummary": "A durable explanation of a technical subject.",
                "theses": [{"id": 1, "statement": "The explanation is structured around evidence."}],
                "mixProfile": {"topics": ["technical explanation"], "relatedTopics": [], "angleLabels": []},
                "segments": [{"title": "Evidence", "summary": "The presenter cites sources.", "score": 0.8}],
            }
            path.write_text(json.dumps(existing), encoding="utf-8")
            profile = {
                "version": 1,
                "genre": "explainer",
                "substance": 0.8,
                "rigor": 0.75,
                "clarity": 0.85,
                "distinctiveness": 0.65,
                "audienceValue": 0.8,
                "temporalSensitivity": 0.1,
                "confidence": 0.8,
            }

            with patch.object(GENERATOR, "run_editorial_profile", return_value=profile):
                result = GENERATOR.backfill_editorial_profile(path, args_for(root))
            updated = json.loads(path.read_text(encoding="utf-8"))

            self.assertEqual(result, "written")
            self.assertEqual(updated["schemaVersion"], 8)
            self.assertEqual(updated["updatedAt"], existing["updatedAt"])
            self.assertEqual(updated["editorialProfile"], profile)


class TranscriptQualityTests(unittest.TestCase):
    def test_rejects_long_consecutive_repeat(self):
        cues = [GENERATOR.TranscriptCue(index * 2, index * 2 + 2, "The int bar is easy to use.") for index in range(80)]

        issue = GENERATOR.transcript_quality_issue(cues)

        self.assertIsNotNone(issue)
        self.assertIn("repeated cue loop", issue)

    def test_keeps_normal_repeated_phrases(self):
        cues = [
            GENERATOR.TranscriptCue(index * 2, index * 2 + 2, f"Distinct explanation {index}.")
            for index in range(80)
        ]
        for index in range(8, 12):
            cues[index] = GENERATOR.TranscriptCue(index * 2, index * 2 + 2, "A short refrain is normal.")

        self.assertIsNone(GENERATOR.transcript_quality_issue(cues))

    def test_keeps_refrains_separated_by_music(self):
        cues = []
        for index in range(30):
            start = index * 6
            cues.extend([
                GENERATOR.TranscriptCue(start, start + 2, "A repeated chorus is expected."),
                GENERATOR.TranscriptCue(start + 2, start + 6, "[Music]"),
            ])

        self.assertIsNone(GENERATOR.transcript_quality_issue(cues))

    def test_discards_invalid_whisper_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            args = argparse.Namespace(
                no_transcript_cache=False,
                refresh_transcript=False,
                transcript_cache_dir=directory,
            )
            task = GENERATOR.VideoTask("https://example.test/video")
            path = GENERATOR.transcript_cache_path(task.url, args)
            path.write_text(json.dumps({
                "source": "whisper-base",
                "cues": [
                    {"start": index * 2, "end": index * 2 + 2, "text": "The int bar is easy to use."}
                    for index in range(80)
                ],
            }), encoding="utf-8")

            self.assertIsNone(GENERATOR.load_cached_transcript(task, args))
            self.assertFalse(path.exists())

    def test_retries_medium_after_a_repeated_whisper_transcript(self):
        def timestamp(seconds: int) -> str:
            minutes, seconds = divmod(seconds, 60)
            return f"00:{minutes:02d}:{seconds:02d}.000"

        def transcript_lines(repeated: bool) -> str:
            return "\n".join(
                f"[{timestamp(index * 2)} --> {timestamp(index * 2 + 2)}] "
                f"{'The int bar is easy to use.' if repeated else f'Distinct explanation {index}.'}"
                for index in range(80)
            )

        calls = []
        args = argparse.Namespace(
            whisper_script=None,
            whisper_cli=None,
            whisper_model="base",
            language="auto",
            whisper_models_dir=None,
        )
        with tempfile.TemporaryDirectory() as directory:
            audio_path = Path(directory) / "audio.wav"
            audio_path.touch()
            with patch.object(GENERATOR, "resolve_whisper_cli", return_value="whisper-cli"), \
                 patch.object(GENERATOR, "resolve_whisper_model", side_effect=["base.bin", "medium.bin"]), \
                 patch.object(GENERATOR, "_download_audio_wav", return_value=audio_path), \
                 patch.object(GENERATOR, "run_command") as run_command:
                run_command.side_effect = [
                    subprocess.CompletedProcess([], 0, transcript_lines(True), ""),
                    subprocess.CompletedProcess([], 0, transcript_lines(False), ""),
                ]
                cues, model = GENERATOR.get_whisper_transcript(
                    GENERATOR.VideoTask("https://example.test/video"), args, Path(directory)
                )
                calls = [call.args[0] for call in run_command.call_args_list]

        self.assertEqual(model, "medium")
        self.assertEqual(len(cues), 80)
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[0][-1], "auto")


if __name__ == "__main__":
    unittest.main()
