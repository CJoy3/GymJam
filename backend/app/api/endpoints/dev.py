"""Development-only clock controls.

These let the app be demoed across week boundaries: `advance-week` shifts the
simulated "today" forward seven days, so next-week plans and pot conditions
roll into the current week and the UI updates on refresh.
"""
from fastapi import APIRouter

from app.core import time_utils
from app.services import realtime

router = APIRouter()


def _clock_changed() -> dict:
    """Build the clock payload and push a global `clock` ping so every connected
    client re-syncs to the new simulated date instantly (not on its next poll)."""
    realtime.broadcast_clock_changed()
    return _clock_payload()


def _clock_payload() -> dict:
    offset = time_utils.get_offset_days()
    return {
        "offset_days": offset,
        "offset_weeks": offset // 7,
        "today": time_utils.today_local().isoformat(),
        "week_start": time_utils.current_week_start().isoformat(),
        "today_dow": time_utils.current_day_of_week(),
        # False ⇒ the dev_clock table is unreachable, so the offset won't survive
        # across serverless instances (the schema needs to be applied).
        "persisted": time_utils.offset_is_persistent(),
    }


@router.get("/clock")
def get_clock() -> dict:
    return _clock_payload()


@router.post("/advance-week")
def advance_week() -> dict:
    time_utils.advance_weeks(1)
    return _clock_changed()


@router.post("/previous-week")
def previous_week() -> dict:
    """Step the simulated clock back one week, clamped at the real current week
    (never goes earlier than offset 0)."""
    time_utils.set_offset_days(max(0, time_utils.get_offset_days() - 7))
    return _clock_changed()


@router.post("/next-day")
def next_day() -> dict:
    """Step the simulated clock forward one day."""
    time_utils.advance_days(1)
    return _clock_changed()


@router.post("/previous-day")
def previous_day() -> dict:
    """Step the simulated clock back one day, clamped at the real current day
    (never goes earlier than offset 0)."""
    time_utils.set_offset_days(max(0, time_utils.get_offset_days() - 1))
    return _clock_changed()


@router.post("/reset-clock")
def reset_clock() -> dict:
    time_utils.reset_clock()
    return _clock_changed()
