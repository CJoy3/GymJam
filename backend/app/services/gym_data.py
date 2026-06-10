"""Live UK gym locations from OpenStreetMap (Overpass API).

Gyms are pulled live from OSM rather than hand-entered lat/lng. The query is
bounded to a caller-supplied viewport (clamped to a UK-wide box) so the map works
anywhere in the country, not just London — pan to Manchester, "Search this area",
and you get Manchester gyms. Each viewport's result is cached in-process for a few
hours since gym locations rarely change and Overpass is rate-limited; on any
failure callers fall back to whatever is in our own `gyms` table.
"""
import json
import time
import urllib.request
from typing import Any

# Bounding boxes as (south, west, north, east).
# UK-wide clamp: anything we fetch is capped to this so a wildly zoomed-out
# viewport can't ask Overpass for the whole planet.
UK_BBOX = (49.8, -8.65, 60.9, 1.78)
# Default viewport when the caller doesn't supply one (Greater London).
LONDON_BBOX = (51.28, -0.51, 51.69, 0.34)

_OVERPASS_URL = "https://overpass-api.de/api/interpreter"
_CACHE_TTL = 6 * 60 * 60  # 6 hours
# Cache keyed by rounded bbox so each searched area is fetched at most once/TTL.
_cache: dict[tuple, dict[str, Any]] = {}

# Established UK gym brands we want to surface. OSM is full of tiny, unnamed or
# obscure "fitness_centre" nodes; without this filter the map shows places no one
# recognises. We keep a gym only if its OSM `brand`/`operator`/`name` matches one
# of these, so the map reflects real, recognisable chains (PureGym, The Gym
# Group, Ethos at Imperial, etc.). Matching is substring + case-insensitive.
ESTABLISHED_GYM_BRANDS = (
    "puregym",
    "the gym group",
    "the gym ",      # "The Gym Group" branches are often tagged just "The Gym"
    "gym group",
    "fitness first",
    "virgin active",
    "david lloyd",
    "nuffield health",
    "anytime fitness",
    "gymbox",
    "third space",
    "everyone active",
    "energie fitness",
    "énergie fitness",
    "jd gyms",
    "bannatyne",
    "snap fitness",
    "f45",
    "better gym",       # GLL "Better" leisure centres
    "places gym",
    "places leisure",
    "easygym",
    "sweat by bxr",
    "1rebel",
    "barry's",
    "ethos",            # Imperial College's Ethos sports centre
    "imperial college",
    "ucl",
    "kings college",
    "university of london",
)


def _is_established(*values: str | None) -> bool:
    """True if any OSM tag value matches a known established gym brand."""
    for v in values:
        low = (v or "").lower()
        if any(brand in low for brand in ESTABLISHED_GYM_BRANDS):
            return True
    return False


def _clamp_bbox(bbox: tuple[float, float, float, float]) -> tuple[float, float, float, float]:
    """Intersect a requested viewport with the UK box so we never over-fetch."""
    s, w, n, e = bbox
    S, W, N, E = UK_BBOX
    s, n = max(min(s, n), S), min(max(s, n), N)
    w, e = max(min(w, e), W), min(max(w, e), E)
    return (s, w, n, e)


def _build_query(bbox: tuple[float, float, float, float]) -> str:
    s, w, n, e = bbox
    box = f"{s},{w},{n},{e}"
    # `nwr` = nodes/ways/relations; `out center` gives a single coord for areas.
    # We over-fetch and filter to established brands in Python (see
    # `ESTABLISHED_GYM_BRANDS`) — Overpass regex on multiple tags is brittle.
    return (
        "[out:json][timeout:25];"
        "("
        f'nwr["leisure"="fitness_centre"]({box});'
        f'nwr["leisure"="sports_centre"]({box});'
        ");"
        "out center 800;"
    )


def fetch_gyms(bbox: tuple[float, float, float, float] | None = None) -> list[dict]:
    """Return established gyms in `bbox` as {osm_id, name, latitude, longitude}.

    `bbox` is (south, west, north, east); defaults to Greater London and is
    clamped to the UK. Cached per-viewport for `_CACHE_TTL`. Raises on
    network/parse failure so the caller can fall back to the DB gyms."""
    bbox = _clamp_bbox(bbox or LONDON_BBOX)
    key = tuple(round(x, 2) for x in bbox)

    now = time.monotonic()
    cached = _cache.get(key)
    if cached and (now - cached["ts"]) < _CACHE_TTL:
        return cached["data"]

    req = urllib.request.Request(
        _OVERPASS_URL,
        data=_build_query(bbox).encode("utf-8"),
        headers={"Content-Type": "text/plain", "User-Agent": "GymJam/1.0"},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        payload = json.loads(resp.read().decode("utf-8"))

    out: list[dict] = []
    for el in payload.get("elements", []):
        tags = el.get("tags") or {}
        name = tags.get("name")
        if not name or name.startswith("("):
            continue  # skip unnamed / placeholder ("(Unoccupied)") gyms
        # Only keep recognisable, established gym brands.
        if not _is_established(name, tags.get("brand"), tags.get("operator")):
            continue
        lat = el.get("lat")
        lon = el.get("lon")
        if lat is None or lon is None:
            center = el.get("center") or {}
            lat, lon = center.get("lat"), center.get("lon")
        if lat is None or lon is None:
            continue
        out.append({
            "osm_id": f"osm-{el.get('type', 'n')}-{el.get('id')}",
            "name": name,
            "latitude": float(lat),
            "longitude": float(lon),
        })

    _cache[key] = {"ts": now, "data": out}
    return out


# Backwards-compatible alias.
def fetch_london_gyms() -> list[dict]:
    return fetch_gyms(LONDON_BBOX)
