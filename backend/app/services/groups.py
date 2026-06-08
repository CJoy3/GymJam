from datetime import datetime, timezone

from fastapi import HTTPException

from app.core.supabase_client import get_supabase
from app.core.time_utils import current_week_start, next_week_start
from app.schemas.group import JoinType


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _insert_membership(group_id: str, user_id: str, role: str) -> None:
    """Create a membership, stamping the dev-clock week it began so mid-week
    joiners (who missed this week's lock) can later be granted a no-stakes
    practice week. Retries without joined_week_start on older schemas missing
    that column, mirroring the rest of the service's degrade-gracefully style."""
    sb = get_supabase()
    payload = {
        "group_id": group_id,
        "user_id": user_id,
        "role": role,
        "joined_week_start": current_week_start().isoformat(),
    }
    try:
        res = sb.table("group_memberships").insert(payload).execute()
        if res and res.data:
            return
    except Exception:
        pass
    fallback = {k: v for k, v in payload.items() if k != "joined_week_start"}
    sb.table("group_memberships").insert(fallback).execute()


def _link_plans_to_group(user_id: str, group_id: str | None) -> None:
    """Re-point the user's existing this-/next-week plans to a new group_id.
    Called on join (group_id set) and leave (None) so the pot view stays accurate."""
    sb = get_supabase()
    sb.table("weekly_plans").update({"group_id": group_id}).eq(
        "user_id", user_id
    ).in_("week_start", [
        current_week_start().isoformat(),
        next_week_start().isoformat(),
    ]).execute()


def _empty_week() -> list[dict]:
    return [
        {"day_of_week": dow, "state": "unselected", "checked_in_at": None}
        for dow in range(7)
    ]


def _fill_week(days: list[dict] | None) -> list[dict]:
    """Pad to all 7 days, sorted by day_of_week; missing days default to 'unselected'."""
    by_dow = {d["day_of_week"]: d for d in (days or [])}
    out = []
    for dow in range(7):
        if dow in by_dow:
            d = by_dow[dow]
            out.append({
                "day_of_week": dow,
                "state": d["state"],
                "checked_in_at": d.get("checked_in_at"),
            })
        else:
            out.append({"day_of_week": dow, "state": "unselected", "checked_in_at": None})
    return out


def list_all(current_user_id: str) -> list[dict]:
    """Return every group on the platform, enriched with member_count + my
    membership state. Groups are global — they are no longer filtered by gym."""
    sb = get_supabase()
    groups = (
        sb.table("groups")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    ).data or []
    if not groups:
        return []

    group_ids = [g["id"] for g in groups]

    members = (
        sb.table("group_memberships")
        .select("group_id, user_id, role, users(elo)")
        .in_("group_id", group_ids)
        .execute()
    ).data or []
    pending = (
        sb.table("join_requests")
        .select("group_id, user_id")
        .in_("group_id", group_ids)
        .eq("status", "pending")
        .execute()
    ).data or []

    by_group_members: dict[str, list[dict]] = {}
    for m in members:
        by_group_members.setdefault(m["group_id"], []).append(m)
    my_pending = {p["group_id"] for p in pending if p["user_id"] == current_user_id}

    enriched: list[dict] = []
    for g in groups:
        gm = by_group_members.get(g["id"], [])
        mine = next((m for m in gm if m["user_id"] == current_user_id), None)
        elos = [(m.get("users") or {}).get("elo") or 0 for m in gm]
        avg_elo = round(sum(elos) / len(elos)) if elos else 0
        enriched.append({
            **g,
            "member_count": len(gm),
            "avg_elo": avg_elo,
            "is_member": mine is not None,
            "is_leader": mine is not None and mine["role"] == "leader",
            "join_request_pending": g["id"] in my_pending,
        })
    return enriched


