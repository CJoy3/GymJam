from pydantic import BaseModel


class Badges(BaseModel):
    first_week: bool
    streak_master: bool
    early_bird: bool
    consistency_king: bool
    pot_winner: bool
    group_leader: bool
