# PHÂN TÍCH HỆ THỐNG FORMS-APP

## 🎯 TỔNG QUAN HỆ THỐNG

### Mục đích

FORMS-app là một hệ thống cảnh báo ngập lụt và sự cố giao thông theo thời gian thực với tích hợp cảm biến, tự động tạo vùng cảnh báo và quản lý báo cáo từ người dùng.

### Thông tin cơ bản

- **Tên dự án**: svattt (FORMS-app)
- **Phiên bản**: 0.1.0
- **License**: Apache License 2.0
- **Tổng số dòng code**: ~8,070 dòng
- **Công nghệ chính**: Next.js 16, React 19, MongoDB, WebSocket

---

## 🏗️ KIẾN TRÚC HỆ THỐNG

### 1. Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                             │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐     │
│  │   Browser   │  │  Mobile Web  │  │  Sensor Devices │     │
│  └──────┬──────┘  └──────┬───────┘  └────────┬────────┘     │
└─────────┼────────────────┼───────────────────┼──────────────┘
          │                │                   │
          │ HTTP/WS        │ HTTP/WS           │ HTTP/WS
          │                │                   │
┌─────────┴────────────────┴───────────────────┴──────────────┐
│                   APPLICATION LAYER                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            Bun WebSocket Server (Port 3001)          │   │
│  │  - WebSocket Handler                                 │   │
│  │  - HTTP Proxy to Next.js                             │   │
│  └──────────────┬───────────────────────────────────────┘   │
│                 │                                           │
│  ┌──────────────┴───────────────────────────────────────┐   │
│  │          Next.js Server (Port 3002)                  │   │
│  │  ┌────────────┐  ┌─────────────┐  ┌──────────────┐   │   │
│  │  │  API Routes│  │  Pages/SSR  │  │  Components  │   │   │
│  │  └────────────┘  └─────────────┘  └──────────────┘   │   │
│  └──────────────┬───────────────────────────────────────┘   │
└─────────────────┼───────────────────────────────────────────┘
                  │
┌─────────────────┴──────────────────────────────────────────┐
│                    SERVICE LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Rule Engine  │  │  Auth Service│  │  Notification    │  │
│  │  - Automation│  │  - JWT/BCrypt│  │   Service        │  │
│  │  - Workflow  │  │  - Role-Based│  │  - WebSocket     │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ News Analyzer│  │  Safe Zones  │  │  GCS Storage     │  │
│  │  - AI Crawler│  │  - Routing   │  │  - File Upload   │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────┬──────────────────────────────────────────┘
                  │
┌─────────────────┴───────────────────────────────────────────┐
│                     DATA LAYER                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              MongoDB Database                        │   │
│  │  Collections:                                        │   │
│  │  - zones           - sensors        - sensor_rules   │   │
│  │  - sensor_data     - user_reports   - predictions    │   │
│  │  - users           - activities     - notifications  │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 2. Luồng dữ liệu chính

#### A. Sensor Data Flow

```
Sensor Device → POST /api/sensor-data → Rule Engine →
Auto Create Zone → WebSocket Broadcast → Update Map
```

#### B. User Report Flow

```
User → POST /api/user-reports → Store MongoDB →
WebSocket Notify → Admin Review → Approve/Reject
```

#### C. Real-time Update Flow

```
Data Change → WebSocket Server → Broadcast All Clients →
UI Update (Map, Notifications, Activity Feed)
```

---

## 📂 CẤU TRÚC THỨ MỤC CHI TIẾT

