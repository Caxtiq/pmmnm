# SVATTT - Flood & Traffic Alert System

Real-time flood and traffic alert system with sensor integration, automated zone creation, and user reporting.

## Features

- 🗺️ Interactive map with VietMap integration
- 📡 Real-time sensor data monitoring
- 🌊 Automated flood zone detection
- ⚡ Traffic outage alerts
- 📊 Workflow automation editor
- 📢 User report management
- 🌤️ Weather integration
- 🔄 WebSocket real-time updates

## Tech Stack

- **Framework**: Next.js 16 + React 19
- **Runtime**: Bun
- **Database**: MongoDB
- **Maps**: VietMap GL JS
- **Styling**: Tailwind CSS
- **Real-time**: WebSocket (WS)
- **Automation**: ReactFlow

## Prerequisites

- Bun >= 1.0
- MongoDB >= 7.0
- VietMap API Key ([Get one here](https://maps.vietmap.vn/))

## Setup

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd svattt
```

2. **Install dependencies**
```bash
bun install
```

3. **Configure environment variables**
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
MONGODB_URI=mongodb://localhost:27017/svattt
NEXT_PUBLIC_VIETMAP_API_KEY=your_api_key_here
PORT=3001
```

4. **Start MongoDB**
```bash
# If using Docker
docker run -d -p 27017:27017 --name mongodb mongo:7

# Or use your local MongoDB installation
mongod
```

5. **Run development servers**

Terminal 1 - WebSocket Server:
```bash
bun run dev
```

Terminal 2 - Next.js Dev Server:
```bash
bun run dev:next
```

6. **Access the application**
- Frontend: http://localhost:3001
- WebSocket: ws://localhost:3001/ws

## Production Deployment

### Option 1: Docker (Recommended)

```bash
# Copy environment file
cp .env.example .env

# Edit .env with production values
nano .env

# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f app
```

### Option 2: VPS with PM2

```bash
# Install PM2
npm install -g pm2

# Copy environment file
cp .env.example .env

# Edit .env with production values
nano .env

# Install dependencies
bun install

# Build application
bun run build

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Setup PM2 startup script
pm2 startup
```

**Automated deployment:**
```bash
chmod +x deploy.sh
./deploy.sh
```

### Option 3: Manual VPS Setup

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Clone and setup
git clone <your-repo>
cd svattt
bun install
bun run build

# Start production server
NODE_ENV=production bun run start
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `MONGODB_URI` | MongoDB connection string | Yes | - |
| `NEXT_PUBLIC_VIETMAP_API_KEY` | VietMap API key | Yes | - |
| `PORT` | Server port | No | 3001 |
| `NODE_ENV` | Environment mode | No | development |

## API Endpoints

### Zones
- `GET /api/zones` - Get all zones
- `POST /api/zones` - Create new zone
- `PUT /api/zones/[id]` - Update zone
- `DELETE /api/zones/[id]` - Delete zone

### Sensors
- `GET /api/sensors` - Get all sensors
- `POST /api/sensors` - Create sensor
- `POST /api/sensor-data` - Submit sensor reading
- `GET /api/sensor-data` - Get sensor history

### User Reports
- `GET /api/user-reports` - Get all reports
- `POST /api/user-reports` - Create report
- `PUT /api/user-reports?id=xxx` - Update report status
- `DELETE /api/user-reports?id=xxx` - Delete report

### Automation
- `GET /api/sensor-rules` - Get automation rules
- `POST /api/sensor-rules` - Create rule
- `PUT /api/sensor-rules?id=xxx` - Update rule
- `DELETE /api/sensor-rules?id=xxx` - Delete rule

## Testing Sensor Data

```bash
# Get all sensors
curl http://localhost:3001/api/sensors

# Send sensor reading (triggers automation)
curl -X POST http://localhost:3001/api/sensor-data \
  -H "Content-Type: application/json" \
  -d '{"sensorId":"sensor-123","value":10.5}'
```

## Project Structure

```
svattt/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── page.tsx          # Main page
│   └── layout.tsx        # Root layout
├── components/            # React components
│   └── Maps/             # Map-related components
├── lib/                  # Utilities & libraries
│   ├── db/              # Database models
│   ├── automation/      # Rule engine
│   └── websocket.ts     # WebSocket client
├── server.ts            # Custom WebSocket server
├── Dockerfile           # Docker configuration
├── docker-compose.yml   # Docker Compose setup
└── ecosystem.config.js  # PM2 configuration
```

## Monitoring

**PM2 Commands:**
```bash
pm2 status              # Check app status
pm2 logs svattt-app    # View logs
pm2 restart svattt-app # Restart app
pm2 stop svattt-app    # Stop app
pm2 delete svattt-app  # Remove app
```

**Docker Commands:**
```bash
docker-compose ps              # Check status
docker-compose logs -f app     # View logs
docker-compose restart app     # Restart
docker-compose down            # Stop all
```

## License

Apache License 2.0 - See LICENSE file for details

## Support

For issues or questions, please open a GitHub issue.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
