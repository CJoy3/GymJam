"""Streak: number of consecutive completed weeks before the current week.

A week is "completed" iff it has at least one non-`unselected` day and every
non-`unselected` day is `checked-in`. We bound the lookback to the last 26 weeks.
"""
from app.core.supabase_client import get_supabase
from app.core.time_utils import current_week_start

LOOKBACK_WEEKS = 26


def compute_and_store_streak(user_id: str) -> int:
    sb = get_supabase()
    cur = current_week_start().isoformat()
    plans = (
        sb.table("weekly_plans")
        .select("week_start, plan_days(state)")
        .eq("user_id", user_id)
        .lt("week_start", cur)
        .order("week_start", desc=True)
        .limit(LOOKBACK_WEEKS)
        .execute()
    ).data or []

    streak = 0
    for p in plans:
        days = p.get("plan_days") or []
        # 'rescheduled' days were excused (unforeseen circumstances)-they neither
        # count as a pledge to fulfil nor break the streak.
        pledged_days = [d for d in days if d["state"] not in ("unselected", "rescheduled")]
        if not pledged_days:
            break
        if all(d["state"] == "checked-in" for d in pledged_days):
            streak += 1
        else:
            break

    sb.table("users").update({"streak": streak}).eq("id", user_id).execute()
    return streak
