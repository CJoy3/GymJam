from datetime import date, datetime, timezone

from fastapi import HTTPException

from app.core.supabase_client import get_supabase
from app.core.time_utils import current_day_of_week, current_week_start, next_week_start
from app.services import groups as groups_svc
from app.services import pot as pot_svc
from app.services import realtime
from app.services import streak as streak_svc
from app.services import users as users_svc

ELO_PER_CHECKIN = 10
ELO_PER_PLANNED_DAY = 100  # stake formula


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _empty_days() -> list[dict]:
    return [{"day_of_week": dow, "state": "unselected"} for dow in range(7)]


def _ensure_plan(user_id: str, week_start: date) -> dict:
    """Return the plan row for (user, week_start), creating it (and 7 day rows) if missing."""
    sb = get_supabase()
    plan = (
        sb.table("weekly_plans")
        .select("*")
        .eq("user_id", user_id)
        .eq("week_start", week_start.isoformat())
        .limit(1)
        .execute()
    )
    if plan.data:
        return plan.data[0]

    membership = groups_svc.current_membership(user_id)
    inserted = (
        sb.table("weekly_plans")
        .insert({
            "user_id": user_id,
            "group_id": membership["group_id"] if membership else None,
            "week_start": week_start.isoformat(),
            "is_locked": False,
            "stake_elo": 0,
        })
        .execute()
    )
    if not inserted.data:
        raise HTTPException(status_code=500, detail="Failed to create weekly plan")
    plan_row = inserted.data[0]

    sb.table("plan_days").insert([
        {"plan_id": plan_row["id"], **d} for d in _empty_days()
    ]).execute()
    return plan_row


def _load_plan_with_days(plan_row: dict) -> dict:
    sb = get_supabase()
    days = (
        sb.table("plan_days")
        .select("day_of_week, state, checked_in_at")
        .eq("plan_id", plan_row["id"])
        .order("day_of_week", desc=False)
        .execute()
    ).data or []
    return {**plan_row, "days": days}


def _mark_missed_for_past_days(plan_row: dict) -> None:
    """For this-week's plan: any planned/locked day that has already passed
    (day_of_week < today) and was never checked in becomes 'missed'."""
    sb = get_supabase()
    today_dow = current_day_of_week()
    if today_dow <= 0:
        return  # Monday-nothing in the past
    sb.table("plan_days").update({"state": "missed"}).eq(
        "plan_id", plan_row["id"]
    ).lt("day_of_week", today_dow).in_("state", ["planned", "locked"]).execute()


def _is_practice_week(group_id: str | None, week: str) -> bool:
    if not group_id:
        return False
    try:
        return bool(pot_svc.get_conditions(group_id, week).get("is_practice"))
    except Exception:
        return False


def _joined_mid_current_week(user_id: str) -> bool:
    """True if the user joined their group during the current week-i.e. after
    the Sunday-midnight lock for this week. Such "mid-week joiners" missed the
    lock, so the current week is a no-stakes practice week for them individually,
    even when the group is past its own first (practice) week. Anchored to the
    dev-clock `joined_week_start` so it stays correct as the clock advances;
    NULL (legacy rows) means an established member."""
    membership = groups_svc.current_membership(user_id)
    joined_week = (membership or {}).get("joined_week_start")
    if not joined_week:
        return False
    try:
        joined_week_date = date.fromisoformat(str(joined_week)[:10])
    except (ValueError, TypeError):
        return False
    return joined_week_date == current_week_start()


def _current_week_is_practice_for(user_id: str, group_id: str | None) -> bool:
    """The current week counts as practice for a user when either the group is in
    its own first (practice) week, or the user is a mid-week joiner."""
    return _is_practice_week(group_id, "current") or _joined_mid_current_week(user_id)


def get_two_week_view(user_id: str) -> dict:
    this_row = _ensure_plan(user_id, current_week_start())
    _mark_missed_for_past_days(this_row)
    next_row = _ensure_plan(user_id, next_week_start())
    streak_svc.compute_and_store_streak(user_id)
    this_week = _load_plan_with_days(this_row)
    next_week = _load_plan_with_days(next_row)
    this_week["is_practice"] = _current_week_is_practice_for(user_id, this_row.get("group_id"))
    next_week["is_practice"] = _is_practice_week(next_row.get("group_id"), "next")
    return {
        "this_week": this_week,
        "next_week": next_week,
        "today_dow": current_day_of_week(),
    }


