from collections import defaultdict

from fastapi import APIRouter

from app.core.supabase_client import get_supabase
from app.core.time_utils import current_day_of_week, current_week_start
from app.schemas.gym import Gym, GymMapPoint

router = APIRouter()


@router.get("", response_model=list[Gym])
def list_gyms() -> list[dict]:
    sb = get_supabase()
    res = sb.table("gyms").select("*").order("name", desc=False).execute()
    return res.data or []


@router.get("/map", response_model=list[GymMapPoint])
def gyms_map() -> list[dict]:
    """Geocoded gyms enriched with crowd stats: member_count (users whose home
    gym is this), avg_elo (drives the 'turf' size), and active_today (checked in
    today). Cheap in-process aggregation — fine at this scale."""
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

    out: list[dict] = []
    for g in gyms:
        if g.get("latitude") is None or g.get("longitude") is None:
            continue  # only mappable gyms
        gid = g["id"]
        c = count.get(gid, 0)
        out.append({
            "id": gid,
            "name": g["name"],
            "latitude": g["latitude"],
            "longitude": g["longitude"],
            "member_count": c,
            "avg_elo": round(elo_total[gid] / c) if c else 0,
            "active_today": active.get(gid, 0),
        })
    return out
