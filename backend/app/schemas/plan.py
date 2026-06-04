from datetime import date, datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field

DayState = Literal["unselected", "planned", "locked", "checked-in", "missed", "rescheduled"]


class PlanDay(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    state: DayState
    checked_in_at: Optional[datetime] = None


class WeeklyPlan(BaseModel):
    id: str
    user_id: str
    group_id: Optional[str]
    week_start: date
    is_locked: bool
    stake_elo: int
    is_practice: bool = False
    days: list[PlanDay]


class TwoWeekView(BaseModel):
    this_week: WeeklyPlan
    next_week: WeeklyPlan
    today_dow: int = Field(ge=0, le=6)


class CheckInResult(BaseModel):
    plan: WeeklyPlan
    elo_awarded: int
    new_elo: int


class RescheduleResult(BaseModel):
    # "moved"   → the missed day was rescheduled into next week (no penalty)
    # "penalty" → next week was full, so a 50% Elo penalty was applied instead
    outcome: Literal["moved", "penalty"]
    moved_to_dow: Optional[int] = None
    penalty_elo: int = 0
    new_elo: int
    this_week: WeeklyPlan
    next_week: WeeklyPlan
