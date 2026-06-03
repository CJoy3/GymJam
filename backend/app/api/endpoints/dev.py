"""Development-only clock controls.

These let the app be demoed across week boundaries: `advance-week` shifts the
simulated "today" forward seven days, so next-week plans and pot conditions
roll into the current week and the UI updates on refresh.
"""
from fastapi import APIRouter

from app.core import time_utils

router = APIRouter()


def _clock_payload() -> dict:
    offset = time_utils.get_offset_days()
    return {
        "offset_days": offset,
        "offset_weeks": offset // 7,
        "today": time_utils.today_local().isoformat(),
        "week_start": time_utils.current_week_start().isoformat(),
        "today_dow": time_utils.current_day_of_week(),
    }


@router.get("/clock")
def get_clock() -> dict:
    return _clock_payload()


@router.post("/advance-week")
def advance_week() -> dict:
    time_utils.advance_weeks(1)
    return _clock_payload()


@router.post("/reset-clock")
def reset_clock() -> dict:
    time_utils.reset_clock()
    return _clock_payload()
