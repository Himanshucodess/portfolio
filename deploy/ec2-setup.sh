#!/usr/bin/env bash
# One-time EC2 setup: nginx + Node 20 + site dir. Run on the server.
set -euo pipefail

sudo apt-get update -y
sudo apt-get install -y nginx curl

# Node 20 (for building the Vite app on the server if needed)
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

sudo mkdir -p /var/www/portfolio
sudo chown -R ubuntu:ubuntu /var/www/portfolio

# nginx site
sudo cp /home/ubuntu/app/deploy/nginx-portfolio.conf /etc/nginx/sites-available/portfolio
sudo ln -sf /etc/nginx/sites-available/portfolio /etc/nginx/sites-enabled/portfolio
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable --now nginx

# firewall (safe if ufw inactive)
sudo ufw allow 22/tcp >/dev/null 2>&1 || true
sudo ufw allow 80/tcp >/dev/null 2>&1 || true
sudo ufw allow 443/tcp >/dev/null 2>&1 || true

echo "SETUP_OK node=$(node -v) nginx=$(nginx -v 2>&1)"
