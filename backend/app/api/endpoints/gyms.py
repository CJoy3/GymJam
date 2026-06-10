from collections import defaultdict

from fastapi import APIRouter, Query

from app.core.supabase_client import get_supabase
from app.core.time_utils import current_day_of_week, current_week_start
from app.schemas.gym import Gym, GymMapPoint
from app.services.gym_data import UK_BBOX, fetch_gyms

router = APIRouter()


@router.get("", response_model=list[Gym])
def list_gyms() -> list[dict]:
    sb = get_supabase()
    res = sb.table("gyms").select("*").order("name", desc=False).execute()
    return res.data or []


def _norm(name: str) -> str:
    return " ".join((name or "").lower().split())


def _our_gym_stats() -> tuple[dict[str, dict], dict[str, dict]]:
    """Per-gym crowd stats from our own data, keyed by both gym id and
    normalised gym name (so we can attach them to matching OSM gyms)."""
    sb = get_supabase()
    gyms = (sb.table("gyms").select("id, name, latitude, longitude").execute()).data or []
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

    def _stats(gid: str) -> dict:
        c = count.get(gid, 0)
        return {
            "member_count": c,
            "avg_elo": round(elo_total[gid] / c) if c else 0,
            "active_today": active.get(gid, 0),
        }

    by_id = {g["id"]: {**g, **_stats(g["id"])} for g in gyms}
    by_name = {_norm(g["name"]): _stats(g["id"]) for g in gyms}
    return by_id, by_name


@router.get("/map", response_model=list[GymMapPoint])
def gyms_map(
    south: float | None = Query(None),
    west: float | None = Query(None),
    north: float | None = Query(None),
    east: float | None = Query(None),
) -> list[dict]:
    """Gyms pulled **live from OpenStreetMap** (no hand-entered coords) for the
    requested viewport, clamped to the UK — so the map works anywhere in the
    country, not just London. Pass `south/west/north/east` to search a specific
    area; omit them for the default London view. Each gym is enriched with our
    own crowd stats where the name matches a gym our users train at (`avg_elo`
    drives the turf size). Falls back to our DB gyms if Overpass is unavailable."""
    by_id, by_name = _our_gym_stats()
    zero = {"member_count": 0, "avg_elo": 0, "active_today": 0}

    bbox = None
    if None not in (south, west, north, east):
        bbox = (south, west, north, east)

    try:
        osm = fetch_gyms(bbox)
    except Exception:
        osm = None

    if osm:
        return [
            {
                "id": g["osm_id"],
                "name": g["name"],
                "latitude": g["latitude"],
                "longitude": g["longitude"],
                **by_name.get(_norm(g["name"]), zero),
            }
            for g in osm
        ]

    # Fallback: our own gyms that have coords, clamped to the UK box.
    s, w, n, e = UK_BBOX
    out: list[dict] = []
    for g in by_id.values():
        lat, lon = g.get("latitude"), g.get("longitude")
        if lat is None or lon is None or not (s <= lat <= n and w <= lon <= e):
            continue
        out.append({
            "id": g["id"],
            "name": g["name"],
            "latitude": lat,
            "longitude": lon,
            "member_count": g["member_count"],
            "avg_elo": g["avg_elo"],
            "active_today": g["active_today"],
        })
    return out
