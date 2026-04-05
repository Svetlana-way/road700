FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        poppler-utils \
        tesseract-ocr \
        tesseract-ocr-rus \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml alembic.ini /app/
COPY alembic /app/alembic
COPY app /app/app

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir .

CMD ["sh", "-lc", "python -m app.scripts.check_ocr_runtime && alembic upgrade head && python -m app.scripts.init_admin && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