```
FORMS/app/
│
├── app/                              # Next.js App Router
│   ├── api/                          # API Routes (Backend)
│   │   ├── activities/               # Nhật ký hoạt động
│   │   ├── ai-crawler/               # Thu thập tin tức AI
│   │   ├── auth/                     # Xác thực người dùng
│   │   │   ├── init/                 # Khởi tạo admin đầu tiên
│   │   │   ├── login/                # Đăng nhập
│   │   │   ├── logout/               # Đăng xuất
│   │   │   ├── me/                   # Thông tin người dùng hiện tại
│   │   │   └── register/             # Đăng ký tài khoản
│   │   ├── notifications/            # Thông báo
│   │   │   └── zone-created/         # Thông báo tạo zone mới
│   │   ├── predictions/              # Dự đoán ngập lụt
│   │   ├── sensor-data/              # Dữ liệu cảm biến
│   │   ├── sensor-rules/             # Quy tắc tự động hóa
│   │   ├── sensors/                  # Quản lý cảm biến
│   │   ├── upload/                   # Upload file/ảnh
│   │   ├── user-reports/             # Báo cáo từ người dùng
│   │   │   ├── approve/              # Phê duyệt báo cáo
│   │   │   └── vote/                 # Vote báo cáo
│   │   ├── users/                    # Quản lý người dùng
│   │   ├── weather/                  # Dữ liệu thời tiết
│   │   └── zones/                    # Quản lý vùng cảnh báo
│   │       └── [id]/                 # CRUD cho zone cụ thể
│   ├── admin/                        # Admin Dashboard
│   │   └── page.tsx                  # Trang quản trị
│   ├── page.tsx                      # Trang chính (Home)
│   ├── layout.tsx                    # Root layout
│   └── globals.css                   # Global styles
│
├── components/                       # React Components
│   ├── Maps/                         # Map Components
│   │   ├── Maps.tsx                  # Component bản đồ chính
│   │   ├── AdminPanel.tsx            # Panel quản trị vùng/cảm biến
│   │   ├── AICrawlerButton.tsx       # Nút thu thập tin tức AI
│   │   ├── CommunityFeed.tsx         # Feed báo cáo cộng đồng
│   │   ├── RoutePanel.tsx            # Panel tìm đường an toàn
│   │   ├── SearchBox.tsx             # Tìm kiếm địa điểm
│   │   ├── UserReportButton.tsx      # Nút báo cáo từ người dùng
│   │   ├── WeatherPanel.tsx          # Panel thông tin thời tiết
│   │   ├── WorkflowEditor.tsx        # Editor workflow tự động
│   │   └── nodes/                    # Custom nodes cho workflow
│   ├── ActivityFeed.tsx              # Feed hoạt động hệ thống
│   ├── DarkModeToggle.tsx            # Toggle dark/light mode
│   ├── LayerControls.tsx             # Điều khiển layer bản đồ
│   ├── LoginForm.tsx                 # Form đăng nhập
│   ├── NotificationCenter.tsx        # Trung tâm thông báo
│   ├── ScreenshotButton.tsx          # Nút chụp màn hình
│   ├── ShareButton.tsx               # Nút chia sẻ
│   ├── Toast.tsx                     # Toast notification
│   └── ToastProvider.tsx             # Toast context provider
│
├── lib/                              # Libraries & Utilities
│   ├── db/                           # Database Models
│   │   ├── collections.ts            # MongoDB collections
│   │   ├── predictions.ts            # Model dự đoán
│   │   ├── schema.ts                 # Schema definitions
│   │   ├── sensor-rules.ts           # Model quy tắc cảm biến
│   │   ├── sensors.ts                # Model cảm biến
│   │   ├── user-reports.ts           # Model báo cáo người dùng
│   │   ├── users.ts                  # Model người dùng
│   │   └── zones.ts                  # Model vùng cảnh báo
│   ├── automation/                   # Automation Engine
│   │   └── rule-engine.ts            # Rule engine logic
│   ├── types/                        # TypeScript types
│   ├── auth.ts                       # Authentication helpers
│   ├── gcs.ts                        # Google Cloud Storage
│   ├── mongodb.ts                    # MongoDB connection
│   ├── news-analyzer.ts              # AI news analyzer
│   ├── notificationService.ts        # Notification service
│   ├── safeZones.ts                  # Safe zone calculation
│   ├── themeContext.tsx              # Theme context
│   ├── websocket.ts                  # WebSocket client
│   └── websocket-server.ts           # WebSocket server logic
│
├── public/                           # Static files
│
├── server.ts                         # Bun WebSocket Server
├── next.config.ts                    # Next.js configuration
├── tsconfig.json                     # TypeScript configuration
├── package.json                      # Dependencies
├── Dockerfile                        # Docker container config
├── docker-compose.yml                # Docker Compose config
├── ecosystem.config.js               # PM2 configuration
└── deploy.sh                         # Deployment script
```

