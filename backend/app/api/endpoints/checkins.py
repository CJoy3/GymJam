from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.schemas.plan import CheckInResult
from app.services import plans as plans_svc

router = APIRouter()


@router.post("/me", response_model=CheckInResult)
def check_in(current: dict = Depends(get_current_user)) -> dict:
    return plans_svc.check_in_today(current["id"])
