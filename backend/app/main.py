import logging
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.router import api_router
from app.core import time_utils
from app.core.config import settings

logger = logging.getLogger("gymjam")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)


@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Last line of defence: any *unhandled* exception is logged server-side but
    returned to the client as a generic 500 — never a stack trace or internal
    detail. (Deliberate HTTPExceptions keep their own status/message.) This is the
    backend half of "don't show internal server errors on the frontend".
    """
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def _sync_dev_clock(request: Request, call_next):
    """Re-read the dev-clock offset from the shared DB once per request. The
    backend is serverless (Vercel), so the process that set the offset is not
    the one that reads it — this keeps every request consistent with the table."""
    try:
        time_utils.refresh_offset()
    except Exception:
        pass
    return await call_next(request)


@app.get("/")
def read_root():
    return {"message": f"Welcome to {settings.PROJECT_NAME}"}


@app.get("/config")
def get_client_config():
    """Public endpoint — returns the Supabase URL and anon key for the frontend.
    The anon key is safe to expose publicly (it is controlled by Row Level Security)."""
    return {
        "supabase_url": os.environ.get("SUPABASE_URL", ""),
        "supabase_anon_key": os.environ.get("SUPABASE_ANON_KEY", ""),
    }


app.include_router(api_router, prefix=settings.API_V1_STR)
