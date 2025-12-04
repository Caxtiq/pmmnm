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

"use client";
import "@vietmap/vietmap-gl-js/dist/vietmap-gl.css";
import { useState, useEffect, useRef } from "react";
import AdminPanel from "./AdminPanel";

import { Sensor, Zone } from "./types";

import { calculateDistance, createCircleCoordinates } from "./utils/utils";

import {
  useLoadSensors,
  useLoadZones,
  useMapData,
  useMapLayers,
  useWebSocket,
  useZoneInteractions,
} from "./hooks";

interface MapsProps {
  isAdmin?: boolean;
}

export default function Maps({ isAdmin = false }: MapsProps) {
  // Mounted state to prevent SSR issues
  const [isMounted, setIsMounted] = useState(false);

  //
  const wsRef = useRef<WebSocket | null>(null);
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingType, setDrawingType] = useState<"flood" | "outage" | null>(
    null,
  );
  const [drawingShape, setDrawingShape] = useState<"circle" | "line">("circle");
  const [drawingCenter, setDrawingCenter] = useState<number[] | null>(null);
  const [drawingRadius, setDrawingRadius] = useState<number>(0);
  const [drawingPoints, setDrawingPoints] = useState<number[][]>([]);

  // Hover state
  const [hoveredZone, setHoveredZone] = useState<Zone | null>(null);

  // Popup position state
  const [popupPosition, setPopupPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const [pendingZone, setPendingZone] = useState<Zone | null>(null);
  const [zoneForm, setZoneForm] = useState({ title: "", description: "" });

  // for hover timeout handling
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load zones and sensors from database on mount
  const { zones, setZones } = useLoadZones();
  const { sensors, setSensors } = useLoadSensors({ isAdmin });

  // Setup WebSocket connection for real-time updates
  useWebSocket({ isAdmin, setZones, setSensors, wsRef });

  // Initialize map
  const { mapContainerRef, map } = useMapData({ isAdmin, isMounted });

  // Update map when zones change
  // Update map when sensors change
  useMapLayers({ map, zones, sensors, isAdmin });

  // Add hover interactions
  useZoneInteractions({
    map,
    zones,
    setHoveredZone,
    setPopupPosition,
    hoverTimeoutRef,
  });

  // Handle zone drawing
  useEffect(() => {
    if (!map || !isDrawing) return;

    let centerPoint: number[] | null = drawingCenter;
    let currentRadius = drawingRadius;
    let linePoints: number[][] = [...drawingPoints];

    const handleMapClick = (e: any) => {
      const { lng, lat } = e.lngLat;

      if (drawingShape === "circle") {
        if (!centerPoint) {
          // First click: set center
          centerPoint = [lng, lat];
          setDrawingCenter([lng, lat]);
        } else {
          // Second click: finish circle
          const finalRadius = currentRadius > 0 ? currentRadius : 100;
          const newZone: Zone = {
            id: `zone-${Date.now()}`,
            type: drawingType!,
            shape: "circle",
            center: centerPoint,
            radius: finalRadius,
          };

          saveZoneWithDialog(newZone);
          cancelDrawing();
        }
      } else {
        // Line mode: add point
        linePoints.push([lng, lat]);
        setDrawingPoints(linePoints);
        updateLineDrawingLayer(linePoints);
      }
    };

    const handleMouseMove = (e: any) => {
      const { lng, lat } = e.lngLat;

      if (drawingShape === "circle" && centerPoint) {
        const radius = calculateDistance(centerPoint, [lng, lat]);
        currentRadius = radius;
        setDrawingRadius(radius);
        updateDrawingLayer(centerPoint, radius);
      } else if (drawingShape === "line" && linePoints.length > 0) {
        updateLineDrawingLayer([...linePoints, [lng, lat]]);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelDrawing();
      } else if (
        e.key === "Enter" &&
        drawingShape === "line" &&
        linePoints.length >= 2
      ) {
        // Finish line drawing
        const newZone: Zone = {
          id: `zone-${Date.now()}`,
          type: drawingType!,
          shape: "line",
          coordinates: linePoints,
        };

        saveZoneWithDialog(newZone);
        cancelDrawing();
      }
    };

    const handleDblClick = () => {
      if (drawingShape === "line" && linePoints.length >= 2) {
        const newZone: Zone = {
          id: `zone-${Date.now()}`,
          type: drawingType!,
          shape: "line",
          coordinates: linePoints,
        };

        saveZoneWithDialog(newZone);
        cancelDrawing();
      }
    };

    map.on("click", handleMapClick);
    map.on("mousemove", handleMouseMove);
    map.on("dblclick", handleDblClick);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      map.off("click", handleMapClick);
      map.off("mousemove", handleMouseMove);
      map.off("dblclick", handleDblClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [map, isDrawing, zones, drawingType, drawingShape]);

  const updateDrawingLayer = (center: number[], radius: number) => {
    if (!map || !center) return;

    const circleCoords = createCircleCoordinates(center, radius);

    const source = map.getSource("drawing-temp") as any;
    if (source) {
      source.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [circleCoords],
            },
            properties: {},
          },
        ],
      });
    } else {
      initDrawingLayers();
      updateDrawingLayer(center, radius);
    }
  };

  const updateLineDrawingLayer = (points: number[][]) => {
    if (!map || points.length === 0) return;

    const source = map.getSource("drawing-temp") as any;
    if (source) {
      source.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: points,
            },
            properties: {},
          },
        ],
      });
    } else {
      initDrawingLayers();
      updateLineDrawingLayer(points);
    }
  };

  const initDrawingLayers = () => {
    if (!map || map.getSource("drawing-temp")) return;

    map.addSource("drawing-temp", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });

    map.addLayer({
      id: "drawing-temp-fill",
      type: "fill",
      source: "drawing-temp",
      paint: {
        "fill-color": drawingType === "flood" ? "#3b82f6" : "#ef4444",
        "fill-opacity": 0.3,
      },
    });

    map.addLayer({
      id: "drawing-temp-line",
      type: "line",
      source: "drawing-temp",
      paint: {
        "line-color": drawingType === "flood" ? "#2563eb" : "#dc2626",
        "line-width": 6,
        "line-opacity": 0.6,
        "line-dasharray": [2, 2],
      },
    });
  };

  const finishDrawing = () => {
    if (!drawingCenter) {
      alert("Vui lòng đặt điểm trung tâm trước");
      return;
    }

    const finalRadius = drawingRadius > 0 ? drawingRadius : 100; // Default 100m if no radius

    const newZone: Zone = {
      id: `zone-${Date.now()}`,
      type: drawingType!,
      shape: "circle",
      center: drawingCenter,
      radius: finalRadius,
    };

    setZones((prev) => [...prev, newZone]);
    updateZonesOnMap([...zones, newZone]);
    cancelDrawing();
  };

  const cancelDrawing = () => {
    setIsDrawing(false);
    setDrawingType(null);
    setDrawingCenter(null);
    setDrawingRadius(0);
    setDrawingPoints([]);

    if (map && map.getSource("drawing-temp")) {
      map.removeLayer("drawing-temp-fill");
      map.removeLayer("drawing-temp-line");
      map.removeSource("drawing-temp");
    }
  };

  const updateZonesOnMap = (zonesData: Zone[]) => {
    if (!map) return;

    const features = zonesData
      .map((zone) => {
        if (zone.shape === "circle" && zone.center && zone.radius) {
          const circleCoords = createCircleCoordinates(
            zone.center,
            zone.radius,
          );
          return {
            type: "Feature" as const,
            geometry: {
              type: "Polygon" as const,
              coordinates: [circleCoords],
            },
            properties: {
              id: zone.id,
              type: zone.type,
              shape: zone.shape,
              riskLevel: zone.riskLevel || 50,
              title: zone.title || "Chưa đặt tên",
              description: zone.description || "",
            },
          };
        } else if (zone.shape === "line" && zone.coordinates) {
          return {
            type: "Feature" as const,
            geometry: {
              type: "LineString" as const,
              coordinates: zone.coordinates,
            },
            properties: {
              id: zone.id,
              type: zone.type,
              shape: zone.shape,
              riskLevel: zone.riskLevel || 50,
              title: zone.title || "Chưa đặt tên",
              description: zone.description || "",
            },
          };
        }
        return null;
      })
      .filter((f) => f !== null);

    const source = map.getSource("zones") as any;
    if (source) {
      source.setData({
        type: "FeatureCollection",
        features,
      });
    }
  };

  const updateSensorsOnMap = (sensorsData: Sensor[]) => {
    if (!map || !isAdmin) return;

    const features = sensorsData.map((sensor) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: sensor.location,
      },
      properties: {
        id: sensor.id,
        name: sensor.name,
        type: sensor.type,
        threshold: sensor.threshold,
        actionType: sensor.actionType,
      },
    }));

    const source = map.getSource("sensors") as any;
    if (source) {
      source.setData({
        type: "FeatureCollection",
        features,
      });
    }
  };

  const saveZoneWithDialog = (zone: Zone) => {
    setPendingZone(zone);
    setShowTitleDialog(true);
  };

  const confirmZoneSave = () => {
    if (!pendingZone) return;

    const zoneToSave = {
      ...pendingZone,
      title: zoneForm.title || "Khu Vực Chưa Đặt Tên",
      description: zoneForm.description,
    };

    fetch("/api/zones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(zoneToSave),
    })
      .then(() => {
        setZones((prev) => [...prev, zoneToSave]);
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "zone_created",
              zone: zoneToSave,
            }),
          );
        }
      })
      .catch((err) => console.error("Failed to save zone:", err));

    setShowTitleDialog(false);
    setPendingZone(null);
    setZoneForm({ title: "", description: "" });
  };

  const cancelZoneSave = () => {
    setShowTitleDialog(false);
    setPendingZone(null);
    setZoneForm({ title: "", description: "" });
  };

  const handleDeleteZone = (zoneId: string) => {
    if (!confirm("Xóa khu vực này?")) return;

    fetch(`/api/zones/${zoneId}`, { method: "DELETE" })
      .then(() => {
        setZones((prev) => prev.filter((z) => z.id !== zoneId));
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "zone_deleted",
              zoneId,
            }),
          );
        }
        setHoveredZone(null);
      })
      .catch((err) => console.error("Failed to delete zone:", err));
  };

  const handleDrawZone = (
    type: "flood" | "outage",
    shape: "circle" | "line",
  ) => {
    if (isDrawing) {
      cancelDrawing();
    }
    setIsDrawing(true);
    setDrawingType(type);
    setDrawingShape(shape);
    setDrawingCenter(null);
    setDrawingRadius(0);
    setDrawingPoints([]);
  };

  const handleClearZones = () => {
    if (confirm("Bạn có chắc chắn muốn xóa tất cả các khu vực?")) {
      fetch("/api/zones", { method: "DELETE" })
        .then(() => {
          setZones([]);
          updateZonesOnMap([]);
          // Broadcast to WebSocket
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: "zones_cleared",
              }),
            );
          }
        })
        .catch((err) => console.error("Failed to clear zones:", err));
    }
  };

  // Update zones when they change
  useEffect(() => {
    if (map && zones.length > 0) {
      updateZonesOnMap(zones);
    }
  }, [zones, map]);

  if (!isMounted) {
    return (
      <div
        style={{ width: "100vw", height: "100vh", backgroundColor: "#f0f0f0" }}
      />
    );
  }

  return (
    <>
      <div
        id="map"
        ref={mapContainerRef}
        style={{ width: "100vw", height: "100vh" }}
      />

      {/* Hover Popup */}
      {hoveredZone && popupPosition && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-xl p-4 min-w-64 max-w-sm pointer-events-auto"
          style={{
            left: `${popupPosition.x + 10}px`,
            top: `${popupPosition.y + 10}px`,
          }}
          onMouseEnter={() => {
            // Clear timeout when mouse enters popup
            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current);
              hoverTimeoutRef.current = null;
            }
          }}
          onMouseLeave={() => {
            setHoveredZone(null);
            setPopupPosition(null);
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1">
                {hoveredZone.title || "Untitled Zone"}
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                <span
                  className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                    hoveredZone.type === "flood"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {hoveredZone.type === "flood"
                    ? "🌊 Flood Risk"
                    : "⚡ Nguy Cơ Tắc Đường"}
                </span>
                <span className="ml-2 text-xs text-gray-500">
                  {hoveredZone.shape === "circle" ? "● Zone" : "━ Route"}
                </span>
              </p>
              {hoveredZone.description && (
                <p className="text-sm text-gray-700">
                  {hoveredZone.description}
                </p>
              )}
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => handleDeleteZone(hoveredZone.id)}
              className="mt-3 w-full p-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              Xóa Khu Vực
            </button>
          )}
        </div>
      )}

      {/* Title/Description Dialog */}
      {showTitleDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <h3 className="text-xl font-bold mb-4">Add Zone Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={zoneForm.title}
                  onChange={(e) =>
                    setZoneForm({ ...zoneForm, title: e.target.value })
                  }
                  placeholder="e.g., Main Street Flood Zone"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={zoneForm.description}
                  onChange={(e) =>
                    setZoneForm({ ...zoneForm, description: e.target.value })
                  }
                  placeholder="Add details about this zone..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={confirmZoneSave}
                className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
              >
                Save Zone
              </button>
              <button
                onClick={cancelZoneSave}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <>
          <AdminPanel
            map={map}
            onDrawZone={handleDrawZone}
            onClearZones={handleClearZones}
          />
          {isDrawing && (
            <div className="fixed top-4 right-4 z-50 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg">
              {drawingShape === "circle"
                ? !drawingCenter
                  ? `Click to set center of ${drawingType} zone`
                  : `Click again to finish zone (Radius: ${Math.round(drawingRadius)}m) - Press ESC to cancel`
                : `Drawing ${drawingType} route (${drawingPoints.length} points) - Double-click or Enter to finish, ESC to cancel`}
            </div>
          )}
        </>
      )}
    </>
  );
}
