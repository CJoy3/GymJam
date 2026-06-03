"""Weekly pot — conditions, rotation, and member breakdown.

All Supabase calls are wrapped defensively: the endpoint must never 500 just
because the optional `pot_conditions` table is missing or a query hiccups.
A request that can't read/write conditions falls back to sensible defaults
(3 required pledges, 100 ELO per miss) so the rest of the pledging flow
keeps working.
"""
from datetime import date, datetime, timezone
from typing import Any

from fastapi import HTTPException

from app.core.supabase_client import get_supabase
from app.core.time_utils import current_week_start, monday_of, next_week_start


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _resolve_week(week: str) -> date:
    return next_week_start() if week == "next" else current_week_start()


def _parse_iso(ts: str) -> datetime | None:
    try:
        if ts.endswith("Z"):
            ts = ts[:-1] + "+00:00"
        return datetime.fromisoformat(ts)
    except (ValueError, AttributeError):
        return None


def _safe_exec(query: Any) -> Any | None:
    """Execute a Supabase query; swallow exceptions and return None."""
    try:
        return query.execute()
    except Exception:
        return None


def _defaults_for(group_id: str, week_start: date, setter: str | None = None) -> dict:
    return {
        "group_id": group_id,
        "week_start": week_start.isoformat(),
        "setter_user_id": setter,
        "required_pledges": 3,
        "stake_per_miss": 100,
        "is_finalized": False,
    }


def _setter_for_week(group_id: str, week_start: date) -> str | None:
    """Members ordered by joined_at; (weeks since group creation) % len picks the setter."""
    sb = get_supabase()
    res = _safe_exec(
        sb.table("group_memberships")
        .select("user_id, joined_at")
        .eq("group_id", group_id)
        .order("joined_at", desc=False)
    )
    members = (res.data if res else None) or []
    if not members:
        return None

    grp_res = _safe_exec(sb.table("groups").select("created_at").eq("id", group_id).limit(1))
    grp_data = (grp_res.data if grp_res else None) or []
    if not grp_data:
        return members[0]["user_id"]

    parsed = _parse_iso(grp_data[0].get("created_at", ""))
    grp_first_monday = monday_of(parsed.date()) if parsed else week_start
    weeks_elapsed = max(0, (week_start - grp_first_monday).days // 7)
    return members[weeks_elapsed % len(members)]["user_id"]


def _ensure_conditions(group_id: str, week_start: date) -> dict:
    """Read pot_conditions for this week, auto-creating with defaults if missing.
    Returns synthesized defaults if the table doesn't exist or anything goes wrong."""
    sb = get_supabase()
    res = _safe_exec(
        sb.table("pot_conditions")
        .select("*")
        .eq("group_id", group_id)
        .eq("week_start", week_start.isoformat())
        .limit(1)
    )
    rows = (res.data if res else None) or []
    if rows:
        return rows[0]

    setter = _setter_for_week(group_id, week_start)
    payload = _defaults_for(group_id, week_start, setter)
    inserted = _safe_exec(sb.table("pot_conditions").insert(payload))
    if inserted and inserted.data:
        return inserted.data[0]

    # Race: someone else may have inserted between our select and insert.
    res = _safe_exec(
        sb.table("pot_conditions")
        .select("*")
        .eq("group_id", group_id)
        .eq("week_start", week_start.isoformat())
        .limit(1)
    )
    rows = (res.data if res else None) or []
    if rows:
        return rows[0]

    return payload


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
    if cond.get("setter_user_id") and cond["setter_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Only this week's pot setter can edit")
    if cond.get("is_finalized"):
        raise HTTPException(status_code=409, detail="Pot conditions are already finalized")

    sb = get_supabase()
    res = _safe_exec(
        sb.table("pot_conditions")
        .update({
            "required_pledges": required_pledges,
            "stake_per_miss": stake_per_miss,
            "updated_at": _utc_now_iso(),
        })
        .eq("group_id", group_id)
        .eq("week_start", week_start.isoformat())
    )
    if res and res.data:
        return res.data[0]
    return {**cond, "required_pledges": required_pledges, "stake_per_miss": stake_per_miss}


def finalize_conditions(group_id: str, week_start: date) -> None:
    """Idempotently lock conditions for a week."""
    sb = get_supabase()
    _safe_exec(
        sb.table("pot_conditions")
        .update({"is_finalized": True})
        .eq("group_id", group_id)
        .eq("week_start", week_start.isoformat())
    )


def get_conditions(group_id: str, week: str = "current") -> dict:
    week_start = _resolve_week(week)
    return _ensure_conditions(group_id, week_start)


def pot_detail(group_id: str, week: str = "current") -> dict:
    """Full breakdown: conditions + per-member pledge state + pot total."""
    week_start = _resolve_week(week)
    cond = _ensure_conditions(group_id, week_start)
    required = cond.get("required_pledges", 3)
    stake = cond.get("stake_per_miss", 100)

    sb = get_supabase()

    membership_res = _safe_exec(
        sb.table("group_memberships")
        .select("user_id, role, joined_at, users(display_name)")
        .eq("group_id", group_id)
        .order("joined_at", desc=False)
    )
    memberships = (membership_res.data if membership_res else None) or []
    user_ids = [m["user_id"] for m in memberships]

    plan_by_user: dict[str, dict] = {}
    if user_ids:
        plans_res = _safe_exec(
            sb.table("weekly_plans")
            .select("user_id, is_locked, plan_days(state)")
            .eq("group_id", group_id)
            .eq("week_start", week_start.isoformat())
            .in_("user_id", user_ids)
        )
        plans = (plans_res.data if plans_res else None) or []
        plan_by_user = {p["user_id"]: p for p in plans}

    setter_id = cond.get("setter_user_id")
    setter_name = None
    if setter_id:
        for m in memberships:
            if m["user_id"] == setter_id:
                setter_name = (m.get("users") or {}).get("display_name") or "Anonymous"
                break

    member_rows: list[dict] = []
    pot_total = 0
    for m in memberships:
        plan = plan_by_user.get(m["user_id"])
        days = (plan or {}).get("plan_days") or []
        is_locked = bool(plan and plan.get("is_locked"))
        pledged_count = sum(
            1 for d in days if d["state"] in ("planned", "locked", "checked-in", "missed")
        )
        completed_count = sum(1 for d in days if d["state"] == "checked-in")
        missed_count = sum(1 for d in days if d["state"] == "missed")
        # Under-quota pledges only count as missed once the plan is locked.
        shortfall = max(0, required - pledged_count) if is_locked else 0
        effective_missed = missed_count + shortfall
        elo_at_risk = required * stake
        elo_lost = effective_missed * stake
        pot_total += elo_lost

        member_rows.append({
            "user_id": m["user_id"],
            "display_name": (m.get("users") or {}).get("display_name") or "Anonymous",
            "role": m.get("role", "member"),
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
        "is_finalized": bool(cond.get("is_finalized")),
        "total_pot_elo": pot_total,
        "members": member_rows,
    }
