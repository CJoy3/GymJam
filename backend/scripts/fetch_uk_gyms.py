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
import sys
import time
import urllib.request
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
]

CACHE_DIR = Path(__file__).resolve().parent / ".cache"
OUT_SQL = Path(__file__).resolve().parents[1] / "supabase" / "gyms_seed.sql"

REQUEST_TIMEOUT = 60  # seconds per mirror attempt


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


def _coord(el: dict) -> tuple[float, float] | None:
    lat, lon = el.get("lat"), el.get("lon")
    if lat is None or lon is None:
        c = el.get("center") or {}
        lat, lon = c.get("lat"), c.get("lon")
    if lat is None or lon is None:
        return None
    return float(lat), float(lon)


def _display_name(label: str, tags: dict) -> str:
    """A human-friendly name: keep OSM's name if it has real detail, else append
    a locality so the picker shows 'PureGym Camden' not just 'PureGym'."""
    raw = " ".join((tags.get("name") or "").split())
    locality = next(
        (tags[k] for k in ("addr:suburb", "addr:neighbourhood", "addr:town",
                            "addr:city", "addr:hamlet", "addr:district",
                            "addr:street") if tags.get(k)),
        None,
    )
    if raw and raw.lower() not in (label.lower(), "the gym") and len(raw) > len(label) + 1:
        return raw
    return f"{label} {locality}" if locality else (raw or label)


def build_rows(deep: bool = False) -> list[dict]:
    rows: list[dict] = []
    failed: list[str] = []
    for label, regex in BRANDS.items():
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
    deduped = list(best.values())
    deduped.sort(key=lambda r: (r["brand"], r["name"]))
    return deduped


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
    args = ap.parse_args()

    rows = build_rows(deep=args.deep)
    write_sql(rows)
    if args.push:
        push_to_supabase(rows)


if __name__ == "__main__":
    main()
