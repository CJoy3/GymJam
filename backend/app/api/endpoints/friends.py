from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.schemas.friend import (
    FriendOut,
    FriendRequestCreate,
    FriendRequestOut,
    FriendRequestResult,
)
from app.services import friends as friends_svc

router = APIRouter()


@router.get("", response_model=list[FriendOut])
def list_friends(current: dict = Depends(get_current_user)) -> list[dict]:
    """My accepted friends, with their current-week pledges (read-only)."""
    return friends_svc.list_friends(current["id"])


@router.get("/requests", response_model=list[FriendRequestOut])
def list_incoming_requests(current: dict = Depends(get_current_user)) -> list[dict]:
    return friends_svc.list_incoming_requests(current["id"])


@router.post("/request", response_model=FriendRequestResult)
def send_request(body: FriendRequestCreate, current: dict = Depends(get_current_user)) -> dict:
    """Send a friend request by #tag (auto-accepts if they already asked us)."""
    return friends_svc.send_request(current["id"], body.tag)


@router.post("/request-user/{target_user_id}", response_model=FriendRequestResult)
def send_request_to_user(target_user_id: str, current: dict = Depends(get_current_user)) -> dict:
    """Send a friend request straight to a user id-used by 'Add friend' on a
    group member, so no tag is exposed (auto-accepts if they already asked us)."""
    return friends_svc.send_request_to_user(current["id"], target_user_id)


@router.post("/requests/{request_id}/accept")
def accept_request(request_id: str, current: dict = Depends(get_current_user)) -> dict:
    return friends_svc.accept_request(request_id, current["id"])


@router.post("/requests/{request_id}/decline")
def decline_request(request_id: str, current: dict = Depends(get_current_user)) -> dict:
    return friends_svc.decline_request(request_id, current["id"])


@router.delete("/{friend_user_id}")
def remove_friend(friend_user_id: str, current: dict = Depends(get_current_user)) -> dict:
    return friends_svc.remove_friend(current["id"], friend_user_id)
