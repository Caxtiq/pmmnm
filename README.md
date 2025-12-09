
<p align="center">
  <img src="docs/FORMS_logo.png" alt="FORMS Logo" width="600"/>
</p>

<h1 align="center">
  🚦 Flood and Outage Risk Management System 🌧️
</h1>

<p align="center">
  <img src="https://img.shields.io/badge/Competition-OLP__2025-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/License-Apache__2.0-green?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Version-1.1.0-green?style=for-the-badge" />
</p>

## Tính năng và Công nghệ

### Tính năng chính
- 🗺️ Bản đồ tương tác tích hợp VietMap  
- 📡 Giám sát dữ liệu cảm biến theo thời gian thực  
- 🌊 Phát hiện khu vực ngập tự động  
- ⚡ Cảnh báo gián đoạn giao thông  
- 📊 Trình chỉnh sửa workflow tự động  
- 📢 Quản lý báo cáo người dùng  
- 🌤️ Tích hợp dữ liệu thời tiết  
- 🔄 Cập nhật dữ liệu theo thời gian thực qua WebSocket  

### Công nghệ sử dụng
- **Framework**: Next.js 16 + React 19  
- **Runtime**: Bun  
- **Database**: MongoDB  
- **Bản đồ**: VietMap GL JS  
- **Giao diện**: Tailwind CSS  
- **Realtime**: WebSocket (WS)  
- **Tự động hóa**: ReactFlow  

## Yêu cầu hệ thống
- **Bun** >= 1.0  
- **MongoDB** >= 7.0  
- **VietMap API Key** (lấy tại [VietMap Developer](https://maps.vietmap.vn/))  

## Cài đặt

1. **Clone repository**
```bash
git clone <your-repo-url>
cd svattt
```

2. **Cài đặt dependencies**
```bash
bun install
```

3. **Cấu hình biến môi trường**
```bash
cp .env.example .env.local
```

Chỉnh sửa `.env.local`:
```env
MONGODB_URI=mongodb://localhost:27017/svattt
NEXT_PUBLIC_VIETMAP_API_KEY=your_api_key_here
PORT=3001
```

4. **Khởi động MongoDB**
```bash
# Dùng Docker
docker run -d -p 27017:27017 --name mongodb mongo:7

# Hoặc dùng MongoDB local
mongod
```

5. **Chạy ứng dụng ở chế độ phát triển**

**Terminal 1 – WebSocket Server:**
```bash
bun run dev
```

**Terminal 2 – Next.js Dev Server:**
```bash
bun run dev:next
```

6. **Truy cập ứng dụng**
- Frontend: http://localhost:3001  
- WebSocket: ws://localhost:3001/ws  

## Triển khai Production

### Cách 1: Docker (Khuyến nghị)
```bash
cp .env.example .env
nano .env
docker-compose up -d
docker-compose logs -f app
```

### Cách 2: VPS với PM2
```bash
npm install -g pm2
cp .env.example .env
nano .env
bun install
bun run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

**Triển khai tự động:**
```bash
chmod +x deploy.sh
./deploy.sh
```

### Cách 3: Triển khai thủ công trên VPS
```bash
curl -fsSL https://bun.sh/install | bash
git clone <your-repo>
cd svattt
bun install
bun run build
NODE_ENV=production bun run start
```

## Biến môi trường

| Biến | Mô tả | Bắt buộc | Mặc định |
|------|--------|----------|----------|
| `MONGODB_URI` | Chuỗi kết nối MongoDB | Có | - |
| `NEXT_PUBLIC_VIETMAP_API_KEY` | API key VietMap | Có | - |
| `PORT` | Cổng chạy server | Không | 3001 |
| `NODE_ENV` | Chế độ môi trường | Không | development |

## API Endpoints

### Zones
- `GET /api/zones` – Lấy danh sách zones  
- `POST /api/zones` – Tạo zone mới  
- `PUT /api/zones/[id]` – Cập nhật zone  
- `DELETE /api/zones/[id]` – Xóa zone  

### Sensors
- `GET /api/sensors` – Lấy tất cả sensors  
- `POST /api/sensors` – Tạo sensor  
- `POST /api/sensor-data` – Gửi dữ liệu sensor  
- `GET /api/sensor-data` – Lịch sử dữ liệu sensor  

### User Reports
- `GET /api/user-reports` – Lấy danh sách báo cáo  
- `POST /api/user-reports` – Gửi báo cáo  
- `PUT /api/user-reports?id=xxx` – Cập nhật trạng thái  
- `DELETE /api/user-reports?id=xxx` – Xóa báo cáo  

### Automation
- `GET /api/sensor-rules` – Lấy danh sách rule  
- `POST /api/sensor-rules` – Tạo rule  
- `PUT /api/sensor-rules?id=xxx` – Cập nhật rule  
- `DELETE /api/sensor-rules?id=xxx` – Xóa rule  

## Kiểm tra dữ liệu sensor

```bash
curl http://localhost:3001/api/sensors

curl -X POST http://localhost:3001/api/sensor-data   -H "Content-Type: application/json"   -d '{"sensorId":"sensor-123","value":10.5}'
```

## Cấu trúc dự án

```
svattt/
├── app/                    # Thư mục app của Next.js
│   ├── api/               # API routes
│   ├── page.tsx          # Trang chính
│   └── layout.tsx        # Layout gốc
├── components/            # Các component React
│   └── Maps/             # Các component liên quan bản đồ
├── lib/                   # Utilities và thư viện
│   ├── db/               # Models database
│   ├── automation/       # Rule engine
│   └── websocket.ts      # WebSocket client
├── server.ts             # WebSocket server tùy chỉnh
├── Dockerfile            # Cấu hình Docker
├── docker-compose.yml    # Docker Compose
└── ecosystem.config.js   # Cấu hình PM2
```

## Giám sát

### Lệnh PM2:
```bash
pm2 status
pm2 logs svattt-app
pm2 restart svattt-app
pm2 stop svattt-app
pm2 delete svattt-app
```

### Lệnh Docker:
```bash
docker-compose ps
docker-compose logs -f app
docker-compose restart app
docker-compose down
```

## License

Apache License 2.0 – Xem file LICENSE để biết chi tiết.

## Hỗ trợ

Nếu có lỗi hoặc thắc mắc, vui lòng mở issue trên GitHub.

## Triển khai lên Vercel

Sử dụng nền tảng Vercel để triển khai Next.js dễ dàng hơn.  
Xem thêm tài liệu triển khai Next.js để biết chi tiết.
