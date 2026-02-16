FROM python:3.11-slim

RUN pip install --no-cache-dir \
    psycopg2-binary boto3 requests

WORKDIR /app
COPY discovery_worker.py scoring.py ./
COPY sources/ ./sources/

CMD ["python", "discovery_worker.py"]
