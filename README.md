# Road700

Initial project scaffold for the fleet repairs platform.

## Stack

- Frontend: React + TypeScript + Vite + MUI
- Backend: FastAPI + SQLAlchemy
- Database: PostgreSQL
- File storage: S3-compatible storage via MinIO in local development
- Runtime: Docker Compose

## Project layout

- `frontend/` web client
- `backend/` API service
- `docker-compose.yml` local infrastructure
- `Вопросы и ответы по проекту.md` agreed requirements log
- `План реализации и архитектура проекта.md` working implementation plan

## Next implementation targets

1. Database schema and Alembic migrations
2. Authentication and role model
3. Vehicle import
4. Document upload and OCR pipeline
5. Repair draft flow and review queue

## Local bootstrap

### Recommended: Docker Compose

1. Copy or adjust `.env`
2. Start infrastructure:
   `docker compose up --build`
3. Open:
   - frontend: `http://localhost:5173`
   - backend docs: `http://localhost:8000/docs`

## GitHub launch

### GitHub Codespaces

1. Open the repository on GitHub.
2. Click `Code` -> `Codespaces` -> `Create codespace on main`.
3. Wait for the post-create setup to finish.
4. Codespaces will build the frontend and open the application on port `8000`.
5. If the workspace revision changed or the application stopped responding, startup will automatically rebuild the frontend and restart the backend.
6. Open the forwarded application port and sign in with:
   - login: `admin`
   - password: `Road700Admin!2026`

The repository now includes:
- `.devcontainer/devcontainer.json` for Codespaces
- `scripts/bootstrap-codespace.sh` for dependency installation
- `scripts/start-codespace.sh` for frontend build, migrations, admin initialization and app startup
- `.github/workflows/ci.yml` for automatic backend and frontend checks on GitHub

### Alternative: local backend + frontend

Requirements:
- Python `3.10+`
- Node.js + npm

1. Backend:
   - create a virtualenv with Python `3.10+`
   - install dependencies: `pip install -e .`
   - run migrations: `DATABASE_URL=sqlite:///local.db alembic upgrade head`
   - start API: `DATABASE_URL=sqlite:///local.db python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`
2. Frontend:
   - `cd frontend`
   - `VITE_API_URL=http://localhost:8000 npm run dev -- --host 0.0.0.0`
3. Open:
   - frontend: `http://localhost:5173`
   - backend docs: `http://localhost:8000/docs`

## Current environment note

The current workspace where development was continued does not have `docker` in `PATH` and only has Python `3.9`, so the backend cannot be started there until Docker Desktop or Python `3.10+` is installed.
