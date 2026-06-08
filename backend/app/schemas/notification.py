from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel

ActivityKind = Literal["join_request", "nudge", "missed", "checkin", "streak"]


class ActivityItem(BaseModel):
    id: str
    kind: ActivityKind
    message: str
    actor_name: str
    # Present for time-stamped events (nudges, check-ins, requests); None for
    # "current state" derived items (today's misses, streak milestones).
    created_at: Optional[datetime] = None
    # Set on join_request items so the leader can approve/reject inline.
    request_id: Optional[str] = None
    # The member the item is about (used by the client, e.g. avatars).
    user_id: Optional[str] = None


class NudgeResult(BaseModel):
    ok: bool
    to_user_id: str
    # When the sender may nudge this person again.
    next_allowed_at: datetime
