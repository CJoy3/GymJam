from typing import Optional
from pydantic import BaseModel, Field


class RoomItem(BaseModel):
    item_id: str
    slot: int = Field(ge=0, le=8)


class RoomItemPlacement(BaseModel):
    slot: Optional[int] = Field(default=None, ge=0, le=8)
