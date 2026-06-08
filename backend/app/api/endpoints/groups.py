from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.schemas.group import (
    Group,
    GroupCreate,
    GroupMemberDetail,
    GroupSummary,
    JoinRequestOut,
)
from app.schemas.notification import ActivityItem, NudgeResult
from app.schemas.pot import PotConditionsUpdate, PotDetail
from app.services import groups as groups_svc
from app.services import notifications as notifications_svc
from app.services import pot as pot_svc

router = APIRouter()


@router.get("", response_model=list[GroupSummary])
def list_all_groups(current: dict = Depends(get_current_user)) -> list[dict]:
    """All groups on the platform — global, not filtered by the user's home gym."""
    return groups_svc.list_all(current["id"])


@router.get("/by-gym/{gym_id}", response_model=list[GroupSummary])
def list_groups_at_gym(gym_id: str, current: dict = Depends(get_current_user)) -> list[dict]:
    # Groups are global now; the gym path param is ignored (kept for backward
    # compatibility with older clients).
    return groups_svc.list_all(current["id"])


@router.post("", response_model=Group, status_code=201)
def create_group(payload: GroupCreate, current: dict = Depends(get_current_user)) -> dict:
    return groups_svc.create_group(
        creator_id=current["id"],
        gym_id=payload.gym_id,
        name=payload.name,
        weekly_stake_elo=payload.weekly_stake_elo,
        join_type=payload.join_type,
        required_pledges=payload.required_pledges,
        stake_per_miss=payload.stake_per_miss,
    )


@router.post("/{group_id}/join")
def join_group(group_id: str, current: dict = Depends(get_current_user)) -> dict:
    return groups_svc.join_or_request(group_id, current["id"])


@router.post("/{group_id}/leave")
def leave_group(group_id: str, current: dict = Depends(get_current_user)) -> dict:
    return {"ok": True, **groups_svc.leave_group(group_id, current["id"])}


@router.get("/{group_id}/requests", response_model=list[JoinRequestOut])
def list_requests(group_id: str, current: dict = Depends(get_current_user)) -> list[dict]:
    return groups_svc.list_pending_requests(group_id, current["id"])


@router.post("/requests/{request_id}/approve")
def approve_request(request_id: str, current: dict = Depends(get_current_user)) -> dict:
    return groups_svc.approve_request(request_id, current["id"])


@router.post("/requests/{request_id}/reject")
def reject_request(request_id: str, current: dict = Depends(get_current_user)) -> dict:
    return groups_svc.reject_request(request_id, current["id"])


@router.get("/{group_id}/pot", response_model=PotDetail)
def get_pot(group_id: str, week: str = "current") -> dict:
    return pot_svc.pot_detail(group_id, week=week)


@router.put("/{group_id}/pot/conditions", response_model=PotDetail)
def update_pot_conditions(
    group_id: str,
    body: PotConditionsUpdate,
    week: str = "current",
    current: dict = Depends(get_current_user),
) -> dict:
    pot_svc.update_conditions(
        group_id=group_id,
        week=week,
        user_id=current["id"],
        required_pledges=body.required_pledges,
        stake_per_miss=body.stake_per_miss,
    )
    return pot_svc.pot_detail(group_id, week=week)


@router.get("/{group_id}/members", response_model=list[GroupMemberDetail])
def list_group_members(group_id: str) -> list[dict]:
    return groups_svc.list_members(group_id)


@router.get("/{group_id}/activity", response_model=list[ActivityItem])
def group_activity(group_id: str, current: dict = Depends(get_current_user)) -> list[dict]:
    """Personalised group feed: join requests (leader), received nudges, and
    this week's misses / check-ins / streak milestones."""
    return notifications_svc.group_activity(group_id, current["id"])


@router.post("/{group_id}/nudge/{target_user_id}", response_model=NudgeResult)
def nudge_member(
    group_id: str,
    target_user_id: str,
    current: dict = Depends(get_current_user),
) -> dict:
    """Nudge a teammate to get to the gym. Rate-limited to once per hour per target."""
    return notifications_svc.send_nudge(group_id, current["id"], target_user_id)
