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

