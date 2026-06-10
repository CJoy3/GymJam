from collections import defaultdict

from fastapi import APIRouter, HTTPException, Query

from app.core.supabase_client import get_supabase
from app.core.time_utils import current_day_of_week, current_week_start
from app.schemas.gym import Gym, GymLeaderboardEntry, GymMapPoint, GymResolve
from app.services.gym_data import LONDON_BBOX, UK_BBOX, fetch_gyms

router = APIRouter()

# Most gyms we'll return for one viewport. The client only renders the nearest
# ~50, and a 5-mile box rarely holds more of these chains, so this is headroom.
MAP_GYM_LIMIT = 150


@router.get("", response_model=list[Gym])
def list_gyms() -> list[dict]:
    sb = get_supabase()
    res = sb.table("gyms").select("*").order("name", desc=False).execute()
    return res.data or []


@router.post("/resolve", response_model=Gym)
def resolve_gym(payload: GymResolve) -> dict:
    """Turn a gym picked from the live map (OSM) into a real `gyms` row so it can
    be used as a home gym. Idempotent: returns the existing row for this osm_id if
    we've already created it, otherwise inserts a new one."""
    sb = get_supabase()
    existing = (
        sb.table("gyms").select("*").eq("osm_id", payload.osm_id).limit(1).execute()
    ).data or []
    if existing:
        return existing[0]
    inserted = sb.table("gyms").insert({
        "name": payload.name,
        "osm_id": payload.osm_id,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
    }).execute()
    if inserted.data:
        return inserted.data[0]
    # Lost a race (unique-index conflict) — re-read by osm_id.
    again = (
        sb.table("gyms").select("*").eq("osm_id", payload.osm_id).limit(1).execute()
    ).data or []
    if again:
        return again[0]
    raise HTTPException(status_code=500, detail="Could not resolve gym")


@router.get("/leaderboard", response_model=list[GymLeaderboardEntry])
def gyms_leaderboard() -> list[dict]:
    """Gyms ranked by their members' ELO — exactly like the group leaderboard,
    but membership is each user's **home gym** (`users.gym_id`). Returns total and
    average ELO so the client can sort either way; only gyms with members appear."""
    count, elo_total, active = _crowd_stats()
    if not count:
        return []
    # Only load the gyms that actually have members (bounded by the user base),
    # never the whole table — PostgREST caps selects at ~1000 rows and the gyms
    # table now holds the full UK chain list.
    sb = get_supabase()
    gyms = (sb.table("gyms").select("id, name").in_("id", list(count.keys())).execute()).data or []
    entries = [
        {"id": g["id"], "name": g["name"], **_stats_for(g["id"], count, elo_total, active)}
        for g in gyms
    ]
    entries = [
        {"id": e["id"], "name": e["name"], "member_count": e["member_count"],
         "total_elo": e["total_elo"], "avg_elo": e["avg_elo"]}
        for e in entries if e["member_count"] > 0
    ]
    entries.sort(key=lambda e: e["total_elo"], reverse=True)
    return entries


def _crowd_stats() -> tuple[dict[str, int], dict[str, int], dict[str, int]]:
    """Per-gym crowd counters — (member_count, elo_total, active_today) keyed by
    gym id — computed from users + this week's plans. Bounded by the number of
    users (not gyms), so it's safe against the gyms table's size."""
    sb = get_supabase()
    users = (sb.table("users").select("id, gym_id, elo").execute()).data or []

    count: dict[str, int] = defaultdict(int)
    elo_total: dict[str, int] = defaultdict(int)
    gym_of_user: dict[str, str] = {}
    for u in users:
        g = u.get("gym_id")
        if g:
            count[g] += 1
            elo_total[g] += int(u.get("elo") or 0)
            gym_of_user[u["id"]] = g

    active: dict[str, int] = defaultdict(int)
    today = current_day_of_week()
    plans = (
        sb.table("weekly_plans")
        .select("user_id, plan_days(day_of_week, state)")
        .eq("week_start", current_week_start().isoformat())
        .execute()
    ).data or []
    for p in plans:
        g = gym_of_user.get(p["user_id"])
        if not g:
            continue
        for d in (p.get("plan_days") or []):
            if d["day_of_week"] == today and d["state"] == "checked-in":
                active[g] += 1
                break
    return count, elo_total, active


def _stats_for(gid: str, count: dict, elo_total: dict, active: dict) -> dict:
    c = count.get(gid, 0)
    return {
        "member_count": c,
        "avg_elo": round(elo_total[gid] / c) if c else 0,
        "total_elo": elo_total.get(gid, 0),
        "active_today": active.get(gid, 0),
    }


@router.get("/map", response_model=list[GymMapPoint])
def gyms_map(
    south: float | None = Query(None),
    west: float | None = Query(None),
    north: float | None = Query(None),
    east: float | None = Query(None),
) -> list[dict]:
    """Gyms for the requested viewport, read straight from our `gyms` table —
    which is seeded with every UK location of the major chains from OpenStreetMap
    (see scripts/fetch_uk_gyms.py). Serving stored rows (instead of querying OSM
    live on every request) makes the map fast and reliable. Pass
    `south/west/north/east` to search an area; omit for the default London view.
    Each gym carries our own crowd stats (`avg_elo` drives the turf size). If the
    table holds no gyms in the box (e.g. before the seed is loaded) we fall back
    to a one-off live OSM fetch so the map still works."""
    # Viewport: requested box or the default London one, clamped to the UK so a
    # bad/huge request can't scan the planet.
    s, w, n, e = (south, west, north, east) if None not in (south, west, north, east) else LONDON_BBOX
    s, n = min(s, n), max(s, n)
    w, e = min(w, e), max(w, e)
    S, W, N, E = UK_BBOX
    s, n = max(s, S), min(n, N)
    w, e = max(w, W), min(e, E)
    cy, cx = (s + n) / 2, (w + e) / 2

    # Fetch only the gyms inside the viewport, in the DB. The lat/lng range
    # filters also drop NULL-coord rows (NULL fails a range test), and the index
    # (gyms_lat_lng_idx) keeps this fast even with the whole UK in the table.
    sb = get_supabase()
    rows = (
        sb.table("gyms")
        .select("id, name, brand, latitude, longitude")
        .gte("latitude", s).lte("latitude", n)
        .gte("longitude", w).lte("longitude", e)
        .limit(800)
        .execute()
    ).data or []

    if rows:
        count, elo_total, active = _crowd_stats()
        # Nearest-first to the viewport centre, then capped — a dense area returns
        # the closest gyms rather than an arbitrary slice.
        rows.sort(key=lambda g: abs(g["latitude"] - cy) + abs(g["longitude"] - cx))
        out: list[dict] = []
        for g in rows[:MAP_GYM_LIMIT]:
            st = _stats_for(g["id"], count, elo_total, active)
            out.append({
                "id": g["id"],
                "name": g["name"],
                "brand": g.get("brand"),
                "latitude": g["latitude"],
                "longitude": g["longitude"],
                "member_count": st["member_count"],
                "avg_elo": st["avg_elo"],
                "active_today": st["active_today"],
            })
        return out

    # Pre-seed safety net: nothing stored in this box yet — fetch live from OSM.
    try:
        osm = fetch_gyms((s, w, n, e))
    except Exception:
        osm = None
    return [
        {
            "id": g["osm_id"],
            "name": g["name"],
            "brand": None,
            "latitude": g["latitude"],
            "longitude": g["longitude"],
            "member_count": 0,
            "avg_elo": 0,
            "active_today": 0,
        }
        for g in (osm or [])
    ]
