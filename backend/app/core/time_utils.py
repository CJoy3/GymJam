"""Week math in Europe/London. Weeks start Monday.

A development "clock offset" can shift the notion of *today* forward in whole
weeks so the app can be demoed across week boundaries without waiting for real
time to pass.

IMPORTANT — the backend runs on Vercel (serverless): each request may be served
by a *different* process, so in-process state is NOT shared between the request
that sets the offset and the requests that read it. The single source of truth
is therefore the one-row `dev_clock` table. `refresh_offset()` re-reads it and
is called once at the start of every HTTP request (see main.py middleware), so
every invocation — on whichever serverless instance — agrees on the offset. The
module global is only a per-request scratch value, defaulting to 0.
"""
import time
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/London")

# Cached copy of the offset (days) plus the monotonic time it was last read.
# A short TTL keeps the dev clock fresh across serverless instances without
# paying a DB round-trip on *every* request (which dominated request latency).
_offset_days: int = 0
_offset_read_at: float = 0.0
_OFFSET_TTL_SECONDS = 0


def _read_offset_from_db() -> int | None:
    """Return the persisted offset, or None if it could not be read (e.g. the
    `dev_clock` table is missing)."""
    try:
        from app.core.supabase_client import get_supabase

        res = get_supabase().table("dev_clock").select("offset_days").limit(1).execute()
        if res.data:
            return int(res.data[0].get("offset_days") or 0)
        return 0
    except Exception:
        return None


def refresh_offset(force: bool = False) -> int:
    """Return the shared offset, reading the DB at most once per TTL window (so
    separate serverless invocations stay in sync without a per-request read).
    Pass force=True to bypass the cache (used when mutating the clock)."""
    global _offset_days, _offset_read_at
    now = time.monotonic()
    if not force and (now - _offset_read_at) < _OFFSET_TTL_SECONDS:
        return _offset_days
    val = _read_offset_from_db()
    if val is not None:
        _offset_days = val
    _offset_read_at = now
    return _offset_days


def offset_is_persistent() -> bool:
    """True when the offset can actually be read back from the DB — i.e. the
    dev clock will survive across serverless instances. False usually means the
    `dev_clock` table has not been created yet."""
    return _read_offset_from_db() is not None


def get_offset_days() -> int:
    return _offset_days


def set_offset_days(days: int) -> int:
    """Persist the offset to the shared table (source of truth) and update the
    in-process cache. Returns the value confirmed in the DB when possible."""
    global _offset_days, _offset_read_at
    days = int(days)
    try:
        from app.core.supabase_client import get_supabase

        get_supabase().table("dev_clock").upsert(
            {"id": True, "offset_days": days}, on_conflict="id"
        ).execute()
    except Exception:
        # Best-effort: keep the in-memory value even if the table is absent.
        pass
    _offset_days = days
    _offset_read_at = time.monotonic()  # cache is now fresh
    # Re-read so the returned value reflects what actually persisted.
    confirmed = _read_offset_from_db()
    if confirmed is not None:
        _offset_days = confirmed
    return _offset_days


def advance_weeks(n: int = 1) -> int:
    """Move the simulated clock forward by `n` whole weeks (keeps the weekday)."""
    return set_offset_days(refresh_offset(force=True) + 7 * n)


def advance_days(n: int = 1) -> int:
    """Move the simulated clock forward (or, with n < 0, backward) by `n` days."""
    return set_offset_days(refresh_offset(force=True) + n)


def reset_clock() -> int:
    return set_offset_days(0)


def today_local() -> date:
    return (datetime.now(TZ) + timedelta(days=_offset_days)).date()


def monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def current_week_start() -> date:
    return monday_of(today_local())


def next_week_start() -> date:
    return current_week_start() + timedelta(days=7)


def current_day_of_week() -> int:
    """0 = Monday, 6 = Sunday."""
    return today_local().weekday()
