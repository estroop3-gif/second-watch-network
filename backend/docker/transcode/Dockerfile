# Video Transcoding Container for ECS Fargate
FROM python:3.11-slim

# Install FFmpeg
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir boto3 psycopg2-binary

# Copy worker script
WORKDIR /app
COPY transcode_worker.py .

# Run the worker
CMD ["python", "transcode_worker.py"]
