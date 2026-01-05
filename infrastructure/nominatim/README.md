# Nominatim Geocoding Service

Self-hosted geocoding service for Second Watch Network.

## Requirements

- EC2 instance: t3.xlarge or larger (16GB+ RAM)
- Storage: 50GB+ SSD
- Docker and Docker Compose installed

## Deployment

```bash
# SSH into EC2 instance
ssh ec2-user@<instance-ip>

# Install Docker (Amazon Linux 2)
sudo yum update -y
sudo amazon-linux-extras install docker -y
sudo service docker start
sudo usermod -a -G docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clone/copy this directory
cd /opt
git clone <repo> && cd second-watch-network/infrastructure/nominatim

# Set password (production)
export NOMINATIM_PASSWORD=<secure-password>

# Start Nominatim
docker-compose up -d

# Monitor import progress (first run takes 2-4 hours)
docker-compose logs -f nominatim
```

## API Endpoints

Once running, Nominatim provides:

- **Search (autocomplete)**: `GET /search?q=<query>&format=jsonv2&limit=5`
- **Reverse geocode**: `GET /reverse?lat=<lat>&lon=<lon>&format=jsonv2`
- **Status**: `GET /status`

## Security

- Run in private subnet (VPC)
- Only allow access from backend Lambda/EC2
- Use security groups to restrict port 8080

## Maintenance

```bash
# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Update OSM data (run weekly)
docker-compose exec nominatim nominatim replication --update-once

# Restart
docker-compose restart
```

## Resource Usage

- Disk: ~30GB after import
- RAM: 8-14GB during normal operation
- CPU: Low during queries, high during import/update
