import importlib.util
from pathlib import Path
import unittest


MODULE_PATH = Path(__file__).with_name("smart_search_translator.py")
SPEC = importlib.util.spec_from_file_location("smart_search_translator", MODULE_PATH)
assert SPEC and SPEC.loader
TRANSLATOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(TRANSLATOR)


class DiscoveryQueryTranslationTests(unittest.TestCase):
    def setUp(self):
        self.original_call_model = TRANSLATOR.call_model

    def tearDown(self):
        TRANSLATOR.call_model = self.original_call_model

    def test_translates_a_batch_of_axes_and_languages(self):
        TRANSLATOR.call_model = lambda prompt: {
            "translations": [
                {"key": "core", "language": "fr", "text": "fonctionnement pompe a chaleur"},
                {"key": "core", "language": "ja", "text": "ヒートポンプ 仕組み"},
                {"key": "impact", "language": "fr", "text": "pompe a chaleur impact climatique"},
                {"key": "impact", "language": "ja", "text": "ヒートポンプ 気候 影響"},
            ]
        }

        result = TRANSLATOR.translate_query_variants({
            "targetLanguages": ["fr", "ja"],
            "variants": [
                {"key": "core", "text": "heat pump operation"},
                {"key": "impact", "text": "heat pump climate impact"},
            ],
        })

        self.assertEqual(len(result["translations"]), 4)
        self.assertEqual(result["translations"][0]["key"], "core")

    def test_rejects_unrequested_or_duplicate_entries(self):
        TRANSLATOR.call_model = lambda prompt: {
            "translations": [
                {"key": "core", "language": "fr", "text": "premiere"},
                {"key": "core", "language": "fr", "text": "doublon"},
                {"key": "unknown", "language": "fr", "text": "ignore"},
                {"key": "core", "language": "ru", "text": "ignore"},
            ]
        }

        result = TRANSLATOR.translate_query_variants({
            "targetLanguages": ["fr"],
            "variants": [{"key": "core", "text": "heat pump operation"}],
        })

        self.assertEqual(result["translations"], [{"key": "core", "language": "fr", "text": "premiere"}])


if __name__ == "__main__":
    unittest.main()
