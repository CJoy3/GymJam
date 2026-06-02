from datetime import date

from app.core.supabase_client import get_supabase
from app.core.time_utils import current_week_start, next_week_start


def group_pot(group_id: str, week: str = "current") -> dict:
    """Sum of stake_elo across all member plans for the requested week."""
    week_start: date = next_week_start() if week == "next" else current_week_start()
    sb = get_supabase()
    res = (
        sb.table("weekly_plans")
        .select("stake_elo, user_id")
        .eq("group_id", group_id)
        .eq("week_start", week_start.isoformat())
        .execute()
    )
    rows = res.data or []
    total = sum(r["stake_elo"] for r in rows)
    return {
        "group_id": group_id,
        "week_start": week_start.isoformat(),
        "total_elo": total,
        "contributor_count": len(rows),
    }
