from typing import Optional
from pydantic import BaseModel, Field


class PotConditionsUpdate(BaseModel):
    required_pledges: int = Field(ge=1, le=7)
    stake_per_miss: int = Field(ge=0, le=100000)


class PotMember(BaseModel):
    user_id: str
    display_name: str
    role: str
    pledged_count: int
    completed_count: int
    missed_count: int
    elo_at_risk: int
    elo_lost_so_far: int
    is_setter: bool
    is_on_track: bool


class PotDetail(BaseModel):
    group_id: str
    week_start: str
    setter_user_id: Optional[str]
    setter_display_name: Optional[str]
    required_pledges: int
    stake_per_miss: int
    is_finalized: bool
    total_pot_elo: int
    members: list[PotMember]
