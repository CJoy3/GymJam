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

app.include_router(api_router, prefix=settings.API_V1_STR)
