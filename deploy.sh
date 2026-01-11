#!/bin/bash

# WAHAsender VPS Deployment Script
# Domain: rims.podnet.in
# ================================

set -e

DOMAIN="rims.podnet.in"
APP_DIR="/opt/wahasender"
EMAIL="admin@podnet.in"

echo "========================================="
echo "  WAHAsender VPS Deployment Script"
echo "  Domain: $DOMAIN"
echo "========================================="

# Update system
echo "[1/7] Updating system..."
apt-get update && apt-get upgrade -y

# Install required packages
echo "[2/7] Installing Docker and Nginx..."
apt-get install -y curl nginx certbot python3-certbot-nginx

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# Install Docker Compose plugin
if ! docker compose version &> /dev/null; then
    apt-get install -y docker-compose-plugin
fi

# Create application directory
echo "[3/7] Setting up application directory..."
mkdir -p $APP_DIR
cd $APP_DIR

# Copy Nginx configuration
echo "[4/7] Configuring Nginx..."
cat > /etc/nginx/sites-available/wahasender << 'NGINX_CONF'
server {
    listen 80;
    server_name rims.podnet.in;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50M;
    }
}
NGINX_CONF

# Enable site
ln -sf /etc/nginx/sites-available/wahasender /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Get SSL certificate
echo "[5/7] Obtaining SSL certificate..."
mkdir -p /var/www/certbot
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect

# Create environment file
echo "[6/7] Creating environment configuration..."
if [ ! -f $APP_DIR/.env ]; then
    cat > $APP_DIR/.env << 'ENV_CONF'
PORT=3000
NODE_ENV=production
JWT_SECRET=jwt_$(openssl rand -hex 32)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$(openssl rand -hex 8)
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV_CONF
fi


# Start application
echo "[7/7] Starting WAHAsender..."
cd $APP_DIR
docker compose up -d --build

echo ""
echo "========================================="
echo "  Deployment Complete!"
echo "========================================="
echo ""
echo "  Access your application at:"
echo "  https://$DOMAIN"
echo ""
echo "  Default login:"
echo "  Username: admin"
echo "  Password: (Check .env file on server or logs if first run)"
echo ""
echo "  IMPORTANT: Change the admin password!"
echo ""
echo "  View logs: docker compose logs -f"
echo "========================================="
