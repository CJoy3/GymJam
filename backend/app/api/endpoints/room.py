from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.schemas.room import RoomItem, RoomItemPlacement
from app.services import room as room_svc

router = APIRouter()


@router.get("/me", response_model=list[RoomItem])
def get_my_room(current: dict = Depends(get_current_user)) -> list[dict]:
    return room_svc.list_items(current["id"])


@router.put("/me/{item_id}", response_model=list[RoomItem])
def set_item_placement(
    item_id: str,
    body: RoomItemPlacement,
    current: dict = Depends(get_current_user),
) -> list[dict]:
    return room_svc.place_item(current["id"], item_id, body.slot)
