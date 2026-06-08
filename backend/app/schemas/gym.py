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
