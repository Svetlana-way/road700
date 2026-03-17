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
6. Open the forwarded application port and sign in with the credentials stored in `.codespaces/admin-credentials.txt`.

The repository now includes:
- `.devcontainer/devcontainer.json` for Codespaces
- `scripts/bootstrap-codespace.sh` for dependency installation
- `scripts/start-codespace.sh` for frontend build, migrations, admin initialization and app startup
- `.github/workflows/ci.yml` for automatic backend and frontend checks on GitHub

## Production deploy

The repository includes a dedicated server stack:

- `Dockerfile.app` builds the frontend and backend into one application image
- `docker-compose.server.yml` runs `postgres`, `app`, and `caddy`
- `deploy/server/Caddyfile` serves the application over HTTPS
- `deploy/server/.env.example` contains the required production variables
- `scripts/deploy-server.sh` safely syncs the project to the server without deleting `.env.server` and `storage/`

Typical server bootstrap:

1. Copy `deploy/server/.env.example` to `.env.server`
2. Set a real domain, strong PostgreSQL password, strong JWT secret, and strong admin password
3. If password recovery by email is needed, fill in `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`
4. Run:
   - `docker compose --env-file .env.server -f docker-compose.server.yml up -d --build`
5. Open:
   - `https://your-domain`

Typical update deploy from the local workstation:

1. Keep the server `.env.server` in the project root on the server
2. Run:
   - `DEPLOY_HOST=46.8.220.177 DEPLOY_PASSWORD=your-password ./scripts/deploy-server.sh`
3. The script:
   - syncs the repository
   - protects `.env.server` and `storage/` from deletion during `rsync --delete`
   - rebuilds `app` and `caddy`
   - prints `docker compose ps`

Password recovery email:

- if SMTP variables are not set, password recovery still works in manual mode
- if SMTP variables are set correctly, recovery links are sent by email automatically
- the current delivery mode is shown to the administrator inside the technical admin screen

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
