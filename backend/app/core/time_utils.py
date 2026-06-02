"""Week math in Europe/London. Weeks start Monday."""
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/London")


def today_local() -> date:
    return datetime.now(TZ).date()


def monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def current_week_start() -> date:
    return monday_of(today_local())


def next_week_start() -> date:
    return current_week_start() + timedelta(days=7)


def current_day_of_week() -> int:
    """0 = Monday, 6 = Sunday."""
    return today_local().weekday()