---

## 🔧 CÔNG NGHỆ VÀ DEPENDENCIES

### Core Technologies

```json
{
  "runtime": "Bun 1.0+",
  "framework": "Next.js 16.0.3",
  "frontend": "React 19.2.0",
  "database": "MongoDB 7.0+",
  "realtime": "WebSocket (WS 8.18.3)",
  "language": "TypeScript 5"
}
```

### Key Dependencies

#### Frontend Libraries

- **@xyflow/react** (12.9.3): Workflow editor, visual automation
- **@vietmap/vietmap-gl-js** (6.0.1): Interactive maps
- **@fortawesome/react-fontawesome** (3.1.1): Icons
- **html2canvas** (1.4.1): Screenshot functionality
- **Tailwind CSS** (4): Styling framework

#### Backend Libraries

- **mongodb** (7.0.0): Database driver
- **bcryptjs** (3.0.3): Password hashing
- **ws** (8.18.3): WebSocket server
- **@google-cloud/storage** (7.18.0): File storage

#### Development Tools

- **TypeScript** (5): Type safety
- **ESLint** (9): Code linting
- **PostCSS**: CSS processing

---

## 💾 DATABASE SCHEMA

### Collections Overview

#### 1. **zones** - Vùng cảnh báo

```typescript
{
  _id: ObjectId,
  name: string,
  coordinates: [longitude, latitude][],  // Polygon coordinates
  type: "flood" | "outage" | "warning",
  severity: "low" | "medium" | "high" | "critical",
  createdAt: Date,
  createdBy: "system" | "user" | "sensor",
  description?: string,
  metadata?: {
    sensorId?: string,
    waterLevel?: number,
    affectedRoads?: string[]
  }
}
```

#### 2. **sensors** - Cảm biến

