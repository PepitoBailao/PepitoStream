# 🚀 PepitoStream Deployment Guide

Complete guide for deploying PepitoStream in production.

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- A VPS or cloud server
- Domain name (optional)
- Cloudflare account (for tunnel)

## Option 1: Self-Hosted on Personal Server with Cloudflare Tunnel

### Step 1: Setup Server

```bash
# SSH into your server
ssh user@your-server-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Redis
sudo apt install -y redis-server

# Install Cloudflare Tunnel
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
```

### Step 2: Configure PostgreSQL

```bash
# Login to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE pepito_stream;
CREATE USER pepito_user WITH PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE pepito_stream TO pepito_user;
\q
```

### Step 3: Clone and Setup PepitoStream

```bash
# Clone repository
cd /opt
sudo git clone https://github.com/PepitoBailao/PepitoStream.git
cd PepitoStream

# Install dependencies
npm install

# Setup environment
sudo nano .env.local
```

**.env.local** configuration:
```
DATABASE_URL=postgresql://pepito_user:secure_password_here@localhost:5432/pepito_stream
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key
TMDB_API_KEY=your_tmdb_api_key
TORBOX_API_KEY=your_torbox_api_key
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Step 4: Initialize Database

```bash
npm run db:init
npm run db:migrate
```

### Step 5: Build and Start

```bash
# Build
npm run build

# Start with PM2 (recommended)
sudo npm install -g pm2
pm2 start "npm start" --name "pepito-stream"
pm2 startup
pm2 save
```

### Step 6: Setup Cloudflare Tunnel

```bash
# Login to Cloudflare
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create pepito-stream

# Configure tunnel (edit ~/.cloudflared/config.yml)
# Add:
# tunnel: pepito-stream
# credentials-file: /root/.cloudflared/pepito-stream.json
# ingress:
#   - hostname: pepito.your-domain.com
#     service: http://localhost:3000
#   - service: http_status:404

# Start tunnel
cloudflared tunnel run pepito-stream
```

### Step 7: SSL/HTTPS Setup

```bash
# Let's Encrypt with Certbot (if not using Cloudflare tunnel)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot certonly --standalone -d your-domain.com
```

## Option 2: Docker Deployment

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app
COPY . .

# Build Next.js
RUN npm run build

# Expose port
EXPOSE 3000

# Start app
CMD ["npm", "start"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: pepito_stream
      POSTGRES_USER: pepito_user
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://pepito_user:secure_password@postgres:5432/pepito_stream
      REDIS_URL: redis://redis:6379
      JWT_SECRET: your-secret-key
      NODE_ENV: production
    depends_on:
      - postgres
      - redis
    volumes:
      - .:/app

volumes:
  postgres_data:
```

Deploy with Docker:
```bash
docker-compose up -d
docker-compose exec app npm run db:init
docker-compose exec app npm run db:migrate
```

## Option 3: Vercel Deployment (Frontend)

### 1. Deploy Frontend to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### 2. Configure Environment Variables

In Vercel dashboard:
- `NEXT_PUBLIC_API_URL` = Your API endpoint

## Option 4: Cloud Platforms

### AWS EC2

```bash
# Launch EC2 instance (Ubuntu 22.04)
# SSH in and run:
curl -fsSL https://your-domain.com/scripts/deploy.sh | bash
```

### DigitalOcean App Platform

1. Connect GitHub repository
2. Set environment variables
3. Configure build command: `npm run build`
4. Configure start command: `npm start`
5. Deploy

## Monitoring & Maintenance

### Health Check

```bash
# Add to crontab
*/5 * * * * curl -f http://localhost:3000/health || systemctl restart pepito-stream
```

### Log Rotation

```bash
# Configure logrotate
sudo nano /etc/logrotate.d/pepito-stream

# Add:
# /var/log/pepito-stream/*.log {
#   daily
#   missingok
#   rotate 14
#   compress
#   delaycompress
#   notifempty
#   create 0640 www-data www-data
#   sharedscripts
# }
```

### Database Backups

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > /backups/pepito_$DATE.sql
# Upload to cloud storage
```

### Performance Tuning

```sql
-- PostgreSQL tuning
VACUUM ANALYZE;
CREATE INDEX ON copies(source);
CREATE INDEX ON stream_history(user_id);
REINDEX DATABASE pepito_stream;
```

## Reverse Proxy Setup (Nginx)

```nginx
upstream app {
  server localhost:3000;
}

server {
  listen 80;
  server_name pepito.your-domain.com;
  
  location / {
    proxy_pass http://app;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

Enable:
```bash
sudo ln -s /etc/nginx/sites-available/pepito-stream /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Troubleshooting

### Database Connection Error
```bash
# Check PostgreSQL
sudo systemctl status postgresql
psql $DATABASE_URL
```

### Redis Connection Error
```bash
# Check Redis
sudo systemctl status redis-server
redis-cli ping
```

### Port Already in Use
```bash
# Find process
lsof -i :3000
# Kill it
kill -9 <PID>
```

## Security Checklist

- [ ] Set strong JWT_SECRET
- [ ] Configure CORS properly
- [ ] Enable HTTPS/SSL
- [ ] Setup firewall rules
- [ ] Regular database backups
- [ ] Monitor logs for errors
- [ ] Setup rate limiting
- [ ] Enable API authentication
- [ ] Use environment variables for secrets
- [ ] Regular security updates

## Performance Optimization

1. **Enable caching headers**
2. **Compress API responses**
3. **Use CDN for static assets**
4. **Optimize database queries**
5. **Implement Redis caching**
6. **Enable gzip compression**
7. **Monitor performance metrics**

## Support

For deployment issues:
- Check logs: `pm2 logs pepito-stream`
- View system logs: `journalctl -u pepito-stream -f`
- Check disk space: `df -h`
- Check memory: `free -h`
