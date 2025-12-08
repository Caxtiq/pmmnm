/*
 * Copyright 2025 PKA-OpenLD
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export interface SafeZone {
  id: string;
  name: string;
  type: "shelter" | "hospital" | "high_ground" | "government";
  location: [number, number];
  capacity?: number;
  address: string;
  phone?: string;
  facilities: string[];
  available: boolean;
}

export const safeZones: SafeZone[] = [
  // Hanoi Safe Zones
  {
    id: "sz-1",
    name: "Bệnh viện Bạch Mai",
    type: "hospital",
    location: [105.8434, 21.0032],
    capacity: 500,
    address: "78 Đường Giải Phóng, Phương Mai, Đống Đa, Hà Nội",
    phone: "024 3869 3731",
    facilities: ["Cấp cứu 24/7", "Phẫu thuật", "ICU", "Điện dự phòng"],
    available: true,
  },
  {
    id: "sz-2",
    name: "Nhà Văn hóa Thanh Niên",
    type: "shelter",
    location: [105.8261, 21.0279],
    capacity: 1000,
    address: "Số 1 Phạm Ngọc Thạch, Đống Đa, Hà Nội",
    phone: "024 3823 3881",
    facilities: [
      "Nơi trú ẩn tạm thời",
      "Nhà vệ sinh",
      "Nước sạch",
      "Điện",
      "Wifi",
    ],
    available: true,
  },
  {
    id: "sz-3",
    name: "Bệnh viện 108",
    type: "hospital",
    location: [105.8133, 21.0022],
    capacity: 800,
    address: "1 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội",
    phone: "024 3829 1188",
    facilities: ["Cấp cứu", "Phẫu thuật", "Điều trị đa khoa", "Điện dự phòng"],
    available: true,
  },
  {
    id: "sz-4",
    name: "Trung tâm Hội nghị Quốc gia",
    type: "shelter",
    location: [105.8045, 21.0329],
    capacity: 2000,
    address: "Mỹ Đình 2, Nam Từ Liêm, Hà Nội",
    phone: "024 3768 2020",
    facilities: [
      "Diện tích rộng",
      "Hệ thống điều hòa",
      "Điện dự phòng",
      "Bãi đỗ xe",
    ],
    available: true,
  },
  {
    id: "sz-5",
    name: "UBND Thành phố Hà Nội",
    type: "government",
    location: [105.8342, 21.0245],
    capacity: 300,
    address: "Số 12 Lê Lai, Tràng Tiền, Hoàn Kiếm, Hà Nội",
    phone: "024 3825 4854",
    facilities: [
      "Điều phối khẩn cấp",
      "Trung tâm chỉ huy",
      "Thông tin liên lạc",
    ],
    available: true,
  },
  {
    id: "sz-6",
    name: "Sân vận động Mỹ Đình",
    type: "high_ground",
    location: [105.7651, 21.0293],
    capacity: 5000,
    address: "Đường Lê Đức Thọ, Mỹ Đình, Nam Từ Liêm, Hà Nội",
    facilities: ["Vị trí cao", "Diện tích lớn", "Nước sạch", "Điện"],
    available: true,
  },
  {
    id: "sz-7",
    name: "Bệnh viện E",
    type: "hospital",
    location: [105.8437, 21.0156],
    capacity: 600,
    address: "87-89 Trần Cung, Nghĩa Tân, Cầu Giấy, Hà Nội",
    phone: "024 3869 3731",
    facilities: ["Cấp cứu 24/7", "Khoa đa khoa", "ICU", "Điện dự phòng"],
    available: true,
  },
  {
    id: "sz-8",
    name: "Trường Đại học Quốc gia Hà Nội",
    type: "shelter",
    location: [105.7904, 21.0373],
    capacity: 3000,
    address: "144 Xuân Thủy, Cầu Giấy, Hà Nội",
    phone: "024 3754 7506",
    facilities: ["Ký túc xá", "Căng tin", "Y tế", "Điện dự phòng", "Nước sạch"],
    available: true,
  },
  {
    id: "sz-9",
    name: "Công viên Thống Nhất",
    type: "high_ground",
    location: [105.8347, 21.0175],
    capacity: 2000,
    address: "Lê Duẩn, Đống Đa, Hà Nội",
    facilities: ["Không gian mở", "Vị trí cao", "Dễ tiếp cận"],
    available: true,
  },
  {
    id: "sz-10",
    name: "Bệnh viện Việt Đức",
    type: "hospital",
    location: [105.8448, 21.023],
    capacity: 700,
    address: "40 Tràng Thi, Hoàn Kiếm, Hà Nội",
    phone: "024 3825 3531",
    facilities: [
      "Cấp cứu ngoại khoa",
      "Phẫu thuật",
      "ICU",
      "Bệnh viện chất lượng cao",
    ],
    available: true,
  },
];

// Calculate distance using Haversine formula
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Find nearest safe zones
export function findNearestSafeZones(
  location: [number, number],
  count: number = 5,
  type?: SafeZone["type"],
): Array<SafeZone & { distance: number }> {
  let zones = safeZones.filter((z) => z.available);

  if (type) {
    zones = zones.filter((z) => z.type === type);
  }

  return zones
    .map((zone) => ({
      ...zone,
      distance: calculateDistance(
        location[1],
        location[0],
        zone.location[1],
        zone.location[0],
      ),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count);
}

// Format distance
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

// Get safe zone icon
export function getSafeZoneIcon(type: SafeZone["type"]): string {
  switch (type) {
    case "hospital":
      return "🏥";
    case "shelter":
      return "🏢";
    case "high_ground":
      return "⛰️";
    case "government":
      return "🏛️";
    default:
      return "📍";
  }
}

// Get safe zone color
export function getSafeZoneColor(type: SafeZone["type"]): string {
  switch (type) {
    case "hospital":
      return "#ef4444"; // red
    case "shelter":
      return "#3b82f6"; // blue
    case "high_ground":
      return "#10b981"; // green
    case "government":
      return "#8b5cf6"; // purple
    default:
      return "#6b7280"; // gray
  }
}
