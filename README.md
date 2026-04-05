# Road700

Initial project scaffold for the fleet repairs platform.

## Stack

- Frontend: React + TypeScript + Vite + MUI
- Backend: FastAPI + SQLAlchemy
- Database: PostgreSQL
- File storage: local filesystem storage under `storage/`
- Runtime: Docker Compose

## Project layout

- `frontend/` web client
- `backend/` API service
- `docker-compose.yml` local infrastructure
- `START_DECISION_DOC.md` стартовые инварианты и merge-gate
- `МАСТЕР ПЛАН ПО ИСПРАВЛЕНИЮ ПРОЕКТА.md` мастер-план remediation
- `Gap analysis и roadmap по use case сотрудника.md` текущее состояние и roadmap employee flow
- `UAT_CHECKLIST_ЗАКАЗЧИК.md` manual acceptance checklist
- `RELEASE_CHECKLIST.md` production release gate перед deploy
- `BUSINESS_SIGNOFF_REPORT_EXPORT.md` шаблон формального подтверждения report/export
- `PR24_CLOSEOUT.md` итог технического закрытия этапа `PR-24`
- `signoff_artifacts/README.md` правила хранения артефактов ручной приемки

## Current remediation state

- archive/restore flows переведены на явные actions/endpoints и закрыты backend/frontend guards
- `primary/source document` приведены к единой рабочей модели
- backup/restore инвалидирует старые JWT и честно раскрывает post-restore behavior в UI
- frontend app shell и shared contracts очищены
- тяжёлые контуры `review queue`, `audit`, `search`, `dashboard`, `services` упрощены
- employee workflow зафиксирован regression-тестом:
  - warning/checks блокируют employee confirmation
  - `employee_confirmed` переводит ремонт в ожидание решения администратора
  - admin может либо подтвердить ремонт, либо вернуть его в `in_review`
  - любое изменение review-полей, техники или документов после employee confirmation раскрывает flow обратно в review
- финальный report/export по ремонту приведён к единой форме:
  - экран показывает executive summary и полный business-report
  - PDF/XLSX экспортируют тот же итоговый отчёт вместе с warnings и workflow-сводкой
- `PR-24` технически закрыт:
  - итог этапа зафиксирован в `PR24_CLOSEOUT.md`
  - полный sign-off пакет собран в `signoff_artifacts/2026-04-04_report-export-signoff/`
  - для формального закрытия остался только reviewer verdict в `BUSINESS_SIGNOFF_REPORT_EXPORT.md`

## Verification commands

- Backend targeted regressions:
  - `cd backend && ./.venv/bin/python -m unittest tests.test_review_and_services`
  - `cd backend && ./.venv/bin/python -m unittest tests.test_document_jobs`
  - `cd backend && ./.venv/bin/python -m unittest tests.test_review_and_services.ReviewAndServicesApiTestCase.test_repair_export_includes_workflow_stage_and_final_report_sections`
- Frontend:
  - `cd frontend && npx tsc --noEmit --noUnusedLocals --noUnusedParameters`
  - `cd frontend && npm run build`

## Local bootstrap

### Recommended: Docker Compose

1. Copy or adjust `.env`
2. Start infrastructure:
   `docker compose up --build`
3. Open:
   - frontend: `http://localhost:5173`
   - backend docs: `http://localhost:8000/docs`
4. The local backend container now applies migrations, initializes the admin user and prints OCR runtime diagnostics on startup.
5. `POSTGRES_PORT` in `.env` changes only the host-side port mapping; backend and worker still connect to the database over the internal Docker network on port `5432`.
6. Backend and worker share the same Docker volume for `storage/`, so uploaded files remain available to OCR jobs across container restarts.
7. The local frontend container now proxies `/api` to the backend container over the internal Docker network instead of hardcoding `http://localhost:<BACKEND_PORT>/api` in the browser.
8. Local Docker builds now ignore `backend/.venv`, local SQLite files, `frontend/node_modules`, `dist/`, and other workstation-only artifacts inside the backend/frontend build contexts.

## GitHub launch

### GitHub Codespaces

1. Open the repository on GitHub.
2. Click `Code` -> `Codespaces` -> `Create codespace on main`.
3. Wait for the post-create setup to finish.
4. Codespaces will build the frontend and open the application on port `8000`.
5. If the workspace revision changed or the application stopped responding, startup will automatically rebuild the frontend and restart both the backend and the OCR job worker.
6. Open the forwarded application port and sign in with the credentials stored in `.codespaces/admin-credentials.txt`.

The repository now includes:
- `.devcontainer/devcontainer.json` for Codespaces
- `scripts/bootstrap-codespace.sh` for OCR system packages, dependency installation and frontend lockfile bootstrap
- `scripts/start-codespace.sh` for frontend build, migrations, admin initialization, OCR diagnostics and startup of both the app and the OCR job worker
- `.github/workflows/ci.yml` for automatic backend and frontend checks on GitHub

## Production deploy

The repository includes a dedicated server stack:

