FROM python:3.12-slim AS build

WORKDIR /src

RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc g++ binutils \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt "cython>=3.1" setuptools

COPY backend/app /src/app
COPY backend/alembic.ini /src/alembic.ini
COPY backend/alembic /src/alembic
COPY scripts/delivery/compile_backend.py /src/compile_backend.py

RUN python /src/compile_backend.py \
    && python -c "from pathlib import Path; leftover=list(Path('/src/app').rglob('*.py')); raise SystemExit(leftover or 0)" \
    && rm -f /src/compile_backend.py

FROM python:3.12-slim AS runtime

WORKDIR /app

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt \
    && rm -rf /root/.cache

COPY --from=build /src/app /app/app
COPY --from=build /src/alembic.ini /app/alembic.ini
COPY --from=build /src/alembic /app/alembic

RUN mkdir -p /app/data/uploads \
    && python -c "from pathlib import Path; leftover=list(Path('/app/app').rglob('*.py')); raise SystemExit(1 if leftover else 0)"

ENV UPLOAD_DIR=./data/uploads

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
