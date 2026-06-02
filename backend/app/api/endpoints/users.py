from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.schemas.user import User, UserRegister, UserUpdate
from app.services import users as users_svc

router = APIRouter()


@router.post("/register", response_model=User)
def register(payload: UserRegister) -> dict:
    """Idempotent. Creates a user for the device on first call; returns the row thereafter."""
    return users_svc.register_or_get(payload.device_id, payload.display_name)


@router.get("/me", response_model=User)
def me(current: dict = Depends(get_current_user)) -> dict:
    return current


@router.patch("/me", response_model=User)
def update_me(
    patch: UserUpdate,
    current: dict = Depends(get_current_user),
) -> dict:
    fields = patch.model_dump(exclude_none=True)
    return users_svc.update_profile(current["id"], fields)
