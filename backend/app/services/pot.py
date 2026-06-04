"""Weekly pot — conditions and member breakdown.

Conditions for each week are set by the group's leader (who is always the "setter").
Pledging is optional: members who pledge 0 days are excluded from the pot entirely.
All Supabase calls are wrapped in `_safe_exec` so the endpoint never 500s; it
falls back to synthesized defaults when the conditions table is unavailable.
"""
from datetime import date, datetime, timezone
from typing import Any

from fastapi import HTTPException

from app.core.supabase_client import get_supabase
from app.core.time_utils import current_week_start, next_week_start


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _resolve_week(week: str) -> date:
    return next_week_start() if week == "next" else current_week_start()


def _safe_exec(query: Any) -> Any | None:
    try:
        return query.execute()
    except Exception:
        return None


def _defaults_for(group_id: str, week_start: date, setter: str | None = None) -> dict:
    return {
        "group_id": group_id,
        "week_start": week_start.isoformat(),
        "setter_user_id": setter,
        "required_pledges": 1,
        "stake_per_miss": 0,
        "is_finalized": False,
        "is_practice": False,
    }


def _insert_conditions(payload: dict) -> Any | None:
    """Insert a pot_conditions row, retrying without `is_practice` so older
    schemas (missing that column) still persist the row instead of silently
    falling back to synthesized defaults."""
    sb = get_supabase()
    inserted = _safe_exec(sb.table("pot_conditions").insert(payload))
    if inserted and inserted.data:
        return inserted
    if "is_practice" in payload:
        fallback = {k: v for k, v in payload.items() if k != "is_practice"}
        return _safe_exec(sb.table("pot_conditions").insert(fallback))
    return inserted


def _leader_id(group_id: str) -> str | None:
    """The leader IS the setter — no rotation. Returns None if the group is leaderless."""
    sb = get_supabase()
    res = _safe_exec(sb.table("groups").select("leader_id").eq("id", group_id).limit(1))
    if not res or not res.data:
        return None
    return res.data[0].get("leader_id")


def _ensure_conditions(group_id: str, week_start: date) -> dict:
    """Read pot_conditions for this week, auto-creating with defaults if missing.
    The stored `setter_user_id` is kept in sync with the group's current leader."""
    sb = get_supabase()
    leader = _leader_id(group_id)

    res = _safe_exec(
        sb.table("pot_conditions")
        .select("*")
        .eq("group_id", group_id)
        .eq("week_start", week_start.isoformat())
        .limit(1)
    )
    rows = (res.data if res else None) or []
    if rows:
        row = rows[0]
        # Keep setter aligned with whoever currently leads (handles leader transfers).
        if leader and row.get("setter_user_id") != leader:
            _safe_exec(
                sb.table("pot_conditions")
                .update({"setter_user_id": leader})
                .eq("group_id", group_id)
                .eq("week_start", week_start.isoformat())
            )
            row["setter_user_id"] = leader
        return row

    payload = _defaults_for(group_id, week_start, leader)
    inserted = _insert_conditions(payload)
    if inserted and inserted.data:
        return inserted.data[0]

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


def seed_conditions(
    group_id: str,
    week_start: date,
    *,
    setter_user_id: str,
    required_pledges: int,
    stake_per_miss: int,
    is_finalized: bool = False,
    is_practice: bool = False,
) -> None:
    """Called by group creation to seed initial pot conditions for a week.
    Idempotent — won't overwrite an existing row."""
    sb = get_supabase()
    existing = _safe_exec(
        sb.table("pot_conditions")
        .select("group_id")
        .eq("group_id", group_id)
        .eq("week_start", week_start.isoformat())
        .limit(1)
    )
    if existing and existing.data:
        return
    _insert_conditions({
        "group_id": group_id,
        "week_start": week_start.isoformat(),
        "setter_user_id": setter_user_id,
        "required_pledges": required_pledges,
        "stake_per_miss": stake_per_miss,
        "is_finalized": is_finalized,
        "is_practice": is_practice,
    })


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

    leader = _leader_id(group_id)
    if leader and leader != user_id:
        raise HTTPException(status_code=403, detail="Only the group leader can edit pot rules")

    week_start = _resolve_week(week)
    cond = _ensure_conditions(group_id, week_start)
    if cond.get("is_finalized"):
        raise HTTPException(status_code=409, detail="Pot conditions are already finalized")

    sb = get_supabase()
    # Upsert so the write succeeds whether or not the row already exists, in one
    # atomic statement. Errors are surfaced (not swallowed) so a failed save is
    # visible instead of silently resetting to defaults on the next read.
    payload = {
        "group_id": group_id,
        "week_start": week_start.isoformat(),
        "setter_user_id": leader or cond.get("setter_user_id"),
        "required_pledges": required_pledges,
        "stake_per_miss": stake_per_miss,
        "updated_at": _utc_now_iso(),
    }
    try:
        res = (
            sb.table("pot_conditions")
            .upsert(payload, on_conflict="group_id,week_start")
            .execute()
        )
    except Exception as exc:  # noqa: BLE001 — surface the real DB error to the client
        raise HTTPException(status_code=500, detail=f"Failed to save pot conditions: {exc}")

    if res and res.data:
        return res.data[0]
    return {**cond, "required_pledges": required_pledges, "stake_per_miss": stake_per_miss}


def finalize_conditions(group_id: str, week_start: date) -> None:
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
    """Full breakdown: conditions + per-member pledge state.
    Members who haven't pledged any days are skipped (opt-out)."""
    week_start = _resolve_week(week)
    cond = _ensure_conditions(group_id, week_start)
    required = cond.get("required_pledges", 1)
    stake = cond.get("stake_per_miss", 0)
    is_practice = bool(cond.get("is_practice"))

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

    setter_id = cond.get("setter_user_id") or _leader_id(group_id)
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
        pledged_count = sum(
            1 for d in days if d["state"] in ("planned", "locked", "checked-in", "missed")
        )
        # Pledging is OPTIONAL — non-pledgers aren't in the pot breakdown.
        if pledged_count == 0:
            continue

        completed_count = sum(1 for d in days if d["state"] == "checked-in")
        missed_count = sum(1 for d in days if d["state"] == "missed")
        elo_at_risk = pledged_count * stake
        elo_lost = missed_count * stake
        pot_total += elo_lost

        member_rows.append({
            "user_id": m["user_id"],
            "display_name": (m.get("users") or {}).get("display_name") or "Anonymous",
            "role": m.get("role", "member"),
            "pledged_count": pledged_count,
            "completed_count": completed_count,
            "missed_count": missed_count,
            "elo_at_risk": elo_at_risk,
            "elo_lost_so_far": elo_lost,
            "is_setter": m["user_id"] == setter_id,
            "is_on_track": missed_count == 0,
        })

    return {
        "group_id": group_id,
        "week_start": week_start.isoformat(),
        "setter_user_id": setter_id,
        "setter_display_name": setter_name,
        "required_pledges": required,
        "stake_per_miss": stake,
        "is_finalized": bool(cond.get("is_finalized")),
        "is_practice": is_practice,
        "total_pot_elo": pot_total,
        "members": member_rows,
    }
