from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.api.router import api_router
from app.core.config import settings


FRONTEND_DIST_DIR = Path(__file__).resolve().parents[2] / "frontend" / "dist"
FRONTEND_INDEX_FILE = FRONTEND_DIST_DIR / "index.html"


app = FastAPI(
    title=settings.project_name,
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
async def serve_frontend_index():
    if FRONTEND_INDEX_FILE.exists():
        return FileResponse(FRONTEND_INDEX_FILE)
    raise HTTPException(status_code=503, detail="Frontend build not found")


@app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
async def serve_frontend_app(full_path: str):
    if full_path.startswith(("api/", "docs", "redoc", "openapi.json")):
        raise HTTPException(status_code=404, detail="Not Found")

    if not FRONTEND_DIST_DIR.exists():
        raise HTTPException(status_code=503, detail="Frontend build not found")

    candidate = FRONTEND_DIST_DIR / full_path
    if candidate.is_file():
        return FileResponse(candidate)

    if FRONTEND_INDEX_FILE.exists():
        return FileResponse(FRONTEND_INDEX_FILE)

    raise HTTPException(status_code=503, detail="Frontend build not found")
