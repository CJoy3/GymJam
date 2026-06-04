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


def _joined_in_week(joined_week_raw: Any, week_start: date) -> bool:
    """Whether a membership began during `week_start` (dev-clock week). Used to
    treat a mid-week joiner's current week as no-stakes practice."""
    if not joined_week_raw:
        return False
    try:
        return date.fromisoformat(str(joined_week_raw)[:10]) == week_start
    except (ValueError, TypeError):
        return False


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
        "required_pledges": 3,
        "stake_per_miss": 100,
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
    """The group's leader. Returns None if the group is leaderless."""
    sb = get_supabase()
    res = _safe_exec(sb.table("groups").select("leader_id").eq("id", group_id).limit(1))
    if not res or not res.data:
        return None
    return res.data[0].get("leader_id")


# Fixed Monday used as the rotation epoch. Rotating by whole weeks from a fixed
# anchor makes the setter for any week deterministic and independent of when the
# group was created — and it advances by exactly one member each time the
# (dev-clock) week moves forward.
_ROTATION_EPOCH = date(2024, 1, 1)  # a Monday


def _ordered_member_ids(group_id: str) -> list[str]:
    """Active members of a group in join order (oldest first)."""
    sb = get_supabase()
    res = _safe_exec(
        sb.table("group_memberships")
        .select("user_id, joined_at")
        .eq("group_id", group_id)
        .order("joined_at", desc=False)
    )
    rows = (res.data if res else None) or []
    return [r["user_id"] for r in rows]


def rotational_setter_id(group_id: str, week_start: date) -> str | None:
    """The member whose turn it is to set the pot rules for `week_start`.

    The role rotates through the group's members (join order) one step per week,
    so a different member is responsible each week and pressing the dev "next
    week" button advances the rotation. Returns None for an empty/unknown group.
    """
    ids = _ordered_member_ids(group_id)
    if not ids:
        return None
    week_index = (week_start - _ROTATION_EPOCH).days // 7
    return ids[week_index % len(ids)]


def _sync_group_rule_setter(group_id: str, setter_id: str | None) -> None:
    """Best-effort mirror of the upcoming week's rule setter onto the group row,
    so the value is queryable directly (AC: schema tracks the current setter)."""
    if not setter_id:
        return
    sb = get_supabase()
    _safe_exec(
        sb.table("groups")
        .update({"current_rule_setter_id": setter_id})
        .eq("id", group_id)
    )


def _group_defaults(group_id: str) -> dict:
    """Return the leader's baseline pot rules stored on the group itself.

    These are the source-of-truth values written at group creation. The
    `pot_conditions` table can override them per-week, but if its writes fail
    (RLS, missing column, anon-key deployment, etc.) we still serve the right
    numbers from here. Falls back to (3, 100) only when even the columns are
    missing on an old schema.
    """
    sb = get_supabase()
    res = _safe_exec(
        sb.table("groups")
        .select("leader_id, default_required_pledges, default_stake_per_miss")
        .eq("id", group_id)
        .limit(1)
    )
    if not res or not res.data:
        return {"leader_id": None, "required_pledges": 3, "stake_per_miss": 100}
    row = res.data[0]
    return {
        "leader_id": row.get("leader_id"),
        "required_pledges": row.get("default_required_pledges") or 3,
        "stake_per_miss": row.get("default_stake_per_miss")
            if row.get("default_stake_per_miss") is not None else 100,
    }