def _recompute_stake(plan_id: str) -> int:
    """Stake = (planned + locked + checked-in + missed) days × 100."""
    sb = get_supabase()
    days = (
        sb.table("plan_days")
        .select("state")
        .eq("plan_id", plan_id)
        .execute()
    ).data or []
    counted = sum(
        1 for d in days if d["state"] in ("planned", "locked", "checked-in", "missed")
    )
    stake = counted * ELO_PER_PLANNED_DAY
    sb.table("weekly_plans").update({"stake_elo": stake}).eq("id", plan_id).execute()
    return stake


def _soft_unlock_next_week(plan_row: dict) -> None:
    """Reset a next-week plan to editable state. Days previously 'locked' become 'planned'
    again so the user keeps their selection. Used to support re-editing before the week
    actually starts-once Monday rolls around the plan becomes 'this-week' and is fixed."""
    if not plan_row.get("is_locked"):
        return
    sb = get_supabase()
    sb.table("plan_days").update({"state": "planned"}).eq(
        "plan_id", plan_row["id"]
    ).eq("state", "locked").execute()
    sb.table("weekly_plans").update({"is_locked": False, "locked_at": None}).eq(
        "id", plan_row["id"]
    ).execute()


def set_planned_days(user_id: str, dows: list[int]) -> dict:
    """Replace next-week selection in one shot: each listed dow becomes 'planned',
    every other day becomes 'unselected'. If the plan was previously locked we
    soft-unlock it first so the user can re-edit before the week starts."""
    for dow in dows:
        if not 0 <= dow <= 6:
            raise HTTPException(status_code=400, detail=f"Invalid day_of_week {dow}")

    plan_row = _ensure_plan(user_id, next_week_start())
    _soft_unlock_next_week(plan_row)

    _enforce_cap_against_pot(plan_row.get("group_id"), next_week_start(), len(set(dows)))

    selected = set(dows)
    sb = get_supabase()
    if selected:
        sb.table("plan_days").update({"state": "planned"}).eq(
            "plan_id", plan_row["id"]
        ).in_("day_of_week", list(selected)).in_("state", ["planned", "unselected"]).execute()

    unselected = [d for d in range(7) if d not in selected]
    if unselected:
        sb.table("plan_days").update({"state": "unselected"}).eq(
            "plan_id", plan_row["id"]
        ).in_("day_of_week", unselected).in_("state", ["planned", "unselected"]).execute()

    _recompute_stake(plan_row["id"])
    realtime.broadcast_group_changed(plan_row.get("group_id"))
    return _load_plan_with_days(_ensure_plan(user_id, next_week_start()))


def set_current_week_days(user_id: str, dows: list[int]) -> dict:
    """Pledge days for the *current* week. Only allowed during a group's
    practice week, and only for days strictly after today (past/today days are
    locked). Each listed future day becomes 'planned'; other untouched future
    days become 'unselected'."""
    for dow in dows:
        if not 0 <= dow <= 6:
            raise HTTPException(status_code=400, detail=f"Invalid day_of_week {dow}")

    plan_row = _ensure_plan(user_id, current_week_start())
    group_id = plan_row.get("group_id")
    if not _current_week_is_practice_for(user_id, group_id):
        raise HTTPException(status_code=409, detail="This week's pledges are locked")

    today_dow = current_day_of_week()
    selected = {d for d in dows if d > today_dow}
    _enforce_cap_against_pot(group_id, current_week_start(), len(selected))

    sb = get_supabase()
    future = [d for d in range(7) if d > today_dow]
    if selected:
        sb.table("plan_days").update({"state": "planned"}).eq(
            "plan_id", plan_row["id"]
        ).in_("day_of_week", list(selected)).in_("state", ["planned", "unselected"]).execute()

    to_clear = [d for d in future if d not in selected]
    if to_clear:
        sb.table("plan_days").update({"state": "unselected"}).eq(
            "plan_id", plan_row["id"]
        ).in_("day_of_week", to_clear).in_("state", ["planned", "unselected"]).execute()

    # Practice week carries no stake.
    sb.table("weekly_plans").update({"stake_elo": 0}).eq("id", plan_row["id"]).execute()
    result = _load_plan_with_days(_ensure_plan(user_id, current_week_start()))
    result["is_practice"] = True
    realtime.broadcast_group_changed(group_id)
    return result


