from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field

from app.schemas.plan import PlanDay

JoinType = Literal["open", "request"]
StakeType = Literal["elo", "money"]
Role = Literal["member", "leader"]
RequestStatus = Literal["pending", "approved", "rejected"]


class GroupCreate(BaseModel):
    # Optional origin hint only — groups are global and not gated by gym.
    gym_id: Optional[str] = None
    name: str = Field(min_length=1, max_length=64)
    weekly_stake_elo: int = Field(default=500, ge=0, le=100000)
    join_type: JoinType = "open"
    # 'elo' or 'money'. Money groups are private-only; for them weekly_stake_elo
    # and stake_per_miss are expressed in PENCE (£1–£20 weekly).
    stake_type: StakeType = "elo"
    # Initial pot conditions for the current AND next week.
    required_pledges: int = Field(ge=1, le=7)
    stake_per_miss: int = Field(ge=0, le=100000)


class Group(BaseModel):
    id: str
    gym_id: Optional[str] = None
    name: str
    weekly_stake_elo: int
    join_type: JoinType
    stake_type: StakeType = "elo"
    leader_id: Optional[str]
    created_at: datetime


class GroupSummary(Group):
    """Group enriched with derived counts for list views."""
    member_count: int
    total_elo: int
    is_member: bool
    is_leader: bool
    join_request_pending: bool


class StakeTypeUpdate(BaseModel):
    stake_type: StakeType


class GroupMember(BaseModel):
    user_id: str
    display_name: str
    role: Role
    elo: int
    joined_at: datetime


class JoinRequestOut(BaseModel):
    id: str
    group_id: str
    user_id: str
    display_name: str
    status: RequestStatus
    created_at: datetime


class SquadMapMember(BaseModel):
    """A group member located at their home gym, for plotting on the Squad Map."""
    user_id: str
    display_name: str
    avatar: Optional[str] = None
    elo: int
    is_me: bool
    gym_id: Optional[str] = None
    gym_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    # True when the coordinates are a live shared fix rather than the home gym.
    is_live: bool = False


class GroupMemberDetail(BaseModel):
    """A group member with their week-by-week pledge state."""
    user_id: str
    display_name: str
    avatar: Optional[str] = None
    elo: int
    role: Role
    joined_at: datetime
    this_week_days: list[PlanDay]
    next_week_days: list[PlanDay]
