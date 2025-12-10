#!/bin/sh
set -e

echo "🚀 Starting application..."

# Wait for MongoDB to be ready
echo "⏳ Waiting for MongoDB to be ready..."
until bun run scripts/seed-admin.ts 2>/dev/null; do
  echo "   MongoDB not ready yet, waiting 2 seconds..."
  sleep 2
done

echo "✅ MongoDB ready and admin user seeded!"
echo ""

# Start the application
echo "🌐 Starting Next.js on port 3002..."
bun run start:next --port 3002 &

echo "🔌 Starting WebSocket server on port 3001..."
exec bun run websocket-server.ts
