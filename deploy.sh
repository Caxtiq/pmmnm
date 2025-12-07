#!/bin/bash

# Deployment script for VPS
echo "🚀 Starting deployment..."

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin master

# Install dependencies
echo "📦 Installing dependencies..."
bun install

# Build application
echo "🔨 Building Next.js application..."
bun run build

# Restart PM2 process
echo "♻️ Restarting application..."
pm2 restart ecosystem.config.js

echo "✅ Deployment complete!"
echo "📊 Check logs: pm2 logs svattt-app"