def get_group(group_id: str) -> dict:
    sb = get_supabase()
    res = sb.table("groups").select("*").eq("id", group_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Group not found")
    return res.data[0]


def current_membership(user_id: str) -> dict | None:
    sb = get_supabase()
    res = (
        sb.table("group_memberships")
        .select("*")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def create_group(
    creator_id: str,
    name: str,
    weekly_stake_elo: int,
    join_type: JoinType,
    required_pledges: int,
    stake_per_miss: int,
    gym_id: str | None = None,
) -> dict:
    if current_membership(creator_id):
        raise HTTPException(status_code=409, detail="Leave your current group first")
    # Validate caller-supplied pot defaults so we fail loud, not via DB-side check.
    required_pledges = max(1, min(7, int(required_pledges or 3)))
    stake_per_miss = max(0, int(stake_per_miss or 100))

    sb = get_supabase()
    # Try inserting WITH the new columns first; if the schema is old, retry
    # without them so creation still works (the values live in pot_conditions
    # as a backup in that case).
    base_payload = {
        "gym_id": gym_id,
        "name": name,
        "weekly_stake_elo": weekly_stake_elo,
        "join_type": join_type,
        "leader_id": creator_id,
    }
    full_payload = {
        **base_payload,
        "default_required_pledges": required_pledges,
        "default_stake_per_miss": stake_per_miss,
    }
    grp = None
    try:
        grp = sb.table("groups").insert(full_payload).execute()
    except Exception:
        grp = None
    if not grp or not grp.data:
        grp = sb.table("groups").insert(base_payload).execute()
    if not grp.data:
        raise HTTPException(status_code=500, detail="Failed to create group")
    group = grp.data[0]
    _insert_membership(group["id"], creator_id, "leader")
    _link_plans_to_group(creator_id, group["id"])

    # Seed pot conditions. The current week is a no-stakes "practice" week: only
    # the days remaining after today are pledgeable (sessions = remaining days),
    # the stake is 0, and the rules are frozen. Next week starts as normal with
    # the leader's chosen rules. After the practice week it continues as usual.
    #
    # If seeding fails the group would otherwise live without conditions and
    # the next pot read would silently install defaults (3, 100) — so we roll
    # back the group + membership rows and surface the underlying error.
    from app.services import pot as pot_svc
    from app.core.time_utils import current_day_of_week, current_week_start, next_week_start

    try:
        remaining_days = max(0, 6 - current_day_of_week())
        pot_svc.seed_conditions(
            group["id"], current_week_start(),
            setter_user_id=creator_id,
            required_pledges=max(1, remaining_days),
            stake_per_miss=0,
            is_finalized=True,
            is_practice=True,
        )
        pot_svc.seed_conditions(
            group["id"], next_week_start(),
            setter_user_id=creator_id,
            required_pledges=required_pledges,
            stake_per_miss=stake_per_miss,
        )
    except Exception:
        sb.table("group_memberships").delete().eq("group_id", group["id"]).execute()
        sb.table("groups").delete().eq("id", group["id"]).execute()
        raise

    return group


def join_or_request(group_id: str, user_id: str) -> dict:
    """Returns { action: 'joined' | 'requested', group }."""
    if current_membership(user_id):
        raise HTTPException(status_code=409, detail="Leave your current group first")
    group = get_group(group_id)

    sb = get_supabase()
    if group["join_type"] == "open":
        _insert_membership(group_id, user_id, "member")
        _link_plans_to_group(user_id, group_id)
        return {"action": "joined", "group": group}

    existing = (
        sb.table("join_requests")
        .select("id")
        .eq("group_id", group_id)
        .eq("user_id", user_id)
        .eq("status", "pending")
        .limit(1)
        .execute()
    )
    if existing.data:
        return {"action": "requested", "group": group}

    sb.table("join_requests").insert({
        "group_id": group_id,
        "user_id": user_id,
        "status": "pending",
    }).execute()
    return {"action": "requested", "group": group}


def leave_group(group_id: str, user_id: str) -> dict:
    """Leave a group. Returns metadata about the side effects.

    Cases:
      - non-leader leaves → membership removed; group unchanged.
      - leader leaves AND is the only member → group is deleted entirely.
      - leader leaves AND others remain → oldest remaining member is auto-promoted.
    """
    sb = get_supabase()
    grp = get_group(group_id)
    is_leader = grp.get("leader_id") == user_id

    # Snapshot members (id + joined_at), ordered oldest first.
    members = (
        sb.table("group_memberships")
        .select("user_id, joined_at")
        .eq("group_id", group_id)
        .order("joined_at", desc=False)
        .execute()
    ).data or []

    others = [m for m in members if m["user_id"] != user_id]

    # Case: leader leaving as the only member → delete the group.
    if is_leader and not others:
        sb.table("groups").delete().eq("id", group_id).execute()
        return {"deleted": True, "promoted_user_id": None}

    promoted_user_id: str | None = None
    if is_leader and others:
        promoted_user_id = others[0]["user_id"]
        sb.table("groups").update({"leader_id": promoted_user_id}).eq("id", group_id).execute()
        sb.table("group_memberships").update({"role": "leader"}).eq(
            "group_id", group_id
        ).eq("user_id", promoted_user_id).execute()

    sb.table("group_memberships").delete().eq("group_id", group_id).eq("user_id", user_id).execute()
    _link_plans_to_group(user_id, None)
    return {"deleted": False, "promoted_user_id": promoted_user_id}


def list_members(group_id: str) -> list[dict]:
    """List all members of a group with their this-week and next-week pledge state."""
    sb = get_supabase()
    memberships = (
        sb.table("group_memberships")
        .select("user_id, role, joined_at, users(display_name, elo, avatar)")
        .eq("group_id", group_id)
        .order("joined_at", desc=False)
        .execute()
    ).data or []
    if not memberships:
        return []

    user_ids = [m["user_id"] for m in memberships]
    this_start = current_week_start().isoformat()
    next_start = next_week_start().isoformat()

    plans = (
        sb.table("weekly_plans")
        .select("user_id, week_start, plan_days(day_of_week, state, checked_in_at)")
        .in_("user_id", user_ids)
        .in_("week_start", [this_start, next_start])
        .execute()
    ).data or []

    plan_by_user_week: dict[tuple[str, str], list[dict]] = {}
    for p in plans:
        plan_by_user_week[(p["user_id"], p["week_start"])] = p.get("plan_days") or []

    out: list[dict] = []
    for m in memberships:
        u = m.get("users") or {}
        out.append({
            "user_id": m["user_id"],
            "display_name": u.get("display_name") or "Anonymous",
            "avatar": u.get("avatar"),
            "elo": u.get("elo") or 0,
            "role": m["role"],
            "joined_at": m["joined_at"],
            "this_week_days": _fill_week(plan_by_user_week.get((m["user_id"], this_start))),
            "next_week_days": _fill_week(plan_by_user_week.get((m["user_id"], next_start))),
        })
    return out


def list_pending_requests(group_id: str, leader_id: str) -> list[dict]:
    group = get_group(group_id)
    if group.get("leader_id") != leader_id:
        raise HTTPException(status_code=403, detail="Only the leader can view requests")
    sb = get_supabase()
    res = (
        sb.table("join_requests")
        .select("id, group_id, user_id, status, created_at, users(display_name)")
        .eq("group_id", group_id)
        .eq("status", "pending")
        .order("created_at", desc=False)
        .execute()
    )
    rows = res.data or []
    return [
        {
            "id": r["id"],
            "group_id": r["group_id"],
            "user_id": r["user_id"],
            "status": r["status"],
            "created_at": r["created_at"],
            "display_name": (r.get("users") or {}).get("display_name", "Anonymous"),
        }
        for r in rows
    ]


def _get_request(request_id: str) -> dict:
    sb = get_supabase()
    res = sb.table("join_requests").select("*").eq("id", request_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Request not found")
    return res.data[0]


def _assert_leader(group_id: str, user_id: str) -> None:
    group = get_group(group_id)
    if group.get("leader_id") != user_id:
        raise HTTPException(status_code=403, detail="Only the leader can resolve requests")


def approve_request(request_id: str, leader_id: str) -> dict:
    req = _get_request(request_id)
    if req["status"] != "pending":
        raise HTTPException(status_code=409, detail="Request already resolved")
    _assert_leader(req["group_id"], leader_id)
    if current_membership(req["user_id"]):
        raise HTTPException(status_code=409, detail="User already in a group")
    sb = get_supabase()
    _insert_membership(req["group_id"], req["user_id"], "member")
    _link_plans_to_group(req["user_id"], req["group_id"])
    sb.table("join_requests").update({
        "status": "approved",
        "resolved_at": _utc_now_iso(),
    }).eq("id", request_id).execute()
    return {"id": request_id, "status": "approved"}


def reject_request(request_id: str, leader_id: str) -> dict:
    req = _get_request(request_id)
    if req["status"] != "pending":
        raise HTTPException(status_code=409, detail="Request already resolved")
    _assert_leader(req["group_id"], leader_id)
    sb = get_supabase()
    sb.table("join_requests").update({
        "status": "rejected",
        "resolved_at": _utc_now_iso(),
    }).eq("id", request_id).execute()
    return {"id": request_id, "status": "rejected"}
