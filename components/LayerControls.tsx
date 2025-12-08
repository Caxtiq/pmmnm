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

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLayerGroup,
  faTimes,
  faEye,
  faEyeSlash,
  faWater,
  faBolt,
  faLocationDot,
  faHospital,
  faRoad,
  faFire,
  faClock,
} from "@fortawesome/free-solid-svg-icons";

interface LayerControlsProps {
  onToggleLayer: (layer: string, visible: boolean) => void;
  heatmapTimeFilter?: "24h" | "7d" | "30d" | "all";
  onHeatmapTimeFilterChange?: (filter: "24h" | "7d" | "30d" | "all") => void;
}

export default function LayerControls({
  onToggleLayer,
  heatmapTimeFilter = "7d",
  onHeatmapTimeFilterChange,
}: LayerControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [layers, setLayers] = useState({
    floodZones: true,
    outageZones: true,
    userReports: true,
    safeZones: true,
    routes: true,
    heatmap: false,
  });

  const handleToggle = (layer: keyof typeof layers) => {
    const newValue = !layers[layer];
    setLayers({ ...layers, [layer]: newValue });
    onToggleLayer(layer, newValue);
  };

  const layerInfo = [
    {
      key: "floodZones" as const,
      label: "Vùng ngập lụt",
      icon: faWater,
      color: "bg-blue-500",
      iconColor: "text-blue-500",
    },
    {
      key: "outageZones" as const,
      label: "Vùng mất điện",
      icon: faBolt,
      color: "bg-red-500",
      iconColor: "text-red-500",
    },
    {
      key: "userReports" as const,
      label: "Báo cáo người dùng",
      icon: faLocationDot,
      color: "bg-purple-500",
      iconColor: "text-purple-500",
    },
    {
      key: "safeZones" as const,
      label: "Điểm an toàn",
      icon: faHospital,
      color: "bg-green-500",
      iconColor: "text-green-500",
    },
    {
      key: "routes" as const,
      label: "Tuyến đường",
      icon: faRoad,
      color: "bg-orange-500",
      iconColor: "text-orange-500",
    },
    {
      key: "heatmap" as const,
      label: "Bản đồ nhiệt",
      icon: faFire,
      color: "bg-gradient-to-r from-yellow-400 to-red-600",
      iconColor: "text-red-600",
    },
  ];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-20 right-4 z-30 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 p-4 rounded-full shadow-2xl hover:shadow-xl transition-all"
        title="Lớp bản đồ"
      >
        <FontAwesomeIcon icon={faLayerGroup} size="lg" />
      </button>
    );
  }

  return (
    <div className="fixed top-20 right-4 z-30 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-80 animate-fadeIn">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-2xl">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <FontAwesomeIcon icon={faLayerGroup} />
          Lớp Bản Đồ
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          className="hover:bg-white/20 p-2 rounded-lg transition-colors"
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {layerInfo.map(({ key, label, icon, iconColor }) => (
          <div
            key={key}
            className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            onClick={() => handleToggle(key)}
          >
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={icon} className={`w-4 ${iconColor}`} />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {label}
              </span>
            </div>
            <button
              className={`p-2 rounded-lg transition-all ${
                layers[key]
                  ? "bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
              }`}
            >
              <FontAwesomeIcon icon={layers[key] ? faEye : faEyeSlash} />
            </button>
          </div>
        ))}
      </div>

      {/* Heatmap Time Filter */}
      {layers.heatmap && onHeatmapTimeFilterChange && (
        <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 mt-3 flex items-center gap-2">
            <FontAwesomeIcon icon={faClock} />
            Khoảng Thời Gian
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { value: "24h" as const, label: "24h" },
              { value: "7d" as const, label: "7 ngày" },
              { value: "30d" as const, label: "30 ngày" },
              { value: "all" as const, label: "Tất cả" },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => onHeatmapTimeFilterChange(value)}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                  heatmapTimeFilter === value
                    ? "bg-gradient-to-r from-yellow-400 to-red-600 text-white shadow-md"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-2xl">
        <button
          onClick={() => {
            const allVisible = Object.values(layers).every((v) => v);
            const newState = !allVisible;
            const newLayers = Object.keys(layers).reduce(
              (acc, key) => {
                acc[key as keyof typeof layers] = newState;
                onToggleLayer(key, newState);
                return acc;
              },
              {} as typeof layers,
            );
            setLayers(newLayers);
          }}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white py-2 rounded-lg font-medium transition-all"
        >
          {Object.values(layers).every((v) => v) ? "Ẩn tất cả" : "Hiện tất cả"}
        </button>
      </div>
    </div>
  );
}