- `Dockerfile.app` builds the frontend and backend into one application image
- `docker-compose.server.yml` runs `postgres`, `app`, `worker`, and `caddy`
- `deploy/server/Caddyfile` serves the application over HTTPS
- `deploy/server/.env.example` contains the required production variables
- `scripts/predeploy-usecase-check.sh` runs the local pre-deploy checklist for the employee workflow
- `RELEASE_CHECKLIST.md` captures the required automated, manual and OCR-runtime release gate
- `scripts/create-signoff-run.sh` creates a dated sign-off artifact folder for report/export acceptance
- `scripts/collect-signoff-baseline.sh` collects backend/frontend/predeploy logs into a sign-off run
- `scripts/check-signoff-run.sh` checks that the expected screen/PDF/XLSX artifacts were collected
- `scripts/deploy-server.sh` safely syncs the project to the server without overwriting or deleting `.env.server` and without deleting `storage/`
- `scripts/smoke-test-ocr-runtime.sh` validates OCR runtime after deploy
- if the production admin password was rotated after bootstrap, set `SMOKE_TEST_ADMIN_LOGIN` and `SMOKE_TEST_ADMIN_PASSWORD` in `.env.server` so authenticated smoke checks use current credentials

Typical server bootstrap:

1. Copy `deploy/server/.env.example` to `.env.server`
2. Set a real domain, `PUBLIC_BASE_URL`, strong PostgreSQL password, strong JWT secret, and strong admin password
3. If password recovery by email is needed, fill in `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`
4. Run:
   - `docker compose --env-file .env.server -f docker-compose.server.yml up -d --build`
5. Open:
   - `https://your-domain`

Production OCR runtime:

- the production image now installs `tesseract-ocr`, `tesseract-ocr-rus`, and `poppler-utils`
- `app` startup prints OCR runtime diagnostics before launching the API
- `worker` validates the OCR runtime on startup when `REQUIRE_FULL_OCR_RUNTIME=true`
- `/api/health` reports `ocr_backend`, `pdf_renderer`, `image_ocr`, and `pdf_scan_ocr`
- the technical admin screen shows whether the current environment is ready for image OCR and scanned PDF OCR
- `scripts/smoke-test-ocr-runtime.sh` checks OCR runtime in both `app` and `worker` and verifies `/api/health` and `/api/system/status`
- `docker-compose.server.yml` publishes both TCP and UDP `443`, otherwise Caddy cannot serve HTTP/3/QUIC through Docker even if the host sysctl is tuned correctly

Typical update deploy from the local workstation:

1. Keep the server `.env.server` in the project root on the server
2. Run the local use case check:
   - `bash ./scripts/predeploy-usecase-check.sh`
3. Confirm the manual and OCR runtime gate from `RELEASE_CHECKLIST.md`
4. If the release changes the repair report or PDF/XLSX export, fill `BUSINESS_SIGNOFF_REPORT_EXPORT.md`
5. If report/export sign-off was performed, create or update the artifact folder and verify it:
   - `./scripts/create-signoff-run.sh <short-release-or-commit>`
   - `./scripts/collect-signoff-baseline.sh <run-folder-name>`
   - `./scripts/check-signoff-run.sh <run-folder-name>`
6. Run:
   - `DEPLOY_HOST=your-server-ip-or-hostname DEPLOY_PASSWORD=your-password ./scripts/deploy-server.sh`
7. The deploy script:
   - runs `scripts/predeploy-usecase-check.sh` automatically unless `SKIP_USE_CASE_CHECK=1`
   - syncs the repository
   - does not upload, overwrite, or delete `.env.server`
   - does not upload local workstation dot-env files such as `.env` or `.env.local`
   - protects `storage/` from deletion during `rsync --delete`
   - skips local SQLite artifacts such as `*.db`
   - skips local `signoff_artifacts/` and `tmp/` during sync so deploy/build context stays clean
   - rebuilds `app`, `worker`, and `caddy`
   - prints `docker compose ps`
   - runs `scripts/smoke-test-ocr-runtime.sh` on the server
   - runs the extra direct `http://DEPLOY_HOST/api/health` smoke only when `DEPLOY_HOST` is an IP address

Password recovery email:

- if SMTP variables are not set, password recovery still works in manual mode
- `PUBLIC_BASE_URL` must be a full `http://` or `https://` URL because it is used in recovery links
- if SMTP auth is used, `SMTP_USERNAME` and `SMTP_PASSWORD` must be set together
- `SMTP_USE_TLS` and `SMTP_USE_SSL` are mutually exclusive
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
   - initialize the admin user: `DATABASE_URL=sqlite:///local.db python -m app.scripts.init_admin`
   - start API: `DATABASE_URL=sqlite:///local.db python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`
   - start OCR worker in a second terminal: `DATABASE_URL=sqlite:///local.db python -m app.scripts.run_job_worker`
2. Frontend:
   - `cd frontend`
   - `npm run dev`
   - if the backend runs on a non-default port, set `BACKEND_PORT=<port>` before `npm run dev`, or set `VITE_BACKEND_PROXY_TARGET=http://127.0.0.1:<port>`
3. Open:
   - frontend: `http://localhost:5173`
   - backend docs: `http://localhost:8000/docs`

## Current environment note

If the current workstation does not have `docker` in `PATH`, use the non-Docker bootstrap path with Python `3.10+` and Node.js instead.
