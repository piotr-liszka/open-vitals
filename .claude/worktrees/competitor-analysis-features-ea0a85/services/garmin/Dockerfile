# Garmin sidecar — small, single-stage. curl_cffi ships prebuilt wheels (bundled
# BoringSSL) so no compiler/openssl-dev is needed on python:3.12-slim.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install deps first for layer caching.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# App code.
COPY app ./app

# Tokens live in Postgres (spec 012), Fernet-encrypted per user — no disk volume
# is needed. Run as a non-root user.
RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8081

# Internal health endpoint (no auth) — compose/orchestrators can gate on it.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD python -c "import httpx,sys; sys.exit(0 if httpx.get('http://127.0.0.1:8081/health').status_code==200 else 1)"

CMD ["python", "-m", "app"]
