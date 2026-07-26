"""Find likely Flashpoint Archive logo matches for this collection.

This is a discovery helper only. It never downloads or changes project assets.
Review its candidates before adding a UUID to the icon source manifest.
"""

import concurrent.futures
import difflib
import json
import re
from pathlib import Path

import requests


PROJECT_DIR = Path(__file__).resolve().parents[1]
GAMES_PATH = PROJECT_DIR / "docs" / "js" / "games.js"
API_URL = "https://db-api.unstable.life/search"

TITLE_OVERRIDES = {
    "captain-usa": "Captain USA",
    "simpsons-wrecking-ball": "The Simpsons Movie: Wrecking Ball",
    "inside-the-firewall": "Inside the Firewall",
    "knd-operation-startup": "KND: Operation S.T.A.R.T.U.P.",
    "knd-operation-startup-final": "KND: Operation S.T.A.R.T.U.P. Final",
    "la-isla-de-lo-mono": "La Isla de lo Mono",
    "dexter-runaway-robot": "Dexter's Laboratory: Runaway Robot",
    "portal-flash": "Portal: The Flash Version",
    "sugar-sugar": "Sugar, Sugar",
    "whack-a-kass": "Whack a Kass",
    "eds-candy-machine": "Ed's Candy Machine",
    "knd-numbuh-generator": "KND Numbuh Generator",
}


def normalize(value):
    return re.sub(r"[^a-z0-9]+", "", value.casefold())


def title_from_id(game_id):
    return TITLE_OVERRIDES.get(
        game_id,
        " ".join(word.capitalize() for word in game_id.split("-")),
    )


def get_game_ids():
    source = GAMES_PATH.read_text(encoding="utf-8")
    return re.findall(r'^\s{4}"([^"]+)":\s*\{', source, re.MULTILINE)


def find_candidates(game_id):
    expected_title = title_from_id(game_id)
    response = requests.get(
        API_URL,
        params={
            "title": expected_title,
            "fields": "id,title,developer,publisher,platform,source",
            "limit": 20,
        },
        timeout=30,
    )
    response.raise_for_status()
    candidates = response.json()
    expected_normalized = normalize(expected_title)

    for candidate in candidates:
        candidate["score"] = round(
            difflib.SequenceMatcher(
                None,
                expected_normalized,
                normalize(candidate["title"]),
            ).ratio(),
            3,
        )

    candidates.sort(key=lambda item: item["score"], reverse=True)
    return game_id, {
        "expectedTitle": expected_title,
        "candidates": candidates[:3],
    }


def main():
    game_ids = [game_id for game_id in get_game_ids() if game_id != "doom"]
    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(find_candidates, game_id) for game_id in game_ids]
        for future in concurrent.futures.as_completed(futures):
            game_id, result = future.result()
            results[game_id] = result

    print(json.dumps(dict(sorted(results.items())), indent=2))


if __name__ == "__main__":
    main()
