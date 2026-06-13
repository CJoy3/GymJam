from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field

from app.schemas.plan import PlanDay

FriendshipStatus = Literal["pending", "accepted"]


class FriendRequestCreate(BaseModel):
    """Send a friend request to a user by their unique #tag."""
    tag: str = Field(min_length=3, max_length=20, pattern=r'^[a-z0-9_-]+$')


class FriendRequestResult(BaseModel):
    # 'accepted' when the other user had already requested us (auto-accept).
    action: Literal["requested", "accepted"]


class FriendRequestOut(BaseModel):
    """An incoming pending request, shown with accept/decline actions."""
    id: str
    user_id: str
    display_name: str
    avatar: Optional[str] = None
    tag: Optional[str] = None
    created_at: datetime


class FriendOut(BaseModel):
    """An accepted friend with their current-week pledges (read-only view)."""
    user_id: str
    display_name: str
    avatar: Optional[str] = None
    tag: Optional[str] = None
    elo: int
    # True when this friend is also a member of MY current group (their pledges
    # are already visible there; the UI can de-emphasise or label them).
    in_my_group: bool
    this_week_days: list[PlanDay]
