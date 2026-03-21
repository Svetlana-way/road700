FROM node:20-alpine AS frontend-build

WORKDIR /build/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/index.html frontend/tsconfig.json frontend/tsconfig.node.json frontend/vite.config.ts ./
COPY frontend/src ./src

RUN npm run build


FROM python:3.11-slim AS app

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV ROAD700_PROJECT_ROOT=/app
ENV ROAD700_STORAGE_ROOT=/app/storage
ENV ROAD700_FRONTEND_DIST=/app/frontend/dist

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        poppler-utils \
        tesseract-ocr \
        tesseract-ocr-rus \
    && rm -rf /var/lib/apt/lists/*

COPY backend/pyproject.toml backend/alembic.ini /app/
COPY backend/alembic /app/alembic
COPY backend/app /app/app
COPY deploy/server/app-entrypoint.sh /app/app-entrypoint.sh

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir .

COPY --from=frontend-build /build/frontend/dist /app/frontend/dist

RUN chmod +x /app/app-entrypoint.sh \
    && mkdir -p /app/storage

EXPOSE 8000

CMD ["/app/app-entrypoint.sh"]
