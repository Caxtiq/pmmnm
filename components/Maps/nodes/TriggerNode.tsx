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
import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";

interface TriggerNodeData {
  sensorId: string;
  sensorName: string;
  condition: "active" | "inactive";
  actionType: "flood" | "outage";
  actionShape: "circle" | "line";
  label: string;
  points?: [number, number][];
  onEdit?: (id: string, data: TriggerNodeData) => void;
}

function TriggerNode({ id, data }: NodeProps<TriggerNodeData>) {
  const bgColor =
    data.actionType === "flood"
      ? "bg-gradient-to-br from-blue-500 to-blue-600"
      : "bg-gradient-to-br from-red-500 to-red-600";
  const borderColor =
    data.actionType === "flood" ? "border-blue-700" : "border-red-700";
  const icon = data.actionType === "flood" ? "🌊" : "⚡";
  const shapeIcon = data.actionShape === "circle" ? "⭕" : "━";
  const conditionIcon = data.condition === "active" ? "✓" : "✕";
  const conditionBg =
    data.condition === "active" ? "bg-green-500" : "bg-gray-500";

  return (
    <div
      className={`${bgColor} ${borderColor} border-3 rounded-2xl shadow-xl p-4 min-w-[220px] text-white cursor-pointer hover:shadow-2xl hover:scale-105 transition-all`}
      onDoubleClick={() => data.onEdit?.(id, data)}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-white !w-3 !h-3 !border-2 !border-gray-400"
      />

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <div className="flex-1">
            <div className="font-bold text-sm">{data.label}</div>
            <div className="text-xs opacity-90">Kích Hoạt Tự Động</div>
          </div>
        </div>

        <div className="bg-white bg-opacity-20 rounded-lg p-2 space-y-1">
          <div className="text-xs font-semibold">📡 {data.sensorName}</div>
          <div className="flex items-center gap-1 text-xs">
            <span className={`${conditionBg} px-2 py-0.5 rounded font-bold`}>
              {conditionIcon} {data.condition.toUpperCase()}
            </span>
            <span>→</span>
            <span className="font-semibold">
              Vẽ {shapeIcon}{" "}
              {data.actionShape === "circle" ? "hình tròn" : "đường thẳng"}
            </span>
          </div>
          {data.points && data.points.length > 0 && (
            <div className="text-xs mt-1">
              <div className="font-semibold">Điểm: {data.points.length}/2</div>
              {data.points.length === 2 && (
                <div className="text-green-300">✓ Đã cấu hình đường</div>
              )}
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-white !w-3 !h-3 !border-2 !border-gray-400"
      />
    </div>
  );
}

export default memo(TriggerNode);
