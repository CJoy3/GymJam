from typing import Optional

from fastapi import Header, HTTPException

from app.services import users as users_svc


def get_current_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_device_id: Optional[str] = Header(None, alias="X-Device-Id"),
) -> dict:
    """Resolve the current user from either a Supabase Bearer JWT or the legacy X-Device-Id header."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        return users_svc.get_by_auth_token(token)
    if x_device_id:
        return users_svc.get_by_device_id(x_device_id)
    raise HTTPException(status_code=401, detail="Authentication required")
