from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class UserRegister(BaseModel):
    device_id: str = Field(min_length=1, max_length=128)
    display_name: Optional[str] = Field(default=None, max_length=64)


class UserUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=64)
    gym_id: Optional[str] = None
    avatar: Optional[str] = Field(default=None, max_length=32)


class User(BaseModel):
    id: str
    device_id: str
    display_name: str
    avatar: Optional[str] = None
    elo: int
    streak: int
    gym_id: Optional[str]
    created_at: datetime
    updated_at: datetime
