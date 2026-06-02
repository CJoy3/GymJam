from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field

JoinType = Literal["open", "request"]
Role = Literal["member", "leader"]
RequestStatus = Literal["pending", "approved", "rejected"]


class GroupCreate(BaseModel):
    gym_id: str
    name: str = Field(min_length=1, max_length=64)
    weekly_stake_elo: int = Field(default=500, ge=0, le=100000)
    join_type: JoinType = "open"


class Group(BaseModel):
    id: str
    gym_id: str
    name: str
    weekly_stake_elo: int
    join_type: JoinType
    leader_id: Optional[str]
    created_at: datetime


class GroupSummary(Group):
    """Group enriched with derived counts for list views."""
    member_count: int
    is_member: bool
    is_leader: bool
    join_request_pending: bool


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