RESCHEDULE_PENALTY_FRACTION = 0.5  # overflow misses cost 50% instead of 100%
WEEK_CAPACITY = 7                   # physical max pledge-days in any week


def reschedule_missed_day(user_id: str, dow: int) -> dict:
    """Excuse a missed *current-week* session ("unforeseen circumstances").

    Hybrid rule:
      - If next week has room ((pledged + 1) <= 7) → move the pledge there with no
        Elo penalty for the current week.
      - If next week is already full (7 pledged) → it can't be moved, so apply a
        50% Elo penalty of the session's stake instead of the full 100% a plain
        miss would cost.

    Either way the current day becomes 'rescheduled' so it's resolved and cannot
    be actioned (or penalised) twice.
    """
    if not 0 <= dow <= 6:
        raise HTTPException(status_code=400, detail="day_of_week must be 0..6")

    sb = get_supabase()
    cur_plan = _ensure_plan(user_id, current_week_start())
    day_res = (
        sb.table("plan_days")
        .select("state")
        .eq("plan_id", cur_plan["id"])
        .eq("day_of_week", dow)
        .limit(1)
        .execute()
    )
    if not day_res.data:
        raise HTTPException(status_code=500, detail="Plan day missing")
    if day_res.data[0]["state"] != "missed":
        raise HTTPException(status_code=409, detail="Only a missed day can be rescheduled")

    # The session's original stake (per missed day) for the current week.
    group_id = cur_plan.get("group_id")
    stake = 0
    if group_id:
        cond = pot_svc.get_conditions(group_id, "current")
        stake = int(cond.get("stake_per_miss") or 0)

    next_plan = _ensure_plan(user_id, next_week_start())
    next_days = (
        sb.table("plan_days")
        .select("day_of_week, state")
        .eq("plan_id", next_plan["id"])
        .execute()
    ).data or []
    pledged = [d for d in next_days if d["state"] in ("planned", "locked")]

    def _result(outcome: str, moved_to: int | None, penalty: int, new_elo: int) -> dict:
        this_week = _load_plan_with_days(_ensure_plan(user_id, current_week_start()))
        nxt_week = _load_plan_with_days(_ensure_plan(user_id, next_week_start()))
        this_week["is_practice"] = _current_week_is_practice_for(user_id, group_id)
        nxt_week["is_practice"] = _is_practice_week(next_plan.get("group_id"), "next")
        realtime.broadcast_group_changed(group_id)
        return {
            "outcome": outcome,
            "moved_to_dow": moved_to,
            "penalty_elo": penalty,
            "new_elo": new_elo,
            "this_week": this_week,
            "next_week": nxt_week,
        }

    if len(pledged) + 1 <= WEEK_CAPACITY:
        # Room next week → move the pledge into the first free day.
        taken = {
            d["day_of_week"] for d in next_days
            if d["state"] in ("planned", "locked", "checked-in", "missed", "rescheduled")
        }
        free = next((d for d in range(7) if d not in taken), None)
        if free is not None:
            sb.table("plan_days").update({"state": "planned"}).eq(
                "plan_id", next_plan["id"]
            ).eq("day_of_week", free).execute()
        sb.table("plan_days").update({"state": "rescheduled"}).eq(
            "plan_id", cur_plan["id"]
        ).eq("day_of_week", dow).execute()
        _recompute_stake(cur_plan["id"])
        _recompute_stake(next_plan["id"])
        user = users_svc.get_by_id(user_id)
        return _result("moved", free, 0, int(user["elo"]))

    # Next week is full → 50% penalty instead of moving.
    penalty = int(round(stake * RESCHEDULE_PENALTY_FRACTION))
    user = users_svc.get_by_id(user_id)
    applied = min(penalty, int(user["elo"]))  # never drive ELO below 0
    new_elo = int(user["elo"])
    if applied > 0:
        new_elo = int(users_svc.add_elo(user_id, -applied)["elo"])
    sb.table("plan_days").update({"state": "rescheduled"}).eq(
        "plan_id", cur_plan["id"]
    ).eq("day_of_week", dow).execute()
    _recompute_stake(cur_plan["id"])
    return _result("penalty", None, applied, new_elo)


