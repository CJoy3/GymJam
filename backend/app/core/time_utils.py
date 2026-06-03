"""Week math in Europe/London. Weeks start Monday.

A development "clock offset" can shift the notion of *today* forward in whole
weeks so the app can be demoed across week boundaries without waiting for real
time to pass. The offset is cached in-process and persisted best-effort to a
single-row `dev_clock` table so it survives restarts; if that table is missing
the offset simply lives in memory for the life of the process.
"""
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/London")

# Lazily-loaded cache of the dev clock offset, in days. `None` means "not yet
# read from the database this process".
_offset_days: int | None = None


def _load_offset() -> int:
    global _offset_days
    if _offset_days is not None:
        return _offset_days
    _offset_days = 0
    try:
        from app.core.supabase_client import get_supabase

        res = get_supabase().table("dev_clock").select("offset_days").limit(1).execute()
        if res.data:
            _offset_days = int(res.data[0].get("offset_days") or 0)
    except Exception:
        _offset_days = 0
    return _offset_days


def _persist_offset(days: int) -> None:
    global _offset_days
    _offset_days = days
    try:
        from app.core.supabase_client import get_supabase

        get_supabase().table("dev_clock").upsert(
            {"id": True, "offset_days": days}
        ).execute()
    except Exception:
        # Best-effort: keep the in-memory value even if the table is absent.
        pass


def get_offset_days() -> int:
    return _load_offset()


def set_offset_days(days: int) -> int:
    _persist_offset(int(days))
    return _load_offset()


def advance_weeks(n: int = 1) -> int:
    """Move the simulated clock forward by `n` whole weeks (keeps the weekday)."""
    return set_offset_days(_load_offset() + 7 * n)


def reset_clock() -> int:
    return set_offset_days(0)


def today_local() -> date:
    return (datetime.now(TZ) + timedelta(days=_load_offset())).date()


def monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def current_week_start() -> date:
    return monday_of(today_local())


def next_week_start() -> date:
    return current_week_start() + timedelta(days=7)


def current_day_of_week() -> int:
    """0 = Monday, 6 = Sunday."""
    return today_local().weekday()
