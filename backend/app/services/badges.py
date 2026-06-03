"""Derive badge unlock flags from real user stats."""
from datetime import time

from app.core.supabase_client import get_supabase
from app.core.time_utils import TZ
from app.services import users as users_svc

EARLY_HOUR_CUTOFF = time(8, 0)


def compute(user_id: str) -> dict:
    sb = get_supabase()
    user = users_svc.get_by_id(user_id)

    # Pull every check-in for the user (one query). plan_days → weekly_plans (FK) → user.
    plans = (
        sb.table("weekly_plans")
        .select("id, plan_days(state, checked_in_at)")
        .eq("user_id", user_id)
        .execute()
    ).data or []

    check_ins: list[str] = []
    for p in plans:
        for d in (p.get("plan_days") or []):
            if d["state"] == "checked-in" and d.get("checked_in_at"):
                check_ins.append(d["checked_in_at"])

    leads_group = (
        sb.table("groups")
        .select("id", count="exact")
        .eq("leader_id", user_id)
        .limit(1)
        .execute()
    )
    has_leadership = bool(leads_group.data)

    return {
        "first_week": len(check_ins) > 0,
        "streak_master": user["streak"] >= 3,
        "early_bird": any(_is_early(c) for c in check_ins),
        "consistency_king": user["streak"] >= 8,
        "pot_winner": False,  # Pot payouts not implemented yet.
        "group_leader": has_leadership,
    }


def _is_early(iso_ts: str) -> bool:
    """checked_in_at is stored as UTC; compare against London local time."""
    from datetime import datetime
    try:
        dt = datetime.fromisoformat(iso_ts.replace("Z", "+00:00"))
    except ValueError:
        return False
    local = dt.astimezone(TZ).time()
    return local < EARLY_HOUR_CUTOFF
