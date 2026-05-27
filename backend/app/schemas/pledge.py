from datetime import datetime
from pydantic import BaseModel, Field


class PledgeCreate(BaseModel):
    user_id: str = Field(min_length=1, max_length=128)
    amount: float = Field(gt=0)


class Pledge(BaseModel):
    id: str
    user_id: str
    amount: float
    created_at: datetime
