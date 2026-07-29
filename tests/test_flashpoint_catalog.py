import unittest

from tools.flashpoint_catalog import parse_game_details, parse_search_results


UUID = "a2fb012a-b14c-6921-b688-403571e42bb0"


class FlashpointCatalogTests(unittest.TestCase):
    def test_parses_search_result(self):
        source = f"""
        <div class="fp-search-result">
          <a href="/view?id={UUID}"></a>
          <a class="fp-search-result-title" href="/view?id={UUID}">Bike Mania Arena</a>
          <span class="fp-search-result-creator">by Flash Games 247</span>
          <div class="fp-search-result-info">Flash game - <span>Sports - Motocross</span></div>
        </div>
        """
        games = parse_search_results(source)
        self.assertEqual(len(games), 1)
        self.assertEqual(games[0]["title"], "Bike Mania Arena")
        self.assertEqual(games[0]["platform"], "Flash")
        self.assertEqual(games[0]["tags"], ["Sports", "Motocross"])

    def test_parses_compatible_gamezip(self):
        source = f"""
        <div class="header-large">Bike Mania Arena</div>
        <div data-game-zip="https://download.unstable.life/gib-roms/Games/{UUID}-1651457108151.zip"
             data-launch-command="http://localflash/game/main.swf"></div>
        <div class="row"><div class="field">Library:</div><div class="value">Games</div></div>
        <div class="row"><div class="field">Platform:</div><div class="value">Flash</div></div>
        <div class="row"><div class="field">Status:</div><div class="value">Playable</div></div>
        <div class="row"><div class="field">Application Path:</div><div class="value">FPSoftware\\Flash\\flashplayer_32_sa.exe</div></div>
        """
        details = parse_game_details(source, "http://localhost:8000", UUID)
        self.assertTrue(details["compatible"])
        self.assertEqual(
            details["downloadUrl"],
            f"http://localhost:8000/api/games/{UUID}/download",
        )

    def test_rejects_legacy_entry(self):
        details = parse_game_details(
            '<div data-game-zip="" data-launch-command="http://localflash/main.swf"></div>',
            "http://localhost:8000",
            UUID,
        )
        self.assertFalse(details["compatible"])
        self.assertIn("GameZIP", details["incompatibleReason"])


if __name__ == "__main__":
    unittest.main()
