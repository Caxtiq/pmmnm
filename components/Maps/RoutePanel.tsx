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

'use client';
import { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRoute, faTimes, faSpinner, faMapMarkerAlt, faFlag, faLifeRing } from '@fortawesome/free-solid-svg-icons';
import vietmapgl from '@vietmap/vietmap-gl-js/dist/vietmap-gl.js';
import { findNearestSafeZones, formatDistance, getSafeZoneIcon, SafeZone } from '@/lib/safeZones';
import { useToast } from '../ToastProvider';

interface RoutePanelProps {
  map: vietmapgl.Map | null;
  zones: Array<{
    id: string;
    type: 'flood' | 'outage';
    shape: 'circle' | 'line';
    center?: number[];
    radius?: number;
    coordinates?: number[][];
  }>;
  onMapClick: (handler: ((e: any) => void) | null) => void;
}

interface RouteInstruction {
  distance: number;
  text: string;
  time: number;
  street_name: string;
  sign: number;
}

interface RouteResult {
  distance: number;
  time: number;
  points: string | number[][];
  instructions: RouteInstruction[];
  points_encoded: boolean;
}

export default function RoutePanel({ map, zones, onMapClick }: RoutePanelProps) {
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [origin, setOrigin] = useState<[number, number] | null>(null);
  const [destination, setDestination] = useState<[number, number] | null>(null);
  const [isSelectingOrigin, setIsSelectingOrigin] = useState(false);
  const [isSelectingDestination, setIsSelectingDestination] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [vehicle, setVehicle] = useState<'car' | 'bike' | 'motorcycle' | 'foot'>('car');
  const [avoidFloodZones, setAvoidFloodZones] = useState(true);
  const [isEvacuationMode, setIsEvacuationMode] = useState(false);
  const [nearestSafeZone, setNearestSafeZone] = useState<any>(null);

  const decodePolyline = (encoded: string): number[][] => {
    const points: number[][] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let b;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push([lng / 1e5, lat / 1e5]);
    }
    return points;
  };

  const checkRouteIntersectsZones = (routePoints: number[][]): boolean => {
    if (!avoidFloodZones) return false;

    const floodZones = zones.filter(z => z.type === 'flood');
    
    for (const point of routePoints) {
      for (const zone of floodZones) {
        if (zone.shape === 'circle' && zone.center && zone.radius) {
          const distance = getDistance(point, zone.center);
          if (distance < zone.radius) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const getDistance = (point1: number[], point2: number[]): number => {
    const R = 6371e3;
    const φ1 = point1[1] * Math.PI / 180;
    const φ2 = point2[1] * Math.PI / 180;
    const Δφ = (point2[1] - point1[1]) * Math.PI / 180;
    const Δλ = (point2[0] - point1[0]) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const handleMapClick = useCallback((e: any) => {
    console.log('Route click handler called', e, isSelectingOrigin, isSelectingDestination);
    if (!e || !e.lngLat) {
      console.log('No lngLat in event');
      return;
    }
    
    const { lng, lat } = e.lngLat;
    console.log('Clicked at', lng, lat);
    
    if (isSelectingOrigin) {
      console.log('Setting origin');
      setOrigin([lng, lat]);
      setIsSelectingOrigin(false);
      if (map) {
        new vietmapgl.Marker({ color: '#10b981' })
          .setLngLat([lng, lat])
          .addTo(map);
      }
    } else if (isSelectingDestination) {
      console.log('Setting destination');
      setDestination([lng, lat]);
      setIsSelectingDestination(false);
      if (map) {
        new vietmapgl.Marker({ color: '#ef4444' })
          .setLngLat([lng, lat])
          .addTo(map);
      }
    }
  }, [isSelectingOrigin, isSelectingDestination, map]);

  // Set up map click listener when selecting points
  useEffect(() => {
    if (isSelectingOrigin || isSelectingDestination) {
      onMapClick(handleMapClick);
    } else {
      onMapClick(null);
    }
    
    return () => {
      if (!isSelectingOrigin && !isSelectingDestination) {
        onMapClick(null);
      }
    };
  }, [isSelectingOrigin, isSelectingDestination, handleMapClick, onMapClick]);

  const calculateRouteWithWaypoints = async (waypoints: [number, number][]): Promise<any> => {
    const apiKey = process.env.NEXT_PUBLIC_VIETMAP_API_KEY;
    const pointsParam = waypoints.map(p => `point=${p[1]},${p[0]}`).join('&');
    const url = `https://smartlog-lc.map.zone/api/route/v3?apikey=${apiKey}&${pointsParam}&vehicle=${vehicle}&points_encoded=true`;

    const response = await fetch(url);
    const data = await response.json();
    return data;
  };

  const findIntermediatePoint = (start: [number, number], end: [number, number], avoidZone: { center: number[], radius: number }): [number, number] | null => {
    // Calculate perpendicular offset points to route around the zone
    const midLat = (start[1] + end[1]) / 2;
    const midLng = (start[0] + end[0]) / 2;
    
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const length = Math.sqrt(dx * dx + dy * dy);
    
    // Perpendicular vector
    const perpX = -dy / length;
    const perpY = dx / length;
    
    // Offset distance (zone radius + 20% buffer)
    const offsetDist = (avoidZone.radius / 111320) * 1.2;
    
    // Try both sides
    const offset1: [number, number] = [midLng + perpX * offsetDist, midLat + perpY * offsetDist];
    const offset2: [number, number] = [midLng - perpX * offsetDist, midLat - perpY * offsetDist];
    
    // Return the point that's furthest from the zone center
    const dist1 = getDistance(offset1, avoidZone.center);
    const dist2 = getDistance(offset2, avoidZone.center);
    
    return dist1 > dist2 ? offset1 : offset2;
  };

  const calculateRoute = async () => {
    if (!origin || !destination) return;

    setIsLoading(true);
    try {
      // Try direct route first
      let data = await calculateRouteWithWaypoints([origin, destination]);

      if (data.code === 'OK' && data.paths && data.paths.length > 0) {
        let path = data.paths[0];
        let routePoints = path.points_encoded 
          ? decodePolyline(path.points)
          : path.points;

        // Check if route passes through flood zones
        let hasWarning = avoidFloodZones && checkRouteIntersectsZones(routePoints);

        // If avoiding zones and route intersects, try to find alternative
        if (hasWarning && avoidFloodZones) {
          console.log('Route intersects flood zone, calculating alternative...');
          
          // Find which zones are intersected
          const floodZones = zones.filter(z => z.type === 'flood' && z.shape === 'circle' && z.center && z.radius);
          const intersectedZones: Array<{center: number[], radius: number}> = [];
          
          for (const zone of floodZones) {
            if (zone.center && zone.radius) {
              for (const point of routePoints) {
                const distance = getDistance(point, zone.center);
                if (distance < zone.radius) {
                  intersectedZones.push({ center: zone.center, radius: zone.radius });
                  break;
                }
              }
            }
          }

          // Try to route around the zones by adding waypoints
          if (intersectedZones.length > 0) {
            const waypoint = findIntermediatePoint(origin, destination, intersectedZones[0]);
            
            if (waypoint) {
              console.log('Trying alternative route via waypoint:', waypoint);
              const altData = await calculateRouteWithWaypoints([origin, waypoint, destination]);
              
              if (altData.code === 'OK' && altData.paths && altData.paths.length > 0) {
                const altPath = altData.paths[0];
                const altRoutePoints = altPath.points_encoded 
                  ? decodePolyline(altPath.points)
                  : altPath.points;
                
                const altHasWarning = checkRouteIntersectsZones(altRoutePoints);
                
                // Use alternative if it avoids zones or is not much longer
                if (!altHasWarning || (altPath.distance < path.distance * 1.5)) {
                  path = altPath;
                  routePoints = altRoutePoints;
                  hasWarning = altHasWarning;
                  console.log('Using alternative route');
                }
              }
            }
          }
        }

        if (hasWarning) {
          showToast('Cảnh báo: Không thể tránh hoàn toàn vùng ngập lụt. Tuyến đường hiển thị là tốt nhất có thể.', 'warning');
        }

        setRoute({
          distance: path.distance,
          time: path.time,
          points: path.points,
          instructions: path.instructions,
          points_encoded: path.points_encoded
        });

        // Draw route on map
        if (map) {
          const geojson = {
            type: 'Feature' as const,
            geometry: {
              type: 'LineString' as const,
              coordinates: routePoints
            },
            properties: {}
          };

          if (map.getSource('route')) {
            (map.getSource('route') as any).setData(geojson);
          } else {
            map.addSource('route', {
              type: 'geojson',
              data: geojson as any
            });

            map.addLayer({
              id: 'route-line',
              type: 'line',
              source: 'route',
              paint: {
                'line-color': hasWarning ? '#f59e0b' : '#3b82f6',
                'line-width': 6,
                'line-opacity': 0.8
              }
            });

            map.addLayer({
              id: 'route-outline',
              type: 'line',
              source: 'route',
              paint: {
                'line-color': '#ffffff',
                'line-width': 8,
                'line-opacity': 0.4
              }
            }, 'route-line');
          }
        }
      }
    } catch (error) {
      console.error('Failed to calculate route:', error);
      showToast('Không thể tính toán tuyến đường', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const clearRoute = () => {
    setOrigin(null);
    setDestination(null);
    setRoute(null);
    setIsSelectingOrigin(false);
    setIsSelectingDestination(false);

    if (map) {
      if (map.getLayer('route-line')) {
        map.removeLayer('route-line');
      }
      if (map.getLayer('route-outline')) {
        map.removeLayer('route-outline');
      }
      if (map.getSource('route')) {
        map.removeSource('route');
      }
      
      // Remove markers
      const markers = document.querySelectorAll('.maplibregl-marker');
      markers.forEach(marker => marker.remove());
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-44 right-4 z-30 bg-blue-600 text-white p-4 rounded-full shadow-2xl hover:bg-blue-700 transition-all hover:shadow-xl"
      >
        <FontAwesomeIcon icon={faRoute} size="lg" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-24 right-4 z-35 bg-white rounded-2xl shadow-2xl w-96 max-h-[80vh] overflow-y-auto">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-blue-600 text-white rounded-t-2xl">
        <h3 className="font-bold text-lg">Tìm Đường</h3>
        <button onClick={() => setIsOpen(false)} className="hover:bg-blue-700 p-2 rounded-lg transition-colors">
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Mode Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setIsEvacuationMode(false)}
            className={`flex-1 px-4 py-2 rounded-xl font-semibold transition-colors ${
              !isEvacuationMode 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <FontAwesomeIcon icon={faRoute} className="mr-2" />
            Thông thường
          </button>
          <button
            onClick={() => {
              setIsEvacuationMode(true);
              if (origin) {
                const nearest = findNearestSafeZones(origin, 5);
                setNearestSafeZone(nearest[0]);
                setDestination(nearest[0].location);
              }
            }}
            className={`flex-1 px-4 py-2 rounded-xl font-semibold transition-colors ${
              isEvacuationMode 
                ? 'bg-red-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <FontAwesomeIcon icon={faLifeRing} className="mr-2" />
            Sơ tán
          </button>
        </div>

        {/* Evacuation Info */}
        {isEvacuationMode && nearestSafeZone && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <span className="text-2xl">{getSafeZoneIcon(nearestSafeZone.type)}</span>
              <div className="flex-1">
                <h4 className="font-bold text-red-900">{nearestSafeZone.name}</h4>
                <p className="text-sm text-red-700">{nearestSafeZone.address}</p>
                <p className="text-xs text-red-600 mt-1">
                  📍 {formatDistance(nearestSafeZone.distance)}
                </p>
                {nearestSafeZone.capacity && (
                  <p className="text-xs text-red-600">
                    👥 Sức chứa: {nearestSafeZone.capacity} người
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Vehicle Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Phương tiện</label>
          <select
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value as any)}
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 text-gray-900"
          >
            <option value="car">🚗 Ô tô</option>
            <option value="motorcycle">🏍️ Xe máy</option>
            <option value="bike">🚴 Xe đạp</option>
            <option value="foot">🚶 Đi bộ</option>
          </select>
        </div>

        {/* Avoid Flood Zones */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={avoidFloodZones}
            onChange={(e) => setAvoidFloodZones(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-900">Cảnh báo vùng ngập</span>
        </label>

        {/* Origin */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            <FontAwesomeIcon icon={faMapMarkerAlt} className="text-green-600 mr-2" />
            Điểm xuất phát
          </label>
          <button
            onClick={() => setIsSelectingOrigin(true)}
            className={`w-full px-3 py-2 border-2 rounded-xl text-sm transition-all ${
              isSelectingOrigin
                ? 'border-green-500 bg-green-50 text-green-700'
                : origin
                ? 'border-gray-200 bg-gray-50 text-gray-900'
                : 'border-gray-200 hover:border-green-500 text-gray-500'
            }`}
          >
            {origin ? `${origin[1].toFixed(5)}, ${origin[0].toFixed(5)}` : 'Nhấn để chọn trên bản đồ'}
          </button>
        </div>

        {/* Destination */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            <FontAwesomeIcon icon={faFlag} className="text-red-600 mr-2" />
            Điểm đến
          </label>
          <button
            onClick={() => setIsSelectingDestination(true)}
            className={`w-full px-3 py-2 border-2 rounded-xl text-sm transition-all ${
              isSelectingDestination
                ? 'border-red-500 bg-red-50 text-red-700'
                : destination
                ? 'border-gray-200 bg-gray-50 text-gray-900'
                : 'border-gray-200 hover:border-red-500 text-gray-500'
            }`}
          >
            {destination ? `${destination[1].toFixed(5)}, ${destination[0].toFixed(5)}` : 'Nhấn để chọn trên bản đồ'}
          </button>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={calculateRoute}
            disabled={!origin || !destination || isLoading}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          >
            {isLoading ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Tìm Đường'}
          </button>
          <button
            onClick={clearRoute}
            className="px-4 py-2.5 bg-gray-200 text-gray-900 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
          >
            Xóa
          </button>
        </div>

        {/* Route Info */}
        {route && (
          <div className="mt-4 p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-900">Khoảng cách</span>
              <span className="text-lg font-bold text-blue-600">{(route.distance / 1000).toFixed(1)} km</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">Thời gian</span>
              <span className="text-lg font-bold text-blue-600">{Math.round(route.time / 60000)} phút</span>
            </div>
          </div>
        )}

        {/* Instructions */}
        {route && route.instructions && (
          <div className="mt-4">
            <h4 className="font-bold text-gray-900 mb-2">Chỉ dẫn đường đi</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {route.instructions.map((instruction, index) => (
                <div key={index} className="p-2 bg-gray-50 rounded-lg text-sm">
                  <div className="font-medium text-gray-900">{instruction.text}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {(instruction.distance / 1000).toFixed(1)} km • {Math.round(instruction.time / 60000)} phút
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
