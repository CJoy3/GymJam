from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException

from app.api.deps import get_current_user
from app.core.supabase_client import get_supabase
from app.schemas.badge import Badges
from app.schemas.user import LeaderboardUser, TagUpdate, User, UserRegister, UserUpdate
from app.services import badges as badges_svc
from app.services import groups as groups_svc
from app.services import realtime
from app.services import users as users_svc

router = APIRouter()


@router.post("/register", response_model=User)
def register(
    payload: Optional[UserRegister] = None,
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> dict:
    """Register or retrieve an app user.

    - With a Supabase Bearer token: links the auth user to an app user (creates on first call).
    - With a legacy device_id body: idempotent device-based registration.
    """
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        try:
            response = get_supabase().auth.get_user(token)
            if not response or not response.user:
                raise HTTPException(status_code=401, detail="Invalid token")
            auth_user_id = str(response.user.id)
            email = response.user.email
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid token")
        return users_svc.register_or_get_by_auth(auth_user_id, email)

    if payload and payload.device_id:
        return users_svc.register_or_get(payload.device_id, payload.display_name)

    raise HTTPException(status_code=400, detail="Provide a Bearer token or device_id")


@router.get("/me", response_model=User)
def me(current: dict = Depends(get_current_user)) -> dict:
    return current


@router.patch("/me", response_model=User)
def update_me(
    patch: UserUpdate,
    current: dict = Depends(get_current_user),
) -> dict:
    fields = patch.model_dump(exclude_none=True)
    updated = users_svc.update_profile(current["id"], fields)
    # Identity/stat changes others can see (ELO, wallet, avatar, name) should
    # reach the rest of the group instantly rather than on their next poll.
    if fields.keys() & {"elo", "money", "avatar", "display_name"}:
        membership = groups_svc.current_membership(current["id"])
        if membership:
            realtime.broadcast_group_changed(membership.get("group_id"))
    return updated


@router.post("/me/tag", response_model=User)
def set_my_tag(body: TagUpdate, current: dict = Depends(get_current_user)) -> dict:
    return users_svc.set_tag(current["id"], body.tag)


@router.get("/leaderboard", response_model=list[LeaderboardUser])
def users_leaderboard(current: dict = Depends(get_current_user)) -> list[dict]:
    """Every user ranked by ELO, each tagged with my friend status toward them
    so the global leaderboard can offer an Add-friend button inline."""
    return users_svc.global_leaderboard(current["id"])


@router.get("/check-tag")
def check_tag(tag: str, current: dict = Depends(get_current_user)) -> dict:
    available = users_svc.check_tag_available(tag.strip().lower(), current["id"])
    return {"available": available, "tag": tag.strip().lower()}


@router.get("/me/badges", response_model=Badges)
def my_badges(current: dict = Depends(get_current_user)) -> dict:
    return badges_svc.compute(current["id"])
