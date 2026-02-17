FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium chromium-driver && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    beautifulsoup4 psycopg2-binary boto3 \
    playwright requests

RUN playwright install chromium

ENV PYTHONUNBUFFERED=1

WORKDIR /app
COPY scraper_worker.py scoring.py .

CMD ["python", "-u", "scraper_worker.py"]
