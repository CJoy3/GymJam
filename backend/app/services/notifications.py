"""Group activity feed + nudges.

The feed is synthesised on read from existing data (join requests, this week's
plan_days, member streaks) plus recently received nudges-no event table to
maintain. Nudges are persisted only so we can rate-limit the button (one
from→to nudge per hour) and surface "X nudged you".
"""
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException

from app.core.supabase_client import get_supabase
from app.core.time_utils import current_day_of_week, current_week_start
from app.services import realtime

NUDGE_COOLDOWN = timedelta(hours=1)
STREAK_MILESTONE = 2  # surface members consistent for >= this many weeks


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_ts(raw: Any) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


def _safe(query: Any) -> Any | None:
    try:
        return query.execute()
    except Exception:
        return None


def send_nudge(group_id: str, from_user_id: str, to_user_id: str) -> dict:
    if from_user_id == to_user_id:
        raise HTTPException(status_code=400, detail="You can't nudge yourself")

    sb = get_supabase()
    members = (
        sb.table("group_memberships")
        .select("user_id")
        .eq("group_id", group_id)
        .in_("user_id", [from_user_id, to_user_id])
        .execute()
    ).data or []
    member_ids = {m["user_id"] for m in members}
    if from_user_id not in member_ids or to_user_id not in member_ids:
        raise HTTPException(status_code=403, detail="Both members must be in this group")

    recent = (
        sb.table("nudges")
        .select("created_at")
        .eq("group_id", group_id)
        .eq("from_user_id", from_user_id)
        .eq("to_user_id", to_user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    ).data or []
    now = _now()
    if recent:
        last = _parse_ts(recent[0].get("created_at"))
        if last:
            next_allowed = last + NUDGE_COOLDOWN
            if now < next_allowed:
                mins = int((next_allowed - now).total_seconds() // 60) + 1
                raise HTTPException(
                    status_code=429,
                    detail=f"Already nudged-you can nudge again in {mins} min",
                )

    sb.table("nudges").insert({
        "group_id": group_id,
        "from_user_id": from_user_id,
        "to_user_id": to_user_id,
    }).execute()
    realtime.broadcast_group_changed(group_id)
    return {
        "ok": True,
        "to_user_id": to_user_id,
        "next_allowed_at": (now + NUDGE_COOLDOWN).isoformat(),
    }


def group_activity(group_id: str, user_id: str) -> list[dict]:
    sb = get_supabase()

    members = (
        sb.table("group_memberships")
        .select("user_id, role, users(display_name, streak)")
        .eq("group_id", group_id)
        .order("joined_at", desc=False)
        .execute()
    ).data or []
    name_by: dict[str, str] = {}
    streak_by: dict[str, int] = {}
    for m in members:
        u = m.get("users") or {}
        name_by[m["user_id"]] = u.get("display_name") or "Anonymous"
        streak_by[m["user_id"]] = u.get("streak") or 0
    member_ids = list(name_by.keys())

    grp = (
        sb.table("groups").select("leader_id").eq("id", group_id).limit(1).execute()
    ).data or []
    is_leader = bool(grp) and grp[0].get("leader_id") == user_id

    items: list[dict] = []

    # Pending join requests-actionable, leader only.
    if is_leader:
        reqs = (
            sb.table("join_requests")
            .select("id, user_id, created_at, users(display_name)")
            .eq("group_id", group_id)
            .eq("status", "pending")
            .order("created_at", desc=False)
            .execute()
        ).data or []
        for r in reqs:
            nm = (r.get("users") or {}).get("display_name") or "Someone"
            items.append({
                "id": f"req:{r['id']}",
                "kind": "join_request",
                "message": f"{nm} wants to join the group",
                "actor_name": nm,
                "created_at": r.get("created_at"),
                "request_id": r["id"],
                "user_id": r["user_id"],
            })

    # Nudges I've received recently (degrade gracefully if table is missing).
    since = (_now() - timedelta(hours=24)).isoformat()
    nudges_res = _safe(
        sb.table("nudges")
        .select("id, from_user_id, created_at")
        .eq("group_id", group_id)
        .eq("to_user_id", user_id)
        .gte("created_at", since)
        .order("created_at", desc=True)
        .limit(20)
    )
    for n in (nudges_res.data if nudges_res else None) or []:
        actor = name_by.get(n["from_user_id"], "A teammate")
        items.append({
            "id": f"nudge:{n['id']}",
            "kind": "nudge",
            "message": f"{actor} nudged you to get to the gym",
            "actor_name": actor,
            "created_at": n.get("created_at"),
            "user_id": n["from_user_id"],
        })

    # This week's activity (about other members).
    week = current_week_start().isoformat()
    today = current_day_of_week()
    if member_ids:
        plans = (
            sb.table("weekly_plans")
            .select("user_id, plan_days(day_of_week, state, checked_in_at)")
            .eq("group_id", group_id)
            .eq("week_start", week)
            .in_("user_id", member_ids)
            .execute()
        ).data or []
        for p in plans:
            uid = p["user_id"]
            if uid == user_id:
                continue
            nm = name_by.get(uid, "A member")
            for d in (p.get("plan_days") or []):
                if d["day_of_week"] != today:
                    continue
                if d["state"] == "missed":
                    items.append({
                        "id": f"missed:{uid}:{week}",
                        "kind": "missed",
                        "message": f"{nm} missed their session today",
                        "actor_name": nm,
                        "created_at": None,
                        "user_id": uid,
                    })
                elif d["state"] == "checked-in":
                    items.append({
                        "id": f"checkin:{uid}:{week}",
                        "kind": "checkin",
                        "message": f"{nm} checked in today",
                        "actor_name": nm,
                        "created_at": d.get("checked_in_at"),
                        "user_id": uid,
                    })

    # Streak milestones (about other members).
    for uid, st in streak_by.items():
        if uid == user_id or st < STREAK_MILESTONE:
            continue
        nm = name_by.get(uid, "A member")
        items.append({
            "id": f"streak:{uid}:{st}",
            "kind": "streak",
            "message": f"{nm} has been consistent for {st} weeks",
            "actor_name": nm,
            "created_at": None,
            "user_id": uid,
        })

    # Actionable + most-recent first.
    kind_order = {"join_request": 0, "nudge": 1, "missed": 2, "checkin": 3, "streak": 4}

    def _sort_key(it: dict) -> tuple[int, float]:
        ts = _parse_ts(it.get("created_at"))
        return (kind_order.get(it["kind"], 9), -(ts.timestamp() if ts else 0.0))

    items.sort(key=_sort_key)
    return items