def _ensure_conditions(group_id: str, week_start: date) -> dict:
    """Read pot_conditions for this week, falling back to the group's stored
    defaults if no per-week row exists or the table is unwritable.

    The group's `default_required_pledges` / `default_stake_per_miss` are
    source-of-truth — they're written atomically with the group itself, so
    they survive even if `pot_conditions` inserts silently fail.
    """
    sb = get_supabase()
    defaults = _group_defaults(group_id)
    # The setter rotates weekly through the membership (falling back to the
    # leader only if the group somehow has no members).
    setter = rotational_setter_id(group_id, week_start) or defaults["leader_id"]

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
        if setter and row.get("setter_user_id") != setter:
            _safe_exec(
                sb.table("pot_conditions")
                .update({"setter_user_id": setter})
                .eq("group_id", group_id)
                .eq("week_start", week_start.isoformat())
            )
            row["setter_user_id"] = setter
        return row

    payload = {
        "group_id": group_id,
        "week_start": week_start.isoformat(),
        "setter_user_id": setter,
        "required_pledges": defaults["required_pledges"],
        "stake_per_miss": defaults["stake_per_miss"],
        "is_finalized": False,
        "is_practice": False,
    }
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
    # Last resort: serve the group's defaults synthesized in-memory. Even if
    # pot_conditions is completely unwritable, the leader's chosen values
    # still flow through to the client.
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
) -> dict:
    """Persist initial pot conditions for a group's week.

    Called by group creation to lock in the leader's chosen rules. Uses UPSERT so
    the row is created on first call and overwritten on subsequent ones — the
    leader's values always win. Raises on DB failure (not swallowed) so a broken
    seed surfaces immediately at group-creation time instead of being silently
    replaced by defaults the next time the pot is read.
    """
    sb = get_supabase()
    payload = {
        "group_id": group_id,
        "week_start": week_start.isoformat(),
        "setter_user_id": setter_user_id,
        "required_pledges": required_pledges,
        "stake_per_miss": stake_per_miss,
        "is_finalized": is_finalized,
        "is_practice": is_practice,
        "updated_at": _utc_now_iso(),
    }

    def _try(p: dict) -> dict | None:
        try:
            res = sb.table("pot_conditions").upsert(p, on_conflict="group_id,week_start").execute()
            if res and res.data:
                return res.data[0]
        except Exception:
            return None
        return None

    row = _try(payload)
    if row is not None:
        return row

    # Older deployments may be missing the `is_practice` column — retry without it.
    fallback = {k: v for k, v in payload.items() if k != "is_practice"}
    row = _try(fallback)
    if row is not None:
        return row

    # As a last resort, surface the actual DB error so we don't silently corrupt
    # the group with default values on the next read.
    try:
        res = (
            sb.table("pot_conditions")
            .upsert(fallback, on_conflict="group_id,week_start")
            .execute()
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500,
            detail=f"Failed to seed pot conditions for {week_start}: {exc}",
        )
    if res and res.data:
        return res.data[0]
    raise HTTPException(
        status_code=500,
        detail=f"Pot conditions for {week_start} did not persist",
    )


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
    # Authorization rotates weekly: only the member whose turn it is to set the
    # rules for this week may change them.
    setter = rotational_setter_id(group_id, week_start)
    if setter and setter != user_id:
        raise HTTPException(
            status_code=403,
            detail="Only this week's rule setter can edit the pot rules",
        )

    cond = _ensure_conditions(group_id, week_start)
    if cond.get("is_finalized"):
        raise HTTPException(status_code=409, detail="Pot conditions are already finalized")

    sb = get_supabase()

    # 1) Persist on the group itself — this is the source of truth and reliably
    # works (we just used the same table to create the group). Future weeks
    # automatically pick up the new baseline.
    try:
        sb.table("groups").update({
            "default_required_pledges": required_pledges,
            "default_stake_per_miss": stake_per_miss,
        }).eq("id", group_id).execute()
    except Exception:
        # Column may be missing on an old schema — non-fatal; pot_conditions
        # below will still take effect for this week.
        pass

    # 2) Best-effort per-week override in pot_conditions for record-keeping and
    # in case a leader wants per-week variation later. If this write fails for
    # any reason, the group-level defaults above still drive the response.
    payload = {
        "group_id": group_id,
        "week_start": week_start.isoformat(),
        "setter_user_id": setter or cond.get("setter_user_id"),
        "required_pledges": required_pledges,
        "stake_per_miss": stake_per_miss,
        "updated_at": _utc_now_iso(),
    }
    _safe_exec(
        sb.table("pot_conditions")
        .upsert(payload, on_conflict="group_id,week_start")
    )

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
    required = cond.get("required_pledges", 3)
    stake = cond.get("stake_per_miss", 100)
    is_practice = bool(cond.get("is_practice"))

    sb = get_supabase()

    membership_res = _safe_exec(
        sb.table("group_memberships")
        # `*` (not an explicit column list) so an un-migrated DB missing
        # joined_week_start still returns members instead of erroring out.
        .select("*, users(display_name)")
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

    setter_id = rotational_setter_id(group_id, week_start) or cond.get("setter_user_id") or _leader_id(group_id)
    setter_name = None
    if setter_id:
        for m in memberships:
            if m["user_id"] == setter_id:
                setter_name = (m.get("users") or {}).get("display_name") or "Anonymous"
                break
    # Mirror the upcoming week's setter onto the group row so it's queryable.
    if week == "next":
        _sync_group_rule_setter(group_id, setter_id)

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

        # Mid-week joiners missed this week's lock, so their current-week pledges
        # are practice — no stakes on the line and nothing added to the pot.
        member_is_midweek_practice = (
            not is_practice
            and week_start == current_week_start()
            and _joined_in_week(m.get("joined_week_start"), week_start)
        )
        if member_is_midweek_practice:
            elo_at_risk = 0
            elo_lost = 0

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
