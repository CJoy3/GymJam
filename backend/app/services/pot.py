"""Weekly pot — conditions, rotation, and member breakdown."""
from datetime import date, datetime, timezone

from fastapi import HTTPException

from app.core.supabase_client import get_supabase
from app.core.time_utils import current_week_start, monday_of, next_week_start


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _resolve_week(week: str) -> date:
    return next_week_start() if week == "next" else current_week_start()


def _setter_for_week(group_id: str, week_start: date) -> str | None:
    """Members ordered by joined_at; (weeks since group creation) % len picks the setter."""
    sb = get_supabase()
    members = (
        sb.table("group_memberships")
        .select("user_id, joined_at")
        .eq("group_id", group_id)
        .order("joined_at", desc=False)
        .execute()
    ).data or []
    if not members:
        return None

    grp = (
        sb.table("groups").select("created_at").eq("id", group_id).limit(1).execute()
    ).data
    if not grp:
        return None
    grp_created = datetime.fromisoformat(grp[0]["created_at"].replace("Z", "+00:00")).date()
    grp_first_monday = monday_of(grp_created)
    weeks_elapsed = max(0, (week_start - grp_first_monday).days // 7)
    return members[weeks_elapsed % len(members)]["user_id"]


def _ensure_conditions(group_id: str, week_start: date) -> dict:
    """Read pot_conditions for this week, auto-creating with defaults if missing."""
    sb = get_supabase()
    res = (
        sb.table("pot_conditions")
        .select("*")
        .eq("group_id", group_id)
        .eq("week_start", week_start.isoformat())
        .limit(1)
        .execute()
    )
    if res.data:
        return res.data[0]

    setter = _setter_for_week(group_id, week_start)
    inserted = (
        sb.table("pot_conditions")
        .insert({
            "group_id": group_id,
            "week_start": week_start.isoformat(),
            "setter_user_id": setter,
            "required_pledges": 3,
            "stake_per_miss": 100,
            "is_finalized": False,
        })
        .execute()
    )
    if not inserted.data:
        raise HTTPException(status_code=500, detail="Failed to create pot conditions")
    return inserted.data[0]


def update_conditions(
    group_id: str,
    week: str,
    user_id: str,
    required_pledges: int,
    stake_per_miss: int,
) -> dict:
    if not 1 <= required_pledges <= 7:
        raise HTTPException(status_code=400, detail="required_pledges must be 1..7")
    if stake_per_miss < 0:
        raise HTTPException(status_code=400, detail="stake_per_miss must be >= 0")

    week_start = _resolve_week(week)
    cond = _ensure_conditions(group_id, week_start)
    if cond["setter_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Only this week's pot setter can edit")
    if cond["is_finalized"]:
        raise HTTPException(status_code=409, detail="Pot conditions are already finalized")

    sb = get_supabase()
    res = (
        sb.table("pot_conditions")
        .update({
            "required_pledges": required_pledges,
            "stake_per_miss": stake_per_miss,
            "updated_at": _utc_now_iso(),
        })
        .eq("group_id", group_id)
        .eq("week_start", week_start.isoformat())
        .execute()
    )
    return res.data[0] if res.data else cond


def finalize_conditions(group_id: str, week_start: date) -> None:
    """Idempotently lock conditions for a week (called when setter locks their plan)."""
    sb = get_supabase()
    sb.table("pot_conditions").update({"is_finalized": True}).eq(
        "group_id", group_id
    ).eq("week_start", week_start.isoformat()).execute()


def get_conditions(group_id: str, week: str = "current") -> dict:
    week_start = _resolve_week(week)
    return _ensure_conditions(group_id, week_start)


def pot_detail(group_id: str, week: str = "current") -> dict:
    """Full breakdown: conditions + per-member pledge state + pot total."""
    week_start = _resolve_week(week)
    cond = _ensure_conditions(group_id, week_start)
    required = cond["required_pledges"]
    stake = cond["stake_per_miss"]

    sb = get_supabase()

    # Members with display names.
    memberships = (
        sb.table("group_memberships")
        .select("user_id, role, joined_at, users(display_name)")
        .eq("group_id", group_id)
        .order("joined_at", desc=False)
        .execute()
    ).data or []
    user_ids = [m["user_id"] for m in memberships]

    # All plans for this week for those members (with embedded day states).
    plans = (
        sb.table("weekly_plans")
        .select("user_id, plan_days(state)")
        .eq("group_id", group_id)
        .eq("week_start", week_start.isoformat())
        .in_("user_id", user_ids if user_ids else [""])
        .execute()
    ).data or []
    plan_by_user: dict[str, list[dict]] = {p["user_id"]: (p.get("plan_days") or []) for p in plans}

    # Setter name for display.
    setter_name = None
    setter_id = cond["setter_user_id"]
    if setter_id:
        for m in memberships:
            if m["user_id"] == setter_id:
                setter_name = (m.get("users") or {}).get("display_name", "Anonymous")
                break

    member_rows: list[dict] = []
    pot_total = 0
    for m in memberships:
        days = plan_by_user.get(m["user_id"], [])
        pledged_count = sum(
            1 for d in days if d["state"] in ("planned", "locked", "checked-in", "missed")
        )
        completed_count = sum(1 for d in days if d["state"] == "checked-in")
        missed_count = sum(1 for d in days if d["state"] == "missed")
        # Below-quota days count as auto-misses against the required total.
        shortfall = max(0, required - pledged_count)
        effective_missed = missed_count + shortfall
        elo_at_risk = required * stake
        elo_lost = effective_missed * stake
        pot_total += elo_lost

        member_rows.append({
            "user_id": m["user_id"],
            "display_name": (m.get("users") or {}).get("display_name", "Anonymous"),
            "role": m["role"],
            "pledged_count": pledged_count,
            "completed_count": completed_count,
            "missed_count": effective_missed,
            "elo_at_risk": elo_at_risk,
            "elo_lost_so_far": elo_lost,
            "is_setter": m["user_id"] == setter_id,
            "is_on_track": effective_missed == 0,
        })

    return {
        "group_id": group_id,
        "week_start": week_start.isoformat(),
        "setter_user_id": setter_id,
        "setter_display_name": setter_name,
        "required_pledges": required,
        "stake_per_miss": stake,
        "is_finalized": cond["is_finalized"],
        "total_pot_elo": pot_total,
        "members": member_rows,
    }