```typescript
{
  _id: ObjectId,
  sensorId: string,           // Unique identifier
  name: string,
  type: "water-level" | "rainfall" | "temperature",
  location: {
    lat: number,
    lng: number,
    address?: string
  },
  status: "active" | "inactive" | "error",
  lastReading?: {
    value: number,
    timestamp: Date
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### 3. **sensor_data** - Dữ liệu cảm biến

```typescript
{
  _id: ObjectId,
  sensorId: string,
  value: number,
  unit: string,
  timestamp: Date,
  metadata?: {
    battery?: number,
    signalStrength?: number
  }
}
```

#### 4. **sensor_rules** - Quy tắc tự động hóa

```typescript
{
  _id: ObjectId,
  name: string,
  description: string,
  enabled: boolean,
  workflow: {
    nodes: Node[],    // ReactFlow nodes
    edges: Edge[]     // ReactFlow edges
  },
  conditions: {
    sensorId?: string,
    operator: ">" | "<" | "==" | ">=" | "<=",
    threshold: number
  },
  actions: {
    type: "create_zone" | "send_notification",
    parameters: object
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### 5. **user_reports** - Báo cáo người dùng

```typescript
{
  _id: ObjectId,
  type: "flood" | "outage" | "traffic",
  location: {
    lat: number,
    lng: number,
    address?: string
  },
  description: string,
  severity: "low" | "medium" | "high",
  imageUrl?: string,
  status: "pending" | "approved" | "rejected",
  votes: {
    up: number,
    down: number
  },
  userId?: string,
  createdAt: Date,
  updatedAt: Date,
  reviewedBy?: string,
  reviewedAt?: Date
}
```

#### 6. **users** - Người dùng

```typescript
{
  _id: ObjectId,
  username: string,           // Unique
  password: string,           // Hashed with bcrypt
  role: "admin" | "user",
  email?: string,
  createdAt: Date,
  lastLogin?: Date
}
```

#### 7. **predictions** - Dự đoán

```typescript
{
  _id: ObjectId,
  type: "flood" | "outage",
  zoneId: string,
  riskLevel: number,          // 0-100
  estimatedTime?: number,     // minutes
  affectedAreas: string[],
  createdAt: Date,
  expiresAt: Date
}
```

#### 8. **activities** - Nhật ký hoạt động

```typescript
{
  _id: ObjectId,
  type: "zone_created" | "sensor_triggered" | "report_approved",
  description: string,
  userId?: string,
  metadata?: object,
  timestamp: Date
}
```

---

## 🔄 LUỒNG HOẠT ĐỘNG CHI TIẾT

### 1. Sensor Automation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  SENSOR AUTOMATION                          │
└─────────────────────────────────────────────────────────────┘

Step 1: Sensor gửi dữ liệu
  ↓
  POST /api/sensor-data
  Body: { sensorId, value, timestamp }

Step 2: Lưu vào database
  ↓
  Insert into sensor_data collection

Step 3: Rule Engine kiểm tra
  ↓
  getAllSensorRules() → Filter enabled rules

Step 4: Đánh giá điều kiện
  ↓
  For each rule:
    - Check if sensor matches
    - Evaluate condition (value > threshold)
    - Check workflow logic

Step 5: Thực thi action
  ↓
  If conditions met:
    - Create zone automatically
    - Send notification via WebSocket
    - Log activity

Step 6: Broadcast real-time
  ↓
  WebSocket → All connected clients
  Update map markers, zones, notifications
```

### 2. User Report Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  USER REPORT WORKFLOW                        │
└─────────────────────────────────────────────────────────────┘

Step 1: User tạo báo cáo
  ↓
  Click "Report Issue" → Open modal
  Select type (flood/outage/traffic)
  Add location (click map or search)
  Add description + photo
  Submit

Step 2: Upload ảnh (nếu có)
  ↓
  POST /api/upload
  Upload to Google Cloud Storage
  Return imageUrl

Step 3: Lưu báo cáo
  ↓
  POST /api/user-reports
  Store in MongoDB with status "pending"

Step 4: Broadcast thông báo
  ↓
  WebSocket notify admins
  Show in CommunityFeed for all users

Step 5: Community voting
  ↓
  POST /api/user-reports/vote?id=xxx
  Increment upvotes/downvotes

Step 6: Admin review
  ↓
  POST /api/user-reports/approve?id=xxx
  Update status to "approved" or "rejected"

Step 7: Nếu approved
  ↓
  Optionally create warning zone
  Send notification to nearby users
  Add to activity log
```

### 3. Workflow Automation Flow

```
┌─────────────────────────────────────────────────────────────┐
│               WORKFLOW EDITOR & EXECUTION                    │
└─────────────────────────────────────────────────────────────┘

Admin tạo workflow:
  ↓
  Open Workflow Editor (ReactFlow)

  Drag & Drop nodes:
    - Trigger nodes (sensor value)
    - Condition nodes (if/else)
    - Action nodes (create zone, notify)
    - Logic nodes (AND, OR)

  Connect nodes with edges

  Save workflow:
    POST /api/sensor-rules
    Store nodes & edges as JSON

Execution khi sensor gửi data:
  ↓
  Rule Engine loads workflow

  Traverse graph from trigger node:
    1. Evaluate trigger condition
    2. Follow edges to next nodes
    3. Execute condition checks
    4. Perform actions at leaf nodes
    5. Return execution result
```

### 4. Real-time Update Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  WEBSOCKET REAL-TIME                         │
└─────────────────────────────────────────────────────────────┘

Client connection:
  ↓
  WebSocket connect ws://localhost:3001/ws
  Add to clients Set

Server broadcasts:
  ↓
  Any data change (zone, sensor, report)
  → ws.send() to all clients

Client receives:
  ↓
  Message types:
    - "zone_created": Update map zones
    - "sensor_update": Update sensor markers
    - "report_new": Update community feed
    - "notification": Show toast

  Update UI accordingly without page reload
```

---

## 🔐 AUTHENTICATION & AUTHORIZATION

### Authentication System

```typescript
// Flow đăng nhập
POST /api/auth/login
  ↓
  Verify username/password with bcrypt
  ↓
  Set HttpOnly cookie with session ID
  ↓
  Return user info { id, username, role }

// Middleware protection
Request → Check cookie → Verify session
  ↓
  If valid: Allow access
  If invalid: Redirect to login
```

### Role-Based Access Control (RBAC)

```
Admin Role:
  ✓ Create/Edit/Delete zones
  ✓ Manage sensors
  ✓ Approve/Reject user reports
  ✓ Create automation rules
  ✓ View all activities
  ✓ Manage users

User Role:
  ✓ View map and zones
  ✓ Submit reports
  ✓ Vote on reports
  ✓ View notifications
  ✗ Cannot create zones
  ✗ Cannot manage sensors
```

### Initial Setup

```bash
# Tạo admin đầu tiên
POST /api/auth/init
Body: { username, password }

# Chỉ hoạt động khi chưa có admin nào
# Tự động tạo với role: "admin"
```

---

## 🗺️ MAP SYSTEM

### VietMap Integration

```typescript
// Map initialization
import vietmapgl from "@vietmap/vietmap-gl-js";

const map = new vietmapgl.Map({
  container: "map",
  apiKey: process.env.NEXT_PUBLIC_VIETMAP_API_KEY,
  center: [106.6297, 10.8231], // Ho Chi Minh City
  zoom: 12,
});
```

### Layer Management

```
Layers (từ dưới lên trên):
  1. Base map (VietMap tiles)
  2. Zones polygons (flood/outage areas)
  3. User reports markers
  4. Sensor markers
  5. Route lines (safe routes)
  6. Search results
```

### Features

1. **Drawing Tools**: Vẽ polygon để tạo zone
2. **Geocoding**: Tìm kiếm địa điểm
3. **Routing**: Tìm đường tránh vùng nguy hiểm
4. **Clustering**: Group markers khi zoom out
5. **Popups**: Show thông tin khi click marker/zone

---

## 📡 API ENDPOINTS REFERENCE

### Authentication

```
POST   /api/auth/login          # Đăng nhập
POST   /api/auth/register       # Đăng ký
POST   /api/auth/logout         # Đăng xuất
GET    /api/auth/me            # Lấy thông tin user hiện tại
POST   /api/auth/init          # Khởi tạo admin đầu tiên
```

### Zones

```
GET    /api/zones              # Lấy tất cả zones
POST   /api/zones              # Tạo zone mới (admin)
PUT    /api/zones/[id]         # Cập nhật zone (admin)
DELETE /api/zones/[id]         # Xóa zone (admin)
```

### Sensors

```
GET    /api/sensors            # Lấy tất cả sensors
POST   /api/sensors            # Tạo sensor mới (admin)
GET    /api/sensor-data        # Lấy lịch sử data
POST   /api/sensor-data        # Gửi sensor reading
```

### Automation

```
GET    /api/sensor-rules       # Lấy automation rules
POST   /api/sensor-rules       # Tạo rule mới (admin)
PUT    /api/sensor-rules?id=x  # Cập nhật rule (admin)
DELETE /api/sensor-rules?id=x  # Xóa rule (admin)
```

### User Reports

```
GET    /api/user-reports       # Lấy tất cả reports
POST   /api/user-reports       # Tạo report mới
PUT    /api/user-reports?id=x  # Cập nhật status (admin)
DELETE /api/user-reports?id=x  # Xóa report (admin)
POST   /api/user-reports/vote?id=x  # Vote report
POST   /api/user-reports/approve?id=x # Phê duyệt (admin)
```

### Other

```
GET    /api/weather            # Lấy thông tin thời tiết
POST   /api/upload             # Upload file/ảnh
GET    /api/predictions        # Lấy dự đoán
GET    /api/activities         # Lấy nhật ký hoạt động
POST   /api/ai-crawler         # Thu thập tin tức AI
```

---

## 🚀 DEPLOYMENT

### Docker Deployment

```yaml
# docker-compose.yml
services:
  app:
    - Bun runtime
    - Port 3001 (WebSocket + HTTP)
    - Port 3002 (Next.js)

  mongo:
    - MongoDB 7
    - Port 27017
    - Persistent volume
```

### PM2 Deployment

```javascript
// ecosystem.config.js
{
  name: "svattt-app",
  script: "server.ts",
  interpreter: "bun",
  instances: 1,
  env: {
    NODE_ENV: "production",
    PORT: 3001
  }
}
```

### Environment Variables

```env
# Required
MONGODB_URI=mongodb://localhost:27017/svattt
NEXT_PUBLIC_VIETMAP_API_KEY=your_api_key

# Optional
PORT=3001
NODE_ENV=production
GOOGLE_CLOUD_PROJECT_ID=your_project
GOOGLE_CLOUD_BUCKET=your_bucket
```

---

## 🎯 TÍNH NĂNG CHÍNH

### 1. ✅ Real-time Monitoring

- WebSocket connection cho updates tức thì
- Live sensor data streaming
- Automatic UI refresh khi có thay đổi

### 2. 🌊 Flood Detection

- Sensor-based flood detection
- Automatic zone creation
- Risk level classification (low/medium/high/critical)

### 3. 🚗 Traffic Outage Alerts

- User-generated reports
- Community voting system
- Admin verification process

### 4. 🤖 Automation System

- Visual workflow editor (ReactFlow)
- Rule-based automation
- Condition & action nodes
- Flexible sensor triggers

### 5. 📍 Interactive Map

- VietMap integration
- Drawing tools
- Layer controls
- Safe route finding

### 6. 📱 Community Features

- User reports with photos
- Vote system
- Activity feed
- Notification center

### 7. 🔐 Security

- Password hashing (bcrypt)
- Role-based access control
- HttpOnly cookies
- Session management

### 8. 📊 Admin Dashboard

- Zone management
- Sensor management
- Report moderation
- User management
- Automation rules

---

## 🔧 CONFIGURATION FILES

### next.config.ts

```typescript
// Minimal configuration
// Uses default Next.js 16 settings
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"] // Path alias
    }
  }
}
```

### tailwind.config

```javascript
// Tailwind CSS 4 with PostCSS
// Custom colors and themes
```

---

## 📊 SYSTEM PERFORMANCE

### Scalability Considerations

1. **WebSocket Connections**
   - Current: In-memory Set
   - Scale: Use Redis pub/sub for multiple instances

2. **Database**
   - Indexes on frequently queried fields
   - TTL indexes for sensor_data cleanup

3. **File Storage**
   - Google Cloud Storage for images
   - CDN for static assets

### Optimization Strategies

1. **Frontend**
   - React 19 concurrent features
   - Component lazy loading
   - Image optimization

2. **Backend**
   - Bun's fast JavaScript runtime
   - Connection pooling (MongoDB)
   - Response caching

3. **Database**
   - Proper indexing
   - Query optimization
   - Aggregation pipelines

---

## 🐛 ERROR HANDLING

### API Error Responses

```typescript
{
  error: string,
  message?: string,
  details?: object
}
```

### Common Status Codes

```
200 - Success
201 - Created
400 - Bad Request
401 - Unauthorized
403 - Forbidden
404 - Not Found
500 - Internal Server Error
```

### WebSocket Error Handling

```typescript
// Client-side reconnection logic
- Max 5 reconnect attempts
- 3 second delay between attempts
- Exponential backoff
```

---

## 📝 LOGGING & MONITORING

### Activity Logging

```typescript
// Logged events
- User login/logout
- Zone created/updated/deleted
- Sensor triggered
- Report approved/rejected
- Rule execution
```

### Console Logging

```typescript
// WebSocket events
console.log("Client connected");
console.log("Client disconnected");
console.log("Received:", data);

