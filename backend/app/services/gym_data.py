"""Live London gym locations from OpenStreetMap (Overpass API).

Gyms are pulled live from OSM rather than hand-entered lat/lng, and the query is
bounded to a Greater-London box so we only ever fetch/return London gyms (the
optimisation the map needs). Results are cached in-process for a few hours since
gym locations rarely change and Overpass is rate-limited; on any failure callers
fall back to whatever is in our own `gyms` table.
"""
import json
import time
import urllib.request
from typing import Any

# Greater London bounding box: (south, west, north, east).
LONDON_BBOX = (51.28, -0.51, 51.69, 0.34)

_OVERPASS_URL = "https://overpass-api.de/api/interpreter"
_CACHE_TTL = 6 * 60 * 60  # 6 hours
_cache: dict[str, Any] = {"ts": 0.0, "data": []}


def _build_query() -> str:
    s, w, n, e = LONDON_BBOX
    bbox = f"{s},{w},{n},{e}"
    # `nwr` = nodes/ways/relations; `out center` gives a single coord for areas.
    return (
        "[out:json][timeout:20];"
        "("
        f'nwr["leisure"="fitness_centre"]({bbox});'
        f'nwr["leisure"="sports_centre"]({bbox});'
        ");"
        "out center 300;"
    )


def fetch_london_gyms() -> list[dict]:
    """Return named London gyms as {osm_id, name, latitude, longitude}.

    Cached for `_CACHE_TTL`. Raises on network/parse failure so the caller can
    fall back to the DB gyms."""
    now = time.monotonic()
    if _cache["data"] and (now - _cache["ts"]) < _CACHE_TTL:
        return _cache["data"]

    req = urllib.request.Request(
        _OVERPASS_URL,
        data=_build_query().encode("utf-8"),
        headers={"Content-Type": "text/plain", "User-Agent": "GymJam/1.0"},
    )
    with urllib.request.urlopen(req, timeout=9) as resp:
        payload = json.loads(resp.read().decode("utf-8"))

    out: list[dict] = []
    for el in payload.get("elements", []):
        name = (el.get("tags") or {}).get("name")
        if not name or name.startswith("("):
            continue  # skip unnamed / placeholder ("(Unoccupied)") gyms
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

    _cache["data"] = out
    _cache["ts"] = now
    return out
