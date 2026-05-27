import os
from fastapi import FastAPI
from app.api.router import api_router
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

@app.get("/")
def read_root():
    return {"message": f"Welcome to {settings.PROJECT_NAME}"}

@app.get("/test-supabase")
def test_supabase():
    try:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_ANON_KEY")
        #supabase = create_client(url, key)
        return {"status": "connected", "url": url}
    except Exception as e:
        return {"status": "failed", "error": str(e)}

app.include_router(api_router, prefix=settings.API_V1_STR)