// Rule execution
console.log("Rules triggered:", count);
console.log("Zones created:", zoneIds);
```

---

## 🔮 FUTURE ENHANCEMENTS

### Potential Features

1. **Mobile App**: React Native version
2. **Email Notifications**: Alert via email
3. **SMS Integration**: Critical alerts via SMS
4. **Advanced Analytics**: Dashboard with charts
5. **Weather API**: Real-time weather integration
6. **AI Predictions**: Machine learning for flood prediction
7. **Multi-language**: i18n support
8. **Export Reports**: PDF/Excel export
9. **Historical Data**: Time-series analysis
10. **Public API**: REST API for third-party integration

### Technical Improvements

1. **Testing**: Unit & integration tests
2. **CI/CD**: Automated deployment pipeline
3. **Monitoring**: Application performance monitoring
4. **Documentation**: API documentation (Swagger)
5. **Rate Limiting**: API throttling
6. **Caching**: Redis for performance
7. **Load Balancing**: Multi-instance support

---

## 📚 DEPENDENCIES SUMMARY

### Production (15 packages)

- Next.js 16.0.3
- React 19.2.0
- MongoDB 7.0.0
- WS 8.18.3
- @xyflow/react 12.9.3
- @vietmap/vietmap-gl-js 6.0.1
- bcryptjs 3.0.3
- @google-cloud/storage 7.18.0
- FontAwesome icons
- html2canvas 1.4.1

### Development (10 packages)

- TypeScript 5
- ESLint 9
- Tailwind CSS 4
- Type definitions

---

## 🎓 HƯỚNG DẪN SỬ DỤNG

### Cho Developers

```bash
# Clone project
git clone <repo-url>
cd svattt

