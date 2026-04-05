from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.api.router import api_router
from app.core.config import settings
from app.core.paths import get_frontend_dist_dir


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


def resolve_frontend_asset_path(frontend_dist_dir: Path, full_path: str) -> Path | None:
    candidate = (frontend_dist_dir / full_path).resolve()
    try:
        candidate.relative_to(frontend_dist_dir.resolve())
    except ValueError:
        return None
    return candidate


@app.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
async def serve_frontend_index():
    frontend_index_file = get_frontend_dist_dir() / "index.html"
    if frontend_index_file.exists():
        return FileResponse(frontend_index_file)
    raise HTTPException(status_code=503, detail="Frontend build not found")


@app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
async def serve_frontend_app(full_path: str):
    if full_path.startswith(("api/", "docs", "redoc", "openapi.json")):
        raise HTTPException(status_code=404, detail="Not Found")

    frontend_dist_dir = get_frontend_dist_dir()
    frontend_index_file = frontend_dist_dir / "index.html"

    if not frontend_dist_dir.exists():
        raise HTTPException(status_code=503, detail="Frontend build not found")

    candidate = resolve_frontend_asset_path(frontend_dist_dir, full_path)
    if candidate is None:
        raise HTTPException(status_code=404, detail="Not Found")
    if candidate.is_file():
        return FileResponse(candidate)

    requested_path = Path(full_path)
    if requested_path.suffix:
        raise HTTPException(status_code=404, detail="Not Found")

    if frontend_index_file.exists():
        return FileResponse(frontend_index_file)

    raise HTTPException(status_code=503, detail="Frontend build not found")
