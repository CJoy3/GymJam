from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class UserRegister(BaseModel):
    device_id: Optional[str] = Field(default=None, min_length=1, max_length=128)
    display_name: Optional[str] = Field(default=None, max_length=64)


class UserUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=64)
    gym_id: Optional[str] = None
    avatar: Optional[str] = Field(default=None, max_length=32)
    elo: Optional[int] = Field(default=None, ge=0)
    # Mocked wallet balance, in pence. Dev/testing only.
    money: Optional[int] = Field(default=None, ge=0)
    # Opt-in live location sharing.
    share_location: Optional[bool] = None
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)


class TagUpdate(BaseModel):
    tag: str = Field(min_length=3, max_length=20, pattern=r'^[a-z0-9_-]+$')


class User(BaseModel):
    id: str
    device_id: Optional[str] = None
    display_name: str
    avatar: Optional[str] = None
    elo: int
    streak: int
    gym_id: Optional[str]
    tag: Optional[str] = None
    tag_changes: int = 0
    # Mocked wallet, in pence. money_week_change is the net delta from the most
    # recent Sunday money-pot payout.
    money: int = 0
    money_week_change: int = 0
    share_location: bool = False
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime
    updated_at: datetime