# Install dependencies
bun install

# Setup environment
cp .env.example .env.local
# Edit .env.local với API keys

# Start MongoDB
docker run -d -p 27017:27017 mongo:7

# Run development
bun run dev          # Terminal 1: WebSocket server
bun run dev:next     # Terminal 2: Next.js dev server

# Access
http://localhost:3002
```

### Cho Admins

1. **Khởi tạo hệ thống**
   - POST /api/auth/init với admin credentials
   - Login vào hệ thống

2. **Cấu hình sensors**
   - Vào Admin Panel
   - Thêm sensors với location và type
   - Lấy sensorId để cấu hình thiết bị vật lý

3. **Tạo automation rules**
   - Mở Workflow Editor
   - Kéo thả nodes để tạo logic
   - Save và enable rule

4. **Quản lý reports**
   - Xem Community Feed
   - Approve/Reject reports
   - Tạo zone từ reports nếu cần

---

## 📞 SUPPORT & RESOURCES

- **GitHub Issues**: Báo lỗi và góp ý
- **Documentation**: README.md
- **License**: Apache 2.0 (see LICENSE file)
- **API Docs**: Inline trong code

---

## 🏁 KẾT LUẬN

FORMS-app là một hệ thống hoàn chỉnh cho cảnh báo ngập lụt và sự cố giao thông với:

✅ **Architecture vững chắc**: Next.js + MongoDB + WebSocket
✅ **Real-time capabilities**: WebSocket cho updates tức thì
✅ **Automation**: Rule engine và workflow editor
✅ **Scalability**: Có thể mở rộng với Redis và load balancer
✅ **Security**: Authentication và RBAC
✅ **User-friendly**: Interactive map và community features

Hệ thống sẵn sàng cho production deployment và có thể mở rộng thêm nhiều tính năng trong tương lai.

---

**Phân tích này được tạo vào**: 2025-12-09
