"""Friendships: mutual friend links between users, independent of groups.

Friends can see each other's current-week pledges (read-only) even when they
are not in the same group. The flow is request → accept: a 'pending' row is a
directed request; 'accepted' makes it mutual. Declining (or unfriending)
deletes the row so the pair can try again later.
"""
from datetime import datetime, timezone

from fastapi import HTTPException

from app.core.supabase_client import get_supabase
from app.core.time_utils import current_week_start
from app.services.groups import _fill_week


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _pair_rows(user_id: str) -> list[dict]:
    """All friendship rows involving the user (either direction)."""
    sb = get_supabase()
    res = (
        sb.table("friendships")
        .select("*")
        .or_(f"requester_id.eq.{user_id},addressee_id.eq.{user_id}")
        .execute()
    )
    return res.data or []


def _existing_between(user_id: str, other_id: str) -> dict | None:
    for r in _pair_rows(user_id):
        if {r["requester_id"], r["addressee_id"]} == {user_id, other_id}:
            return r
    return None


def _user_by_tag(tag: str) -> dict:
    sb = get_supabase()
    res = (
        sb.table("users")
        .select("id, display_name, avatar, tag")
        .eq("tag", tag.strip().lower())
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="No user with that tag")
    return res.data[0]


def _user_by_id(other_id: str) -> dict:
    sb = get_supabase()
    res = (
        sb.table("users")
        .select("id, display_name, avatar, tag")
        .eq("id", other_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="No such user")
    return res.data[0]


def _request_friendship(user_id: str, other_id: str) -> dict:
    """Create a pending friend request to `other_id`, or auto-accept if they
    already requested US (both sides clearly want the friendship). Shared by the
    by-tag and by-user-id entry points."""
    if other_id == user_id:
        raise HTTPException(status_code=400, detail="You can't friend yourself")

    sb = get_supabase()
    existing = _existing_between(user_id, other_id)
    if existing:
        if existing["status"] == "accepted":
            raise HTTPException(status_code=409, detail="You're already friends")
        if existing["requester_id"] == user_id:
            raise HTTPException(status_code=409, detail="Request already sent")
        # They asked first-accept it.
        sb.table("friendships").update({
            "status": "accepted",
            "accepted_at": _utc_now_iso(),
        }).eq("id", existing["id"]).execute()
        return {"action": "accepted"}

    sb.table("friendships").insert({
        "requester_id": user_id,
        "addressee_id": other_id,
        "status": "pending",
    }).execute()
    return {"action": "requested"}


def send_request(user_id: str, tag: str) -> dict:
    """Send a friend request by tag."""
    other = _user_by_tag(tag)
    return _request_friendship(user_id, other["id"])


def send_request_to_user(user_id: str, target_user_id: str) -> dict:
    """Send a friend request straight to a known user id (e.g. tapping 'Add
    friend' on a group member-no tag needed, so tags stay private)."""
    other = _user_by_id(target_user_id)
    return _request_friendship(user_id, other["id"])


def list_incoming_requests(user_id: str) -> list[dict]:
    """Pending requests addressed to me, oldest first."""
    sb = get_supabase()
    rows = (
        sb.table("friendships")
        .select("id, requester_id, created_at, users!friendships_requester_id_fkey(display_name, avatar, tag)")
        .eq("addressee_id", user_id)
        .eq("status", "pending")
        .order("created_at", desc=False)
        .execute()
    ).data or []
    out = []
    for r in rows:
        u = r.get("users") or {}
        out.append({
            "id": r["id"],
            "user_id": r["requester_id"],
            "display_name": u.get("display_name") or "Anonymous",
            "avatar": u.get("avatar"),
            "tag": u.get("tag"),
            "created_at": r["created_at"],
        })
    return out


def _get_request_for(request_id: str, addressee_id: str) -> dict:
    sb = get_supabase()
    res = sb.table("friendships").select("*").eq("id", request_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Request not found")
    req = res.data[0]
    if req["addressee_id"] != addressee_id:
        raise HTTPException(status_code=403, detail="Not your request to resolve")
    if req["status"] != "pending":
        raise HTTPException(status_code=409, detail="Request already resolved")
    return req


def accept_request(request_id: str, user_id: str) -> dict:
    req = _get_request_for(request_id, user_id)
    sb = get_supabase()
    sb.table("friendships").update({
        "status": "accepted",
        "accepted_at": _utc_now_iso(),
    }).eq("id", req["id"]).execute()
    return {"id": request_id, "status": "accepted"}


def decline_request(request_id: str, user_id: str) -> dict:
    req = _get_request_for(request_id, user_id)
    sb = get_supabase()
    sb.table("friendships").delete().eq("id", req["id"]).execute()
    return {"id": request_id, "status": "declined"}


def remove_friend(user_id: str, friend_user_id: str) -> dict:
    existing = _existing_between(user_id, friend_user_id)
    if not existing or existing["status"] != "accepted":
        raise HTTPException(status_code=404, detail="Not friends")
    sb = get_supabase()
    sb.table("friendships").delete().eq("id", existing["id"]).execute()
    return {"ok": True}


def list_friends(user_id: str) -> list[dict]:
    """Accepted friends with their current-week pledge days and whether they
    are also in my group (so the UI can show 'friends outside the group')."""
    sb = get_supabase()
    accepted = [r for r in _pair_rows(user_id) if r["status"] == "accepted"]
    friend_ids = [
        r["addressee_id"] if r["requester_id"] == user_id else r["requester_id"]
        for r in accepted
    ]
    if not friend_ids:
        return []

    users = (
        sb.table("users")
        .select("id, display_name, avatar, tag, elo")
        .in_("id", friend_ids)
        .execute()
    ).data or []
    by_id = {u["id"]: u for u in users}

    # Which friends share my group?
    my_group_user_ids: set[str] = set()
    mem = (
        sb.table("group_memberships")
        .select("group_id")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    ).data or []
    if mem:
        rows = (
            sb.table("group_memberships")
            .select("user_id")
            .eq("group_id", mem[0]["group_id"])
            .execute()
        ).data or []
        my_group_user_ids = {r["user_id"] for r in rows}

    # Current-week pledges, same shape the group member list uses.
    this_start = current_week_start().isoformat()
    plans = (
        sb.table("weekly_plans")
        .select("user_id, plan_days(day_of_week, state, checked_in_at)")
        .in_("user_id", friend_ids)
        .eq("week_start", this_start)
        .execute()
    ).data or []
    days_by_user = {p["user_id"]: (p.get("plan_days") or []) for p in plans}

    out: list[dict] = []
    for fid in friend_ids:
        u = by_id.get(fid)
        if not u:
            continue
        out.append({
            "user_id": fid,
            "display_name": u.get("display_name") or "Anonymous",
            "avatar": u.get("avatar"),
            "tag": u.get("tag"),
            "elo": u.get("elo") or 0,
            "in_my_group": fid in my_group_user_ids,
            "this_week_days": _fill_week(days_by_user.get(fid)),
        })
    # Friends outside my group first (the point of the list), then by name.
    out.sort(key=lambda f: (f["in_my_group"], f["display_name"].lower()))
    return out
