from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.schemas.plan import TwoWeekView, WeeklyPlan
from app.services import plans as plans_svc

router = APIRouter()


class SetPlannedDaysBody(BaseModel):
    planned_days: list[int] = Field(default_factory=list)


@router.get("/me", response_model=TwoWeekView)
def get_my_plans(current: dict = Depends(get_current_user)) -> dict:
    return plans_svc.get_two_week_view(current["id"])


@router.post("/me/next/days/{dow}/toggle", response_model=WeeklyPlan)
def toggle_next_week_day(dow: int, current: dict = Depends(get_current_user)) -> dict:
    return plans_svc.toggle_next_week_day(current["id"], dow)


@router.post("/me/next/set", response_model=WeeklyPlan)
def set_next_week_days(
    body: SetPlannedDaysBody, current: dict = Depends(get_current_user)
) -> dict:
    return plans_svc.set_planned_days(current["id"], body.planned_days)


@router.post("/me/next/lock", response_model=WeeklyPlan)
def lock_next_week(current: dict = Depends(get_current_user)) -> dict:
    return plans_svc.lock_next_week(current["id"])
