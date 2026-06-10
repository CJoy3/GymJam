"""Live UK gym locations from OpenStreetMap (Overpass API).

Gyms are pulled live from OSM rather than hand-entered lat/lng. The query is
bounded to a caller-supplied viewport (clamped to a UK-wide box) so the map works
anywhere in the country, not just London — pan to Manchester, "Search this area",
and you get Manchester gyms. Each viewport's result is cached in-process for a few
hours since gym locations rarely change and Overpass is rate-limited; on any
failure callers fall back to whatever is in our own `gyms` table.
"""
import json
import math
import re
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


# Established gyms that are genuinely missing from OpenStreetMap. OSM is
# volunteer-mapped, so some real, well-known branches simply aren't in it (e.g.
# The Gym Group's Acton branch in Royale Leisure Park). We merge these curated
# entries — with coordinates geocoded from each branch's real address — into the
# live OSM results and de-duplicate, so recognisable gyms always show even where
# OSM has a gap. Only add a branch here if you have its real coordinates; a wrong
# pin is worse than a missing one. Extend as further gaps are reported.
SEED_GYMS: list[dict] = [
    {"osm_id": "seed-tgg-acton", "name": "The Gym Group London Acton",
     "latitude": 51.5255, "longitude": -0.2803},
]


def _norm(name: str) -> str:
    return " ".join((name or "").lower().split())


def _within(bbox: tuple[float, float, float, float], lat: float, lon: float) -> bool:
    s, w, n, e = bbox
    return s <= lat <= n and w <= lon <= e


def _metres_apart(a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
    """Cheap planar distance in metres — accurate enough at city scale."""
    dlat = (a_lat - b_lat) * 111_000
    dlon = (a_lon - b_lon) * 111_000 * math.cos(math.radians(a_lat))
    return math.hypot(dlat, dlon)


# Regex alternation of the brands, used to filter **server-side** in Overpass so
# we only download the handful of established gyms in a viewport rather than every
# fitness centre (hundreds). This both fixes truncation — the old `out 800` cap
# silently dropped branded gyms in dense areas like London — and makes the query
# much faster (tiny payload to transfer + parse).
_BRAND_REGEX = "|".join(sorted({re.escape(b.strip()) for b in ESTABLISHED_GYM_BRANDS}, key=len, reverse=True))


# Defensive cap on how large a viewport we'll ever query, in degrees of half-span
# (~6 miles). The client only ever asks for a 5-mile radius, but this guarantees a
# pathological request can't pull thousands of gyms and overwhelm the map.
_MAX_HALF_SPAN_DEG = 0.09


def _clamp_bbox(bbox: tuple[float, float, float, float]) -> tuple[float, float, float, float]:
    """Cap the viewport span (defensive) then intersect with the UK box so we
    never over-fetch."""
    s, w, n, e = bbox
    s, n = min(s, n), max(s, n)
    w, e = min(w, e), max(w, e)

    # Shrink an oversized box around its centre.
    clat, clon = (s + n) / 2, (w + e) / 2
    half_lat = min((n - s) / 2, _MAX_HALF_SPAN_DEG)
    half_lon = min((e - w) / 2, _MAX_HALF_SPAN_DEG)
    s, n = clat - half_lat, clat + half_lat
    w, e = clon - half_lon, clon + half_lon

    S, W, N, E = UK_BBOX
    s, n = max(s, S), min(n, N)
    w, e = max(w, W), min(e, E)
    return (s, w, n, e)


def _build_query(bbox: tuple[float, float, float, float]) -> str:
    s, w, n, e = bbox
    box = f"{s},{w},{n},{e}"
    lt = '["leisure"~"fitness_centre|sports_centre"]'
    # `nwr` = nodes/ways/relations; `out center` gives a single coord for areas.
    # Filter to established brands *in the query* (case-insensitive regex on
    # name/brand/operator) so Overpass returns only the gyms we'll show — fast,
    # and no `out` cap can drop a branded gym. `_is_established` re-checks below.
    return (
        "[out:json][timeout:15];"
        "("
        f'nwr{lt}["name"~"{_BRAND_REGEX}",i]({box});'
        f'nwr{lt}["brand"~"{_BRAND_REGEX}",i]({box});'
        f'nwr{lt}["operator"~"{_BRAND_REGEX}",i]({box});'
        ");"
        "out center 400;"
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

    # Fill OSM gaps with curated branches inside this viewport, unless OSM already
    # has the same branch nearby (avoid duplicate pins).
    for seed in SEED_GYMS:
        if not _within(bbox, seed["latitude"], seed["longitude"]):
            continue
        dup = any(
            _norm(g["name"]) == _norm(seed["name"])
            and _metres_apart(g["latitude"], g["longitude"], seed["latitude"], seed["longitude"]) < 400
            for g in out
        )
        if not dup:
            out.append(dict(seed))

    _cache[key] = {"ts": now, "data": out}
    return out


# Backwards-compatible alias.
def fetch_london_gyms() -> list[dict]:
    return fetch_gyms(LONDON_BBOX)
