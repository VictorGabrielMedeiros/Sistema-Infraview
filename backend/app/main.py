from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import devices, discovery, system


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Path("data").mkdir(exist_ok=True)
    init_db()
    yield


app = FastAPI(
    title=f"{settings.app_name} API",
    version=settings.app_version,
    description="Plataforma de descoberta e mapeamento de rede L2/L3",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(devices.router)
app.include_router(discovery.router)
app.include_router(system.router)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.app_version,
    }
