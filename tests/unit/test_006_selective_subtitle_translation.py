import importlib.util
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace


MODULE_PATH = Path(__file__).parents[2] / "tools" / "generate_smart_chapters.py"
SPEC = importlib.util.spec_from_file_location("smart_chapters", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class SelectiveSubtitleTranslationTests(unittest.TestCase):
    def test_006_normalizes_model_and_display_language_names(self):
        self.assertEqual(MODULE.normalize_language_code("Japanese"), "ja")
        self.assertEqual(MODULE.normalize_language_code("Chinese (Simplified)"), "zh-Hans")
        self.assertEqual(MODULE.normalize_language_code("fr-FR"), "fr")
        self.assertEqual(MODULE.normalize_language_code("unknown language"), "und")

    def test_006_translates_only_selected_source_languages(self):
        args = SimpleNamespace(translate_subtitles=True, translate_subtitles_from="ja,zh-Hans")

        self.assertTrue(MODULE.should_translate_subtitles("ja", "French", args))
        self.assertFalse(MODULE.should_translate_subtitles("en", "French", args))
        self.assertFalse(MODULE.should_translate_subtitles("zh-Hans", "Chinese", args))

    def test_006_default_policy_translates_every_foreign_language(self):
        args = SimpleNamespace(translate_subtitles=True, translate_subtitles_from="")

        self.assertTrue(MODULE.should_translate_subtitles("ja", "French", args))
        self.assertTrue(MODULE.should_translate_subtitles("ru", "French", args))
        self.assertTrue(MODULE.should_translate_subtitles("ar", "French", args))
        self.assertFalse(MODULE.should_translate_subtitles("fr", "French", args))
        self.assertFalse(MODULE.should_translate_subtitles("und", "French", args))

    def test_006_uses_script_fallback_when_the_model_cannot_identify_japanese(self):
        cues = [MODULE.TranscriptCue(0.0, 1.0, "こんにちは、人工知能のニュースです")]

        self.assertEqual(MODULE.infer_transcript_language(cues, "und"), "ja")


if __name__ == "__main__":
    unittest.main()