def toggle_next_week_day(user_id: str, dow: int) -> dict:
    if not 0 <= dow <= 6:
        raise HTTPException(status_code=400, detail="day_of_week must be 0..6")
    plan_row = _ensure_plan(user_id, next_week_start())
    _soft_unlock_next_week(plan_row)

    sb = get_supabase()
    day = (
        sb.table("plan_days")
        .select("*")
        .eq("plan_id", plan_row["id"])
        .eq("day_of_week", dow)
        .limit(1)
        .execute()
    ).data
    if not day:
        raise HTTPException(status_code=500, detail="Plan day missing")
    current = day[0]["state"]
    # After _soft_unlock_next_week, anything that was 'locked' is now 'planned'.
    new_state = "unselected" if current == "planned" else "planned"
    if current not in ("planned", "unselected"):
        raise HTTPException(status_code=409, detail=f"Cannot toggle a {current} day")

    if new_state == "planned":
        already_planned = (
            sb.table("plan_days")
            .select("day_of_week", count="exact")
            .eq("plan_id", plan_row["id"])
            .eq("state", "planned")
            .execute()
        )
        count = (already_planned.count or 0)
        _enforce_cap_against_pot(plan_row.get("group_id"), next_week_start(), count + 1)

    sb.table("plan_days").update({"state": new_state}).eq("plan_id", plan_row["id"]).eq("day_of_week", dow).execute()
    _recompute_stake(plan_row["id"])
    realtime.broadcast_group_changed(plan_row.get("group_id"))
    return _load_plan_with_days(_ensure_plan(user_id, next_week_start()))


def _enforce_cap_against_pot(group_id: str | None, week_start: date, requested: int) -> None:
    """If the user belongs to a group, the requested pledge count must not exceed
    the week's `required_pledges`. Solo users are unconstrained."""
    if not group_id:
        return
    cond = pot_svc.get_conditions(group_id, "next" if week_start == next_week_start() else "current")
    cap = cond.get("required_pledges", 7)
    if requested > cap:
        raise HTTPException(
            status_code=409,
            detail=f"Group pot allows up to {cap} pledges this week",
        )


def lock_next_week(user_id: str) -> dict:
    plan_row = _ensure_plan(user_id, next_week_start())
    if plan_row["is_locked"]:
        return _load_plan_with_days(plan_row)

    sb = get_supabase()
    sb.table("plan_days").update({"state": "locked"}).eq("plan_id", plan_row["id"]).eq("state", "planned").execute()
    sb.table("weekly_plans").update({"is_locked": True, "locked_at": _utc_now_iso()}).eq("id", plan_row["id"]).execute()
    _recompute_stake(plan_row["id"])

    # If the user locking is the next-week setter, freeze the conditions.
    if plan_row.get("group_id"):
        cond = pot_svc.get_conditions(plan_row["group_id"], "next")
        if cond.get("setter_user_id") == user_id and not cond.get("is_finalized"):
            pot_svc.finalize_conditions(plan_row["group_id"], next_week_start())

    realtime.broadcast_group_changed(plan_row.get("group_id"))
    return _load_plan_with_days(_ensure_plan(user_id, next_week_start()))


def check_in_today(user_id: str) -> dict:
    """Mark today's day on this-week's plan as checked-in. Award ELO."""
    plan_row = _ensure_plan(user_id, current_week_start())
    dow = current_day_of_week()
    sb = get_supabase()
    day_res = (
        sb.table("plan_days")
        .select("*")
        .eq("plan_id", plan_row["id"])
        .eq("day_of_week", dow)
        .limit(1)
        .execute()
    )
    if not day_res.data:
        raise HTTPException(status_code=500, detail="Plan day missing")
    current = day_res.data[0]["state"]
    if current == "checked-in":
        raise HTTPException(status_code=409, detail="Already checked in today")
    if current not in ("planned", "locked"):
        raise HTTPException(status_code=409, detail=f"No pledge for today ({current})")

    sb.table("plan_days").update({
        "state": "checked-in",
        "checked_in_at": _utc_now_iso(),
    }).eq("plan_id", plan_row["id"]).eq("day_of_week", dow).execute()

    updated_user = users_svc.add_elo(user_id, ELO_PER_CHECKIN)
    plan = _load_plan_with_days(plan_row)
    realtime.broadcast_group_changed(plan_row.get("group_id"))
    return {
        "plan": plan,
        "elo_awarded": ELO_PER_CHECKIN,
        "new_elo": updated_user["elo"],
    }
