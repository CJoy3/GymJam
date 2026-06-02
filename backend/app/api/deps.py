from fastapi import Header

from app.services import users as users_svc


def get_current_user(x_device_id: str = Header(..., alias="X-Device-Id")) -> dict:
    """Resolve the current user from the X-Device-Id header. 401 if unknown."""
    return users_svc.get_by_device_id(x_device_id)
