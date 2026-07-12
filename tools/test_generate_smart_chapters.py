import argparse
import hashlib
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


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

            self.assertEqual(updated["schemaVersion"], 7)
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


if __name__ == "__main__":
    unittest.main()
