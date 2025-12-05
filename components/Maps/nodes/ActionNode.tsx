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

interface ActionNodeData {
  actionType: "flood" | "outage";
  actionShape: "circle" | "line";
  label: string;
  onEdit?: (id: string, data: ActionNodeData) => void;
}

function ActionNode({ id, data }: NodeProps<ActionNodeData>) {
  const bgColor = data.actionType === "flood" ? "bg-blue-500" : "bg-red-500";
  const borderColor =
    data.actionType === "flood" ? "border-blue-600" : "border-red-600";
  const icon = data.actionType === "flood" ? "🌊" : "⚡";
  const shapeIcon = data.actionShape === "circle" ? "⭕" : "━";

  return (
    <div
      className={`${bgColor} ${borderColor} border-2 rounded-xl shadow-lg p-4 min-w-[180px] text-white cursor-pointer hover:shadow-2xl transition-shadow`}
      onDoubleClick={() => data.onEdit?.(id, data)}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-white !w-3 !h-3 !border-2 !border-gray-400"
      />
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <div className="font-bold text-sm">Hành Động</div>
          <div className="text-xs opacity-90">{data.label}</div>
        </div>
      </div>
      <div className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded">
        Vẽ {shapeIcon}{" "}
        {data.actionShape === "circle" ? "hình tròn" : "đường thẳng"}
      </div>
    </div>
  );
}

export default memo(ActionNode);
