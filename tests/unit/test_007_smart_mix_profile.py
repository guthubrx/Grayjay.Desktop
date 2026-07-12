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


class SmartMixProfileTests(unittest.TestCase):
    def test_007_normalizes_and_bounds_mix_profile_labels(self):
        profile = MODULE.validate_mix_profile({
            "topics": [" AI agents ", "ai agents", "software development", 42, "x" * 81],
            "relatedTopics": ["Developer productivity", "developer productivity", "enterprise adoption"],
            "angleLabels": ["Implementation workflow", "Risk assessment", "risk assessment"],
        })

        self.assertEqual(profile, {
            "topics": ["ai agents", "software development"],
            "relatedTopics": ["developer productivity", "enterprise adoption"],
            "angleLabels": ["implementation workflow", "risk assessment"],
        })

    def test_007_keeps_old_analysis_valid_without_a_mix_profile(self):
        analysis = MODULE.validate_analysis({
            "transcriptLanguage": "ja",
            "globalSummary": "A complete analysis of AI agents.",
            "theses": [{"id": 1, "statement": "AI agents change developer workflows."}],
        })

        self.assertNotIn("mixProfile", analysis)

    def test_007_discards_an_invalid_or_empty_mix_profile(self):
        profile = MODULE.validate_mix_profile({
            "topics": ["", None, 12],
            "relatedTopics": "not a list",
            "angleLabels": [],
        })

        self.assertIsNone(profile)

    def test_007_keeps_a_valid_profile_in_the_analysis_result(self):
        analysis = MODULE.validate_analysis({
            "transcriptLanguage": "fr",
            "globalSummary": "A complete analysis of AI agents.",
            "theses": [{"id": 1, "statement": "AI agents change developer workflows."}],
            "mixProfile": {
                "topics": ["AI agents"],
                "relatedTopics": ["developer productivity"],
                "angleLabels": ["implementation workflow"],
            },
        })

        self.assertEqual(analysis["mixProfile"]["topics"], ["ai agents"])

    def test_007_requests_a_valid_mix_profile_shape(self):
        prompt = MODULE.build_analysis_prompt(
            MODULE.VideoTask("https://example.test/video", title="AI agents"),
            [MODULE.TranscriptCue(0.0, 1.0, "A transcript")],
            SimpleNamespace(max_transcript_chars=1000, max_theses=3, output_language="French"),
        )

        self.assertIn('"mixProfile": {', prompt)
        self.assertIn('"angleLabels": ["0 to 4 concise canonical English labels for framing, method, consequence, limit, or viewpoint"]\n  }\n}', prompt)


if __name__ == "__main__":
    unittest.main()
