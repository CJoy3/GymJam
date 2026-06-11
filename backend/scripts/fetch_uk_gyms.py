#!/usr/bin/env python3
"""Fetch every UK location of the major gym chains from OpenStreetMap (Overpass)
and emit a Supabase seed: ``backend/supabase/gyms_seed.sql``.

Why this exists
---------------
The Squad Map used to query Overpass *live* on every request, which was slow and
"hit or miss" (public Overpass mirrors 429/504 intermittently). Instead we fetch
the gym locations **once**, here, and store them in the ``gyms`` table; the map
then reads stable rows from our own DB. Re-run this script to refresh the data.

Usage
-----
    python backend/scripts/fetch_uk_gyms.py            # writes gyms_seed.sql
    python backend/scripts/fetch_uk_gyms.py --push     # also upsert into Supabase
                                                       # (needs SUPABASE_URL +
                                                       #  SUPABASE_SERVICE_KEY)

Raw Overpass responses are cached under ``backend/scripts/.cache/`` so re-runs are
cheap and the fetch is resumable if a mirror times out partway through.

Coverage note: OpenStreetMap is volunteer-mapped, so a handful of branches may be
missing. It is by far the most complete openly-queryable source, and matching on
``brand`` + ``name`` + ``operator`` per chain gets the overwhelming majority. Add
genuinely-missing branches to SEED_EXTRA below (with real coordinates).
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

# UK-wide bounding box (south, west, north, east) — covers GB + NI.
UK_BBOX = "49.8,-8.65,60.9,1.78"

OVERPASS_MIRRORS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
)

# Canonical chain label -> Overpass-regex matching its brand/name/operator tags.
# Keep the regex tight so we don't sweep in unrelated "... Gym" places.
BRANDS: dict[str, str] = {
    "PureGym": "PureGym|Pure Gym",
    "The Gym Group": "The Gym Group|^The Gym$",
    "JD Gyms": "JD Gyms?",
    "Anytime Fitness": "Anytime Fitness",
    "Snap Fitness": "Snap Fitness",
    "David Lloyd": "David Lloyd",
    "Virgin Active": "Virgin Active",
    "Nuffield Health": "Nuffield Health",
    "Fitness First": "Fitness First",
}

# Branches genuinely absent from OSM — merged in with real coordinates. Extend as
# gaps are reported. (osm_id is synthetic but stable so upserts stay idempotent.)
SEED_EXTRA: list[dict] = [
    {"osm_id": "seed-tgg-acton", "brand": "The Gym Group",
     "name": "The Gym Group London Acton", "latitude": 51.5255, "longitude": -0.2803},
    # Imperial College's own sports centre (7 Prince's Gardens, SW7) — not a chain,
    # so OSM doesn't carry it under a brand. Coords are OSM's "Ethos Gym" node.
    {"osm_id": "seed-ethos-imperial", "brand": "Ethos",
     "name": "Ethos Sports Centre", "latitude": 51.500099, "longitude": -0.173452},
]

CACHE_DIR = Path(__file__).resolve().parent / ".cache"
OUT_SQL = Path(__file__).resolve().parents[1] / "supabase" / "gyms_seed.sql"

REQUEST_TIMEOUT = 60  # seconds per mirror attempt

# Nominatim (OSM reverse geocoder) — used only to name branches OSM leaves bare.
# Its usage policy requires an identifying User-Agent and ≤1 request/second.
NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
NOMINATIM_UA = "GymJam/1.0 (UK gym locator; +https://github.com/ctj24/GymJam)"
NOMINATIM_DELAY = 1.1  # seconds between calls (politeness)


def _overpass(query: str, rounds: int = 3) -> dict:
    """POST a query to each mirror in turn; return the first JSON response. Public
    Overpass mirrors time out intermittently, so we sweep the mirror list several
    times with backoff before giving up."""
    last: Exception | None = None
    for attempt in range(rounds):
        for url in OVERPASS_MIRRORS:
            try:
                req = urllib.request.Request(
                    url, data=query.encode("utf-8"),
                    headers={"Content-Type": "text/plain", "User-Agent": "GymJam/1.0"},
                )
                with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
                    return json.loads(resp.read().decode("utf-8"))
            except Exception as exc:  # noqa: BLE001 — try the next mirror
                last = exc
                print(f"    mirror failed ({url.split('//')[1].split('/')[0]}): {type(exc).__name__}")
                time.sleep(2)
        if attempt < rounds - 1:
            time.sleep(5 * (attempt + 1))  # back off, then sweep the mirrors again
    raise last or RuntimeError("all Overpass mirrors failed")


def _fetch_brand(label: str, regex: str, deep: bool = False) -> list[dict]:
    """All OSM elements for one chain, cached on disk. The ``brand`` tag alone
    gives near-complete coverage of these major chains and is fast/reliable. The
    optional ``deep`` sweep also matches leisure-scoped name/operator to catch the
    rare un-branded branch — it's heavier and flaky on public mirrors, so it's a
    single best-effort attempt that can never hang or fail the run."""
    CACHE_DIR.mkdir(exist_ok=True)
    cache = CACHE_DIR / f"{label.replace(' ', '_')}.json"
    if cache.exists():
        return json.loads(cache.read_text()).get("elements", [])

    elements: dict[tuple, dict] = {}

    def collect(payload: dict) -> None:
        for el in payload.get("elements", []):
            elements[(el.get("type"), el.get("id"))] = el

    # brand tag — fast, clean, the essential query (retried hard).
    print(f"  {label}: brand query…")
    collect(_overpass(f'[out:json][timeout:55];nwr["brand"~"{regex}",i]({UK_BBOX});out center;', rounds=3))
    # name/operator scoped to leisure venues — best-effort single attempt only.
    if deep:
        try:
            print(f"  {label}: deep name/operator query…")
            collect(_overpass(
                f'[out:json][timeout:55];('
                f'nwr["leisure"]["name"~"{regex}",i]({UK_BBOX});'
                f'nwr["leisure"]["operator"~"{regex}",i]({UK_BBOX});'
                f');out center;',
                rounds=1,
            ))
        except Exception as exc:  # noqa: BLE001 — brand results are enough on failure
            print(f"    (deep query skipped: {type(exc).__name__})")

    payload = {"elements": list(elements.values())}
    cache.write_text(json.dumps(payload))
    return payload["elements"]


def _metres_apart(a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
    """Cheap planar distance in metres — accurate enough at city scale."""
    dlat = (a_lat - b_lat) * 111_000
    dlon = (a_lon - b_lon) * 111_000 * math.cos(math.radians(a_lat))
    return math.hypot(dlat, dlon)


def _coord(el: dict) -> tuple[float, float] | None:
    lat, lon = el.get("lat"), el.get("lon")
    if lat is None or lon is None:
        c = el.get("center") or {}
        lat, lon = c.get("lat"), c.get("lon")
    if lat is None or lon is None:
        return None
    return float(lat), float(lon)


# Big-city names that DON'T disambiguate a branch — "PureGym London" is useless
# when there are 80 of them. When these are all OSM gives us, we reverse-geocode
# the coordinate to a real neighbourhood instead (see _reverse_area).
GENERIC_CITIES = {"london", "greater london", "city of london"}


def _specifier_from_tags(tags: dict) -> str | None:
    """The most recognisable locality from OSM address tags, or None if all we
    have is a generic big-city name. Combines the place with the street for
    uniqueness: a Brighton branch on London Road becomes 'Brighton London Road'
    (not a bare 'London Road' that collides with five other towns), while a London
    branch — where the city name is useless — falls back to its street/suburb."""
    suburb = tags.get("addr:suburb") or tags.get("addr:neighbourhood") or tags.get("addr:quarter")
    street = tags.get("addr:street")
    house = tags.get("addr:housename")
    town = tags.get("addr:town")
    city = tags.get("addr:city")
    # The recognisable "place" — a suburb, else a real town/city (never generic
    # "London", which can't tell 80 branches apart).
    place = suburb
    if not place and town and town.lower() not in GENERIC_CITIES:
        place = town
    if not place and city and city.lower() not in GENERIC_CITIES:
        place = city
    if place and street and place.lower() not in street.lower():
        return f"{place} {street}"
    if place:
        return place
    if street:
        return street
    if house:
        return house
    return None


# Filler words that don't identify a *branch* — a name made only of the brand +
# these is generic (e.g. "Nuffield Health Fitness & Wellbeing", "David Lloyd
# Clubs") and must be replaced with a real locality, or 90 branches read alike.
GENERIC_NAME_WORDS = {
    "fitness", "wellbeing", "well-being", "health", "club", "clubs", "leisure",
    "gym", "gyms", "centre", "center", "studio", "spa", "racquets", "racquet",
    "&", "and", "the", "at", "-",
}


def _name_adds_detail(label: str, raw: str) -> bool:
    """True if the OSM name identifies *which* branch — i.e. it has a token beyond
    the brand words and generic gym filler. 'PureGym Stratford' → True;
    'Nuffield Health Fitness & Wellbeing' → False (says nothing branch-specific)."""
    brand_words = set(label.lower().split())
    residue = [
        t for t in re.split(r"[\s,]+", raw.lower())
        if t and t not in brand_words and t not in GENERIC_NAME_WORDS
    ]
    return bool(residue)


def _display_name(label: str, tags: dict, rev_area: str | None = None) -> str:
    """A human-friendly, *specific* name. Keeps OSM's name only when it actually
    names the branch; otherwise appends the most specific locality we have — an
    address tag, or (for branches OSM leaves bare/generic) a reverse-geocoded
    neighbourhood — so every branch is distinguishable in the picker."""
    raw = " ".join((tags.get("name") or "").split())
    if raw and _name_adds_detail(label, raw):
        return raw
    spec = _specifier_from_tags(tags) or rev_area
    return f"{label} {spec}" if spec else label


_GEO_CACHE_FILE = CACHE_DIR / "_revgeo.json"
# Coarse council/administrative names that don't identify a branch to a user.
_BAD_AREA = re.compile(r"borough of|\bcounty\b|greater london|metropolitan|^city of\b", re.I)


def _reverse_area(lat: float, lon: float, cache: dict) -> str | None:
    """Reverse-geocode a coordinate to a neighbourhood/town via Nominatim. Cached
    on disk by coordinate (resumable + polite) and fully best-effort — any failure
    just leaves the branch with its bare brand name rather than aborting."""
    key = f"{round(lat, 5)},{round(lon, 5)}"
    if key in cache:
        return cache[key]
    url = f"{NOMINATIM_URL}?format=jsonv2&lat={lat}&lon={lon}&zoom=16&addressdetails=1"
    area: str | None = None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": NOMINATIM_UA})
        with urllib.request.urlopen(req, timeout=20) as resp:
            addr = json.loads(resp.read().decode("utf-8")).get("address", {})
        # Prefer fine localities; skip coarse council-area names ("London Borough
        # of Ealing", "Greater London") that don't help a user pick a branch.
        candidates = [addr.get(k) for k in (
            "suburb", "neighbourhood", "quarter", "town", "village",
            "city_district", "city_block", "road",
        )]
        area = next((c for c in candidates if c and not _BAD_AREA.search(c)), None)
    except Exception:  # noqa: BLE001 — best-effort; keep going on any error
        return None
    cache[key] = area
    CACHE_DIR.mkdir(exist_ok=True)
    _GEO_CACHE_FILE.write_text(json.dumps(cache))  # persist each hit → resumable
    time.sleep(NOMINATIM_DELAY)
    return area


# --------------------------------------------------------------------------
# Official store-finders.
# OSM gives accurate coordinates but generic names ("PureGym", "Nuffield Health
# Fitness & Wellbeing"). A chain's own store-finder has the *branch* name users
# recognise ("PureGym London Acton") and is the most complete source, so we
# prefer it where we can scrape it cleanly. Each fetcher returns rows shaped like
# the OSM ones: {osm_id, brand, name, latitude, longitude}. Cached on disk.
# --------------------------------------------------------------------------
_BROWSER_UA = "Mozilla/5.0 (compatible; GymJam/1.0; +https://github.com/ctj24/GymJam)"


def _http_get(url: str, timeout: int = 20) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": _BROWSER_UA})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", "replace")


def _clean_branch_name(label: str, name: str) -> str:
    """'London Acton Gym' → 'PureGym London Acton' (brand prefix, drop trailing
    'Gym'/'Health Club' filler, collapse whitespace)."""
    n = " ".join((name or "").split())
    n = re.sub(rf"^{re.escape(label)}\s+", "", n, flags=re.I)
    n = re.sub(r"\s+(Gym|Health Club|Fitness( Centre)?)$", "", n, flags=re.I).strip()
    return f"{label} {n}" if n and n.lower() != label.lower() else label


def _fetch_puregym_official() -> list[dict]:
    """All PureGym branches from puregym.com — each branch page carries JSON-LD
    with the branch name + geo coordinates. ~490 branches, fetched concurrently."""
    cache = CACHE_DIR / "official_PureGym.json"
    if cache.exists():
        return json.loads(cache.read_text())

    index = _http_get("https://www.puregym.com/gyms/")
    slugs = sorted({s for s in re.findall(r'/gyms/([a-z0-9\-]+)/?"', index) if s != "find-a-gym"})

    def one(slug: str) -> dict | None:
        try:
            html = _http_get(f"https://www.puregym.com/gyms/{slug}/")
            for ld in re.findall(r'type="application/ld\+json"[^>]*>(.*?)</script>', html, re.S):
                d = json.loads(ld)
                if isinstance(d, dict) and d.get("geo"):
                    return {
                        "osm_id": f"puregym-{slug}",
                        "brand": "PureGym",
                        "name": _clean_branch_name("PureGym", d.get("name", "")),
                        "latitude": round(float(d["geo"]["latitude"]), 6),
                        "longitude": round(float(d["geo"]["longitude"]), 6),
                    }
        except Exception:  # noqa: BLE001 — skip a branch that won't parse
            return None
        return None

    with ThreadPoolExecutor(max_workers=12) as ex:
        rows = [r for r in ex.map(one, slugs) if r]
    CACHE_DIR.mkdir(exist_ok=True)
    cache.write_text(json.dumps(rows))
    return rows


# Brand -> official fetcher. Brands not listed fall back to OSM + reverse-geocoding.
OFFICIAL_FETCHERS = {
    "PureGym": _fetch_puregym_official,
}


def build_rows(deep: bool = False, geocode: bool = True) -> list[dict]:
    rows: list[dict] = []
    failed: list[str] = []
    for label, regex in BRANDS.items():
        # Prefer the chain's own store-finder (recognisable branch names) where we
        # have one; fall back to OSM if it fails.
        if label in OFFICIAL_FETCHERS:
            try:
                official = OFFICIAL_FETCHERS[label]()
                rows.extend(official)
                print(f"  -> {label}: {len(official)} gyms (official store-finder)")
                continue
            except Exception as exc:  # noqa: BLE001 — fall back to OSM on any failure
                print(f"  !! {label}: official fetch failed ({type(exc).__name__}); using OSM")
        try:
            els = _fetch_brand(label, regex, deep=deep)
        except Exception as exc:  # noqa: BLE001 — record + keep going; re-run resumes from cache
            print(f"  !! {label}: FAILED ({type(exc).__name__}) — will need a re-run")
            failed.append(label)
            continue
        kept = 0
        for el in els:
            tags = el.get("tags") or {}
            name = (tags.get("name") or "").strip()
            if name.startswith("("):
                continue  # placeholder like "(Unoccupied)"
            coord = _coord(el)
            if not coord:
                continue
            lat, lon = coord
            rows.append({
                "osm_id": f"osm-{el.get('type', 'n')}-{el.get('id')}",
                "brand": label,
                "name": _display_name(label, tags),
                "latitude": round(lat, 6),
                "longitude": round(lon, 6),
            })
            kept += 1
        print(f"  -> {label}: {kept} gyms")
    if failed:
        raise SystemExit(
            f"\nIncomplete: {', '.join(failed)} could not be fetched (Overpass busy). "
            "Re-run the script — cached brands load instantly so it resumes."
        )

    # Name the branches OSM left bare (no address tags at all) by reverse-geocoding
    # their coordinate to a neighbourhood — otherwise dozens would all read just
    # "PureGym". Cached + resumable; safe to interrupt and re-run.
    if geocode:
        cache = json.loads(_GEO_CACHE_FILE.read_text()) if _GEO_CACHE_FILE.exists() else {}
        bare = [r for r in rows if r["name"] == r["brand"]]
        if bare:
            uncached = sum(1 for r in bare if f"{round(r['latitude'],5)},{round(r['longitude'],5)}" not in cache)
            print(f"  reverse-geocoding {len(bare)} bare branches "
                  f"({uncached} uncached → ~{uncached * NOMINATIM_DELAY / 60:.0f} min)…")
            for i, r in enumerate(bare, 1):
                area = _reverse_area(r["latitude"], r["longitude"], cache)
                if area:
                    r["name"] = f"{r['brand']} {area}"
                if i % 25 == 0:
                    print(f"    geocoded {i}/{len(bare)}")

    rows.extend(SEED_EXTRA)

    # De-duplicate the same physical gym appearing as both node and way (and any
    # near-duplicate of the same brand) by bucketing to ~110m. Keep the longest
    # (most descriptive) name.
    best: dict[tuple, dict] = {}
    for r in rows:
        key = (r["brand"], round(r["latitude"], 3), round(r["longitude"], 3))
        cur = best.get(key)
        if cur is None or len(r["name"]) > len(cur["name"]):
            best[key] = r
    deduped = sorted(best.values(), key=lambda r: (r["brand"], r["name"]))

    # Second pass: collapse a branch mapped twice just over the bucket edge —
    # identical brand+name within ~350 m is one gym double-mapped, not two. (Same
    # name *far* apart is left alone: distinct branches in like-named places, e.g.
    # Vauxhall in London vs Liverpool, which a proximity-sorted picker separates.)
    merged: list[dict] = []
    for r in deduped:
        if not any(
            m["brand"] == r["brand"] and m["name"] == r["name"]
            and _metres_apart(m["latitude"], m["longitude"], r["latitude"], r["longitude"]) < 350
            for m in merged
        ):
            merged.append(r)
    return merged


def _sql_escape(s: str) -> str:
    return s.replace("'", "''")


def write_sql(rows: list[dict]) -> None:
    chunks: list[str] = []
    header = (
        "-- GymJam: UK gym locations for the Squad Map, sourced from OpenStreetMap.\n"
        "-- GENERATED by backend/scripts/fetch_uk_gyms.py — do not hand-edit.\n"
        f"-- {len(rows)} gyms across {len(BRANDS)} chains. Idempotent (upsert by osm_id).\n"
        "-- Run in the Supabase SQL editor AFTER schema.sql (needs gyms.brand + osm_id).\n\n"
    )
    BATCH = 400
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i + BATCH]
        values = ",\n".join(
            "  ('{osm}', '{name}', '{brand}', {lat}, {lng})".format(
                osm=_sql_escape(r["osm_id"]), name=_sql_escape(r["name"]),
                brand=_sql_escape(r["brand"]), lat=r["latitude"], lng=r["longitude"],
            )
            for r in batch
        )
        chunks.append(
            "insert into gyms (osm_id, name, brand, latitude, longitude)\nvalues\n"
            + values
            + "\non conflict (osm_id) where osm_id is not null do update set\n"
            "  name = excluded.name, brand = excluded.brand,\n"
            "  latitude = excluded.latitude, longitude = excluded.longitude;\n"
        )
    OUT_SQL.write_text(header + "\n".join(chunks))
    print(f"\nWrote {len(rows)} gyms -> {OUT_SQL}")


def push_to_supabase(rows: list[dict]) -> None:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from app.core.supabase_client import get_supabase  # noqa: E402

    sb = get_supabase()
    for i in range(0, len(rows), 500):
        sb.table("gyms").upsert(rows[i:i + 500], on_conflict="osm_id").execute()
        print(f"  upserted {min(i + 500, len(rows))}/{len(rows)}")
    print("Pushed to Supabase.")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--push", action="store_true", help="upsert into Supabase too")
    ap.add_argument("--deep", action="store_true",
                    help="also sweep leisure name/operator tags (slower; extra coverage)")
    ap.add_argument("--no-geocode", action="store_true",
                    help="skip reverse-geocoding bare branches (faster; less specific names)")
    args = ap.parse_args()

    rows = build_rows(deep=args.deep, geocode=not args.no_geocode)
    write_sql(rows)
    if args.push:
        push_to_supabase(rows)


if __name__ == "__main__":
    main()
