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
import { useCallback, useState, useEffect } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  MiniMap,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import SensorNode from "./nodes/SensorNode";
import LogicNode from "./nodes/LogicNode";
import ActionNode from "./nodes/ActionNode";
import TriggerNode from "./nodes/TriggerNode";

const nodeTypes = {
  sensor: SensorNode,
  logic: LogicNode,
  action: ActionNode,
  trigger: TriggerNode,
};

interface Sensor {
  id: string;
  name: string;
  location: [number, number];
  type: "water_level" | "temperature" | "humidity";
  threshold: number;
  actionType: "flood" | "outage";
}

interface WorkflowEditorProps {
  sensors: Sensor[];
  map?: any;
  onSaveWorkflow?: (nodes: Node[], edges: Edge[]) => void;
  onSensorCreated?: () => void;
}

export default function WorkflowEditor({
  sensors,
  map,
  onSaveWorkflow,
  onSensorCreated,
}: WorkflowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeType, setSelectedNodeType] = useState<
    "sensor" | "logic" | "action" | "trigger" | "new-sensor" | null
  >(null);
  const [editingNode, setEditingNode] = useState<{
    id: string;
    type: string;
    data: any;
  } | null>(null);
  const [selectingPointsFor, setSelectingPointsFor] = useState<string | null>(
    null,
  );
  const [tempMarkers, setTempMarkers] = useState<any[]>([]);
  const [creatingNewSensor, setCreatingNewSensor] = useState(false);
  const [newSensorForm, setNewSensorForm] = useState({
    name: "",
    type: "water_level" as "water_level" | "temperature" | "humidity",
    threshold: 0,
    actionType: "flood" as "flood" | "outage",
  });

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  // Edit node handler
  const handleEditNode = useCallback(
    (id: string, currentData: any) => {
      const node = nodes.find((n) => n.id === id);
      if (node) {
        setEditingNode({ id, type: node.type || "", data: currentData });
      }
    },
    [nodes],
  );

  // Update node data
  const updateNodeData = (id: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...newData } } : node,
      ),
    );
    setEditingNode(null);
  };

  // Delete node
  const deleteNode = (id: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== id));
    setEdges((eds) =>
      eds.filter((edge) => edge.source !== id && edge.target !== id),
    );
    setEditingNode(null);
  };

  // Start selecting points on map for trigger node
  const startSelectingPoints = (nodeId: string) => {
    if (!map) return;
    setSelectingPointsFor(nodeId);
    setEditingNode(null);

    // Clear any existing markers
    tempMarkers.forEach((marker) => marker.remove());
    setTempMarkers([]);
  };

  // Handle map click for new sensor placement
  const [tempSensorLocation, setTempSensorLocation] = useState<
    [number, number] | null
  >(null);
  const [tempSensorMarker, setTempSensorMarker] = useState<any>(null);
  const [sensorLinePoints, setSensorLinePoints] = useState<[number, number][]>(
    [],
  );
  const [tempLineSource, setTempLineSource] = useState<any>(null);
  const [showSensorForm, setShowSensorForm] = useState(false);
  const [finalizingSensor, setFinalizingSensor] = useState(false);

  useEffect(() => {
    if (!map || !creatingNewSensor || showSensorForm) return;

    // Set crosshair cursor
    map.getCanvas().style.cursor = "crosshair";

    const handleSensorPlacement = (e: any) => {
      const { lng, lat } = e.lngLat;

      // Add new point
      const newPoints = [...sensorLinePoints, [lng, lat]] as [number, number][];
      setSensorLinePoints(newPoints);

      // Add green marker
      if (typeof window !== "undefined" && (window as any).maplibregl) {
        const marker = new (window as any).maplibregl.Marker({
          color: "#10b981",
        })
          .setLngLat([lng, lat])
          .addTo(map);
        setTempMarkers((prev) => [...prev, marker]);
      }

      // Set sensor location to the latest point
      setTempSensorLocation([lng, lat]);

      // Update or create line
      if (newPoints.length === 1) {
        // First point - initialize line source
        if (!map.getSource("temp-sensor-line")) {
          map.addSource("temp-sensor-line", {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [lng, lat],
                  [lng, lat],
                ],
              },
              properties: {},
            },
          });
          map.addLayer({
            id: "temp-sensor-line-layer",
            type: "line",
            source: "temp-sensor-line",
            paint: {
              "line-color": "#10b981",
              "line-width": 4,
              "line-opacity": 0.7,
            },
          });
        }
      } else {
        // Update line with all points
        const source = map.getSource("temp-sensor-line") as any;
        if (source) {
          source.setData({
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: newPoints,
            },
            properties: {},
          });
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && sensorLinePoints.length >= 2) {
        // Finish and show form
        setFinalizingSensor(true);
        setTimeout(() => setShowSensorForm(true), 100);
      } else if (e.key === "Escape") {
        // Cancel
        setCreatingNewSensor(false);
        setSensorLinePoints([]);
        setTempSensorLocation(null);
        setFinalizingSensor(false);

        // Clean up markers and line
        tempMarkers.forEach((m) => m.remove());
        setTempMarkers([]);
        if (map.getSource("temp-sensor-line")) {
          map.removeLayer("temp-sensor-line-layer");
          map.removeSource("temp-sensor-line");
        }
      }
    };

    map.on("click", handleSensorPlacement);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      map.off("click", handleSensorPlacement);
      window.removeEventListener("keydown", handleKeyDown);
      map.getCanvas().style.cursor = "";
    };
  }, [map, creatingNewSensor, showSensorForm, sensorLinePoints, tempMarkers]);

  // Save sensor after form submission
  const handleSaveSensor = () => {
    if (!tempSensorLocation) return;

    const sensor = {
      ...newSensorForm,
      id: `sensor-${Date.now()}`,
      location: tempSensorLocation,
      createdAt: Date.now(),
    };

    fetch("/api/sensors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sensor),
    })
      .then((res) => res.json())
      .then((data) => {
        // Add sensor node to canvas
        const newNode: Node = {
          id: `sensor-${data.sensor.id}`,
          type: "sensor",
          position: { x: 100, y: nodes.length * 120 + 50 },
          data: {
            label: data.sensor.name,
            type: data.sensor.type,
            threshold: data.sensor.threshold,
            sensorId: data.sensor.id,
          },
        };
        setNodes((nds) => [...nds, newNode]);

        setCreatingNewSensor(false);
        setShowSensorForm(false);
        setTempSensorLocation(null);
        setSensorLinePoints([]);

        // Clean up temp marker and line
        if (tempSensorMarker) {
          tempSensorMarker.remove();
          setTempSensorMarker(null);
        }
        if (map?.getSource("temp-sensor-line")) {
          map.removeLayer("temp-sensor-line-layer");
          map.removeSource("temp-sensor-line");
        }

        setNewSensorForm({
          name: "",
          type: "water_level",
          threshold: 0,
          actionType: "flood",
        });

        // Notify parent to reload sensors
        if (onSensorCreated) {
          onSensorCreated();
        }
      });
  };

  // Handle map click for point selection
  useEffect(() => {
    if (!map || !selectingPointsFor) return;

    // Set crosshair cursor
    map.getCanvas().style.cursor = "crosshair";

    const handleMapClick = (e: any) => {
      const { lng, lat } = e.lngLat;
      const node = nodes.find((n) => n.id === selectingPointsFor);
      if (!node) return;

      const currentPoints = node.data.points || [];

      // Add marker to map
      if (typeof window !== "undefined" && (window as any).maplibregl) {
        const marker = new (window as any).maplibregl.Marker({
          color: node.data.actionType === "flood" ? "#3b82f6" : "#ef4444",
        })
          .setLngLat([lng, lat])
          .addTo(map);

        setTempMarkers((prev) => [...prev, marker]);
      }

      if (currentPoints.length === 0) {
        // First point
        updateNodeData(selectingPointsFor, { points: [[lng, lat]] });
      } else if (currentPoints.length === 1) {
        // Second point - done
        updateNodeData(selectingPointsFor, {
          points: [...currentPoints, [lng, lat]],
        });
        setSelectingPointsFor(null);
      }
    };

    map.on("click", handleMapClick);

    return () => {
      map.off("click", handleMapClick);
      map.getCanvas().style.cursor = "";
    };
  }, [map, selectingPointsFor, nodes]);

  // Add node on canvas click
  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (!selectedNodeType) return;

      // Handle new sensor creation
      if (selectedNodeType === "new-sensor") {
        setCreatingNewSensor(true);
        setSelectedNodeType(null);
        return;
      }

      const bounds = (event.target as HTMLElement).getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;

      const newNode: Node = {
        id: `${selectedNodeType}-${Date.now()}`,
        type: selectedNodeType,
        position: { x, y },
        data: {},
      };

      if (selectedNodeType === "logic") {
        newNode.data = { operator: "AND", onEdit: handleEditNode };
      } else if (selectedNodeType === "action") {
        newNode.data = {
          actionType: "flood",
          actionShape: "circle",
          label: "Auto Zone",
          onEdit: handleEditNode,
        };
      } else if (selectedNodeType === "trigger") {
        newNode.data = {
          sensorId: sensors[0]?.id || "",
          sensorName: sensors[0]?.name || "Select Sensor",
          condition: "active" as "active" | "inactive",
          actionType: "flood" as "flood" | "outage",
          actionShape: "circle" as "circle" | "line",
          label: "Trigger Action",
          onEdit: handleEditNode,
        };
      }

      setNodes((nds) => [...nds, newNode]);
      setSelectedNodeType(null);
    },
    [selectedNodeType, setNodes, sensors, handleEditNode],
  );

  // Add sensor node
  const addSensorNode = (sensor: Sensor) => {
    const newNode: Node = {
      id: `sensor-${sensor.id}`,
      type: "sensor",
      position: { x: 100, y: nodes.length * 120 + 50 },
      data: {
        label: sensor.name,
        type: sensor.type,
        threshold: sensor.threshold,
        sensorId: sensor.id,
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const clearCanvas = () => {
    setNodes([]);
    setEdges([]);
  };

  const saveWorkflow = () => {
    if (onSaveWorkflow) {
      onSaveWorkflow(nodes, edges);
    }
    console.log("Workflow saved:", { nodes, edges });
  };

  const [showSensorList, setShowSensorList] = useState(true);

  return (
    <div className="h-full flex flex-col">
      {/* Sensor List Panel */}
      {showSensorList && (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-b-2 border-green-200 p-4 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <span className="text-xl">📡</span>
              Cảm Biến Đã Triển Khai ({sensors.length})
            </h3>
            <button
              onClick={() => setShowSensorList(false)}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              ✕ Ẩn
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {sensors.map((sensor) => (
              <div
                key={sensor.id}
                className="bg-white border-2 border-green-200 rounded-lg p-3 text-sm hover:border-green-400 transition-all"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">
                    {sensor.type === "water_level"
                      ? "💧"
                      : sensor.type === "temperature"
                        ? "🌡️"
                        : "💨"}
                  </span>
                  <p className="font-bold text-gray-800 text-xs">
                    {sensor.name}
                  </p>
                </div>
                <div className="text-xs text-gray-600 ml-7">
                  <div>Ngưỡng: {sensor.threshold}</div>
                  <span
                    className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${
                      sensor.actionType === "flood"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {sensor.actionType === "flood" ? "🌊" : "⚡"}
                  </span>
                </div>
              </div>
            ))}
            {sensors.length === 0 && (
              <div className="col-span-2 text-center py-4 text-gray-400 text-sm">
                Chưa có cảm biến. Thêm cảm biến mới bên dưới.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-gray-800 p-3 flex items-center gap-2 flex-wrap border-b-2 border-gray-700">
        {!showSensorList && (
          <button
            onClick={() => setShowSensorList(true)}
            className="px-3 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors text-xs"
          >
            📡 Hiện Cảm Biến ({sensors.length})
          </button>
        )}
        <div className="text-white font-bold text-sm mr-2">Thêm:</div>

        {/* Sensor Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setCreatingNewSensor(true);
              setSelectedNodeType(null);
            }}
            className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors text-sm"
          >
            📡 + Thêm Cảm Biến
          </button>
        </div>

        <button
          onClick={() => setSelectedNodeType("logic")}
          className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
            selectedNodeType === "logic"
              ? "bg-purple-600 text-white shadow-lg"
              : "bg-purple-500 text-white hover:bg-purple-600"
          }`}
        >
          ⚙️ Logic (VÀ/HOẶC)
        </button>

        <button
          onClick={() => setSelectedNodeType("action")}
          className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
            selectedNodeType === "action"
              ? "bg-blue-600 text-white shadow-lg"
              : "bg-blue-500 text-white hover:bg-blue-600"
          }`}
        >
          🎯 Hành Động
        </button>

        <button
          onClick={() => setSelectedNodeType("trigger")}
          disabled={sensors.length === 0}
          className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
            selectedNodeType === "trigger"
              ? "bg-orange-600 text-white shadow-lg"
              : sensors.length === 0
                ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                : "bg-orange-500 text-white hover:bg-orange-600"
          }`}
          title={
            sensors.length === 0
              ? "Thêm cảm biến trước"
              : "Thêm kích hoạt dựa trên điều kiện"
          }
        >
          ⚡ Kích Hoạt
        </button>

        <div className="flex-1"></div>

        <button
          onClick={saveWorkflow}
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors text-sm"
        >
          💾 Lưu Quy Trình
        </button>

        <button
          onClick={clearCanvas}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors text-sm"
        >
          🗑️ Xóa
        </button>
      </div>

      {selectedNodeType && (
        <div className="bg-yellow-100 border-b-2 border-yellow-400 px-4 py-2 text-sm text-yellow-800 font-medium">
          ✨ Nhấp bất kỳ đâu trên khung vẽ để đặt{" "}
          <span className="font-bold">{selectedNodeType.toUpperCase()}</span>
        </div>
      )}

      {selectingPointsFor && (
        <div className="bg-blue-100 border-b-2 border-blue-400 px-4 py-2 text-sm text-blue-800 font-medium animate-pulse">
          📍 Nhấp vào BẢN ĐỒ (bên phải) để chọn điểm{" "}
          {(nodes.find((n) => n.id === selectingPointsFor)?.data.points
            ?.length || 0) + 1}
          /2
        </div>
      )}

      {creatingNewSensor &&
        !showSensorForm &&
        sensorLinePoints.length === 0 && (
          <div className="bg-green-100 border-b-2 border-green-400 px-4 py-2 text-sm text-green-800 font-medium animate-pulse">
            📍 Nhấp vào BẢN ĐỒ (bên phải) để thêm các điểm dọc tuyến đường
          </div>
        )}
      {creatingNewSensor &&
        !showSensorForm &&
        sensorLinePoints.length === 1 && (
          <div className="bg-green-100 border-b-2 border-green-400 px-4 py-2 text-sm text-green-800 font-medium">
            📍 Tiếp tục nhấp để thêm điểm | Nhấn <strong>Enter</strong> khi xong
            (tối thiểu 2 điểm) | <strong>ESC</strong> để hủy
          </div>
        )}
      {creatingNewSensor && !showSensorForm && sensorLinePoints.length >= 2 && (
        <div className="bg-blue-100 border-b-2 border-blue-400 px-4 py-2 text-sm text-blue-800 font-medium">
          ✓ Đã thêm {sensorLinePoints.length} điểm | Nhấp để thêm thêm | Nhấn{" "}
          <strong>Enter</strong> để hoàn tất | <strong>ESC</strong> để hủy
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 bg-gray-100">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-gray-50"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={16}
            size={1}
            color="#cbd5e1"
          />
          <Controls className="!bg-white !border-2 !border-gray-300 !shadow-lg" />
          <MiniMap
            className="!bg-white !border-2 !border-gray-300 !shadow-lg"
            nodeColor={(node) => {
              if (node.type === "sensor") return "#22c55e";
              if (node.type === "logic") return "#a855f7";
              if (node.type === "action") return "#3b82f6";
              if (node.type === "trigger") return "#f97316";
              return "#94a3b8";
            }}
          />
        </ReactFlow>

        {/* Edit Dialog */}
        {editingNode && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4 text-gray-800">
                Edit{" "}
                {editingNode.type === "logic"
                  ? "Logic"
                  : editingNode.type === "trigger"
                    ? "Trigger"
                    : "Action"}{" "}
                Node
              </h3>

              {editingNode.type === "logic" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Operator
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() =>
                          updateNodeData(editingNode.id, { operator: "AND" })
                        }
                        className={`p-3 rounded-lg font-medium transition-all ${
                          editingNode.data.operator === "AND"
                            ? "bg-indigo-500 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        AND (Both)
                      </button>
                      <button
                        onClick={() =>
                          updateNodeData(editingNode.id, { operator: "OR" })
                        }
                        className={`p-3 rounded-lg font-medium transition-all ${
                          editingNode.data.operator === "OR"
                            ? "bg-purple-500 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        OR (Either)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {editingNode.type === "action" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Label
                    </label>
                    <input
                      type="text"
                      value={editingNode.data.label}
                      onChange={(e) =>
                        setEditingNode({
                          ...editingNode,
                          data: { ...editingNode.data, label: e.target.value },
                        })
                      }
                      className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Loại Cảnh Báo
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() =>
                          setEditingNode({
                            ...editingNode,
                            data: { ...editingNode.data, actionType: "flood" },
                          })
                        }
                        className={`p-3 rounded-lg font-medium transition-all ${
                          editingNode.data.actionType === "flood"
                            ? "bg-blue-500 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        🌊 Flood
                      </button>
                      <button
                        onClick={() =>
                          setEditingNode({
                            ...editingNode,
                            data: { ...editingNode.data, actionType: "outage" },
                          })
                        }
                        className={`p-3 rounded-lg font-medium transition-all ${
                          editingNode.data.actionType === "outage"
                            ? "bg-red-500 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        ⚡ Tắc Đường
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Shape
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() =>
                          setEditingNode({
                            ...editingNode,
                            data: {
                              ...editingNode.data,
                              actionShape: "circle",
                            },
                          })
                        }
                        className={`p-3 rounded-lg font-medium transition-all ${
                          editingNode.data.actionShape === "circle"
                            ? "bg-gray-700 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        ⭕ Circle
                      </button>
                      <button
                        onClick={() =>
                          setEditingNode({
                            ...editingNode,
                            data: { ...editingNode.data, actionShape: "line" },
                          })
                        }
                        className={`p-3 rounded-lg font-medium transition-all ${
                          editingNode.data.actionShape === "line"
                            ? "bg-gray-700 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        ━ Line
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {editingNode.type === "trigger" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Label
                    </label>
                    <input
                      type="text"
                      value={editingNode.data.label}
                      onChange={(e) =>
                        setEditingNode({
                          ...editingNode,
                          data: { ...editingNode.data, label: e.target.value },
                        })
                      }
                      className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-orange-400 focus:outline-none"
                      placeholder="e.g., High Water Alert"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Chọn Cảm Biến
                    </label>
                    <select
                      value={editingNode.data.sensorId}
                      onChange={(e) => {
                        const sensor = sensors.find(
                          (s) => s.id === e.target.value,
                        );
                        setEditingNode({
                          ...editingNode,
                          data: {
                            ...editingNode.data,
                            sensorId: e.target.value,
                            sensorName: sensor?.name || "Unknown",
                          },
                        });
                      }}
                      className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-orange-400 focus:outline-none bg-white"
                    >
                      {sensors.map((sensor) => (
                        <option key={sensor.id} value={sensor.id}>
                          {sensor.type === "water_level"
                            ? "💧"
                            : sensor.type === "temperature"
                              ? "🌡️"
                              : "💨"}{" "}
                          {sensor.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Điều Kiện
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() =>
                          setEditingNode({
                            ...editingNode,
                            data: { ...editingNode.data, condition: "active" },
                          })
                        }
                        className={`p-3 rounded-lg font-medium transition-all ${
                          editingNode.data.condition === "active"
                            ? "bg-green-500 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        ✓ ACTIVE
                      </button>
                      <button
                        onClick={() =>
                          setEditingNode({
                            ...editingNode,
                            data: {
                              ...editingNode.data,
                              condition: "inactive",
                            },
                          })
                        }
                        className={`p-3 rounded-lg font-medium transition-all ${
                          editingNode.data.condition === "inactive"
                            ? "bg-gray-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        ✕ INACTIVE
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {editingNode.data.condition === "active"
                        ? "Trigger when sensor exceeds threshold"
                        : "Trigger when sensor is below threshold"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Action Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() =>
                          setEditingNode({
                            ...editingNode,
                            data: { ...editingNode.data, actionType: "flood" },
                          })
                        }
                        className={`p-3 rounded-lg font-medium transition-all ${
                          editingNode.data.actionType === "flood"
                            ? "bg-blue-500 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        🌊 Flood
                      </button>
                      <button
                        onClick={() =>
                          setEditingNode({
                            ...editingNode,
                            data: { ...editingNode.data, actionType: "outage" },
                          })
                        }
                        className={`p-3 rounded-lg font-medium transition-all ${
                          editingNode.data.actionType === "outage"
                            ? "bg-red-500 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        ⚡ Tắc Đường
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Hình Thức Vẽ
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() =>
                          setEditingNode({
                            ...editingNode,
                            data: {
                              ...editingNode.data,
                              actionShape: "circle",
                            },
                          })
                        }
                        className={`p-3 rounded-lg font-medium transition-all ${
                          editingNode.data.actionShape === "circle"
                            ? "bg-gray-700 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        ⭕ Hình Tròn
                      </button>
                      <button
                        onClick={() =>
                          setEditingNode({
                            ...editingNode,
                            data: { ...editingNode.data, actionShape: "line" },
                          })
                        }
                        className={`p-3 rounded-lg font-medium transition-all ${
                          editingNode.data.actionShape === "line"
                            ? "bg-gray-700 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        ━ Đường Thẳng
                      </button>
                    </div>
                  </div>

                  {editingNode.data.actionShape === "line" && (
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        📍 Các Điểm Trên Đường (đòi hỏi 2 điểm)
                      </label>
                      <div className="text-sm text-gray-600 mb-3">
                        {editingNode.data.points?.length === 0 &&
                          "Chưa chọn điểm nào"}
                        {editingNode.data.points?.length === 1 &&
                          "Đã chọn 1 điểm - nhấp vào bản đồ cho điểm thứ 2"}
                        {editingNode.data.points?.length === 2 &&
                          "✓ Đã cấu hình đường"}
                      </div>
                      <button
                        onClick={() => {
                          startSelectingPoints(editingNode.id);
                        }}
                        className="w-full p-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors"
                      >
                        {editingNode.data.points?.length > 0
                          ? "🔄 Chọn Lại Điểm Trên Bản Đồ"
                          : "🗺️ Chọn 2 Điểm Trên Bản Đồ"}
                      </button>
                      {editingNode.data.points?.length > 0 && (
                        <button
                          onClick={() => {
                            setEditingNode({
                              ...editingNode,
                              data: { ...editingNode.data, points: [] },
                            });
                            tempMarkers.forEach((m) => m.remove());
                            setTempMarkers([]);
                          }}
                          className="w-full mt-2 p-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                        >
                          Xóa Các Điểm
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() =>
                    updateNodeData(editingNode.id, editingNode.data)
                  }
                  className="flex-1 px-4 py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-colors"
                >
                  ✓ Lưu
                </button>
                <button
                  onClick={() => deleteNode(editingNode.id)}
                  className="px-4 py-3 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-colors"
                >
                  🗑️ Xóa
                </button>
                <button
                  onClick={() => setEditingNode(null)}
                  className="px-4 py-3 bg-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-400 transition-colors"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        )}

        {/* New Sensor Dialog */}
        {showSensorForm && tempSensorLocation && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold mb-4 text-gray-800">
                📡 Cấu Hình Cảm Biến
              </h3>

              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3 mb-4 text-sm text-green-800">
                📍 Vị Trí Cảm Biến: {tempSensorLocation[1].toFixed(5)},{" "}
                {tempSensorLocation[0].toFixed(5)}
                <br />
                📏 Đường Đi: {sensorLinePoints.length} điểm đã cấu hình
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Tên Cảm Biến *
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Trạm Sông A"
                    value={newSensorForm.name}
                    onChange={(e) =>
                      setNewSensorForm({
                        ...newSensorForm,
                        name: e.target.value,
                      })
                    }
                    className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Loại
                    </label>
                    <select
                      value={newSensorForm.type}
                      onChange={(e) =>
                        setNewSensorForm({
                          ...newSensorForm,
                          type: e.target.value as any,
                        })
                      }
                      className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:outline-none bg-white"
                    >
                      <option value="water_level">💧 Mực Nước</option>
                      <option value="temperature">🌡️ Nhiệt Độ</option>
                      <option value="humidity">💨 Độ Ẩm</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Ngưỡng Cảnh Báo
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Ví dụ: 5.5"
                      value={newSensorForm.threshold || ""}
                      onChange={(e) =>
                        setNewSensorForm({
                          ...newSensorForm,
                          threshold: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Loại Cảnh Báo
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setNewSensorForm({
                          ...newSensorForm,
                          actionType: "flood",
                        })
                      }
                      className={`p-3 rounded-lg font-medium transition-all ${
                        newSensorForm.actionType === "flood"
                          ? "bg-blue-500 text-white shadow-md"
                          : "bg-white border-2 border-blue-200 text-blue-700 hover:border-blue-400"
                      }`}
                    >
                      🌊 Lũ Lụt
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNewSensorForm({
                          ...newSensorForm,
                          actionType: "outage",
                        })
                      }
                      className={`p-3 rounded-lg font-medium transition-all ${
                        newSensorForm.actionType === "outage"
                          ? "bg-red-500 text-white shadow-md"
                          : "bg-white border-2 border-red-200 text-red-700 hover:border-red-400"
                      }`}
                    >
                      ⚡ Tắc Đường
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleSaveSensor}
                  disabled={!newSensorForm.name || !newSensorForm.threshold}
                  className={`flex-1 px-4 py-3 rounded-lg font-bold transition-colors ${
                    !newSensorForm.name || !newSensorForm.threshold
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-green-500 text-white hover:bg-green-600"
                  }`}
                >
                  ✓ Tạo Cảm Biến
                </button>
                <button
                  onClick={() => {
                    setCreatingNewSensor(false);
                    setShowSensorForm(false);
                    setTempSensorLocation(null);
                    setSensorLinePoints([]);

                    // Clean up temp marker and line
                    if (tempSensorMarker) {
                      tempSensorMarker.remove();
                      setTempSensorMarker(null);
                    }
                    if (map?.getSource("temp-sensor-line")) {
                      map.removeLayer("temp-sensor-line-layer");
                      map.removeSource("temp-sensor-line");
                    }

                    setNewSensorForm({
                      name: "",
                      type: "water_level",
                      threshold: 0,
                      actionType: "flood",
                    });
                  }}
                  className="px-4 py-3 bg-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-400 transition-colors"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-gray-800 p-3 text-white text-xs space-y-1">
        <div>
          <strong>Hướng dẫn sử dụng:</strong>
        </div>
        <div>
          • <strong>Kích hoạt:</strong> Tự động hóa dựa trên điều kiện (cảm biến
          → hành động)
        </div>
        <div>
          • <strong>Logic:</strong> Kết hợp nhiều cảm biến với VÀ/HOẶC
        </div>
        <div>
          • <strong>Hành động:</strong> Xác định thức vẽ khi kích hoạt
        </div>
        <div>
          • <strong>Nhấp đúp</strong> vào bất kỳ Logic/Hành Động/Kích Hoạt để
          chỉnh sửa hoặc xóa
        </div>
        <div>
          • Kéo các ô để di chuyển • Kết nối các ô bằng cách kéo tay cầm
        </div>
      </div>
    </div>
  );
}
