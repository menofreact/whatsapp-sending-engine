#!/bin/bash

echo "=== WAHAsender VPS Setup ==="

# 1. Update system
echo "Updating system..."
sudo apt-get update -y

# 2. Check/Install Docker
if ! command -v docker &> /dev/null; then
    echo "Docker not found. Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "Docker installed. You might need to log out and back in if running as non-root."
else
    echo "Docker is already installed."
fi

# 3. Check/Install Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose not found. Installing..."
    sudo apt-get install -y docker-compose-plugin
    # Alias if needed, or rely on 'docker compose'
else
    echo "Docker Compose is available."
fi

# 4. Start Application
echo "Starting WAHAsender..."
# Check if docker-compose file exists
if [ -f "docker-compose.yml" ]; then
    sudo docker compose up -d --build
    echo ""
    echo "✅ Application started successfully!"
    echo "Public IP: http://$(curl -s ifconfig.me):3000"
else
    echo "❌ Error: docker-compose.yml not found. Please upload all project files."
fi
