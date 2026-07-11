import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace


MODULE_PATH = Path(__file__).parents[2] / "tools" / "generate_smart_chapters.py"
SPEC = importlib.util.spec_from_file_location("smart_chapters", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class TranslatedSubtitlesTests(unittest.TestCase):
    def test_002_translation_keeps_source_timing(self):
        source = [
            MODULE.TranscriptCue(1.0, 2.5, "Bonjour"),
            MODULE.TranscriptCue(3.0, 4.5, "Le monde"),
        ]

        translated = MODULE.validate_translated_cues(
            [{"text": "Hello"}, {"text": "World"}], source
        )

        self.assertEqual([(cue.start, cue.end) for cue in translated], [(1.0, 2.5), (3.0, 4.5)])
        self.assertEqual([cue.text for cue in translated], ["Hello", "World"])

    def test_002_translation_rejects_incomplete_response(self):
        source = [MODULE.TranscriptCue(1.0, 2.0, "Bonjour")]

        with self.assertRaises(RuntimeError):
            MODULE.validate_translated_cues([], source)

    def test_002_transcript_hash_changes_when_text_changes(self):
        first = [MODULE.TranscriptCue(1.0, 2.0, "Bonjour")]
        second = [MODULE.TranscriptCue(1.0, 2.0, "Bonsoir")]

        self.assertNotEqual(MODULE.transcript_hash(first), MODULE.transcript_hash(second))

    def test_002_reuses_matching_translated_subtitle_cache(self):
        source = [MODULE.TranscriptCue(1.0, 2.0, "Bonjour")]
        task = MODULE.VideoTask("https://example.test/video")
        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            path = MODULE.highlights_path(task.url, output_dir)
            path.write_text(json.dumps({
                "translatedSubtitles": {
                    "language": "French",
                    "sourceTranscriptHash": MODULE.transcript_hash(source),
                    "cues": [{"start": 1.0, "end": 2.0, "text": "Hello"}],
                }
            }), encoding="utf-8")

            translated = MODULE.existing_translated_subtitles(
                task,
                source,
                "French",
                SimpleNamespace(output_dir=str(output_dir), grayjay_dir=str(output_dir)),
            )

        self.assertEqual(translated["cues"][0]["text"], "Hello")

    def test_002_rejects_stale_translated_subtitle_cache(self):
        source = [MODULE.TranscriptCue(1.0, 2.0, "Bonjour")]
        task = MODULE.VideoTask("https://example.test/video")
        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            path = MODULE.highlights_path(task.url, output_dir)
            path.write_text(json.dumps({
                "translatedSubtitles": {
                    "language": "French",
                    "sourceTranscriptHash": "obsolete",
                    "cues": [{"start": 1.0, "end": 2.0, "text": "Hello"}],
                }
            }), encoding="utf-8")

            translated = MODULE.existing_translated_subtitles(
                task,
                source,
                "French",
                SimpleNamespace(output_dir=str(output_dir), grayjay_dir=str(output_dir)),
            )

        self.assertIsNone(translated)


if __name__ == "__main__":
    unittest.main()
