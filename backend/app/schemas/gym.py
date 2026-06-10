from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class Gym(BaseModel):
    id: str
    name: str
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime


class GymMapPoint(BaseModel):
    """A gym plotted on the map with crowd/strength stats. `avg_elo` drives the
    'turf' size; `member_count` = users whose home gym is this; `active_today` =
    how many have checked in today."""
    id: str
    name: str
    latitude: float
    longitude: float
    member_count: int
    avg_elo: int
    active_today: int


class GymLeaderboardEntry(BaseModel):
    """A gym ranked on the leaderboard. Members are users whose home gym is this
    gym; `total_elo` is their combined ELO, `avg_elo` the per-member average."""
    id: str
    name: str
    member_count: int
    total_elo: int
    avg_elo: int
