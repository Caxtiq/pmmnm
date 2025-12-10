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
import { useCallback, useState, useEffect, useRef } from "react";
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
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import SensorNode from "./nodes/SensorNode";
import TriggerNode from "./nodes/TriggerNode";

const nodeTypes = {
  sensor: SensorNode,
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
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner
        sensors={sensors}
        map={map}
        onSaveWorkflow={onSaveWorkflow}
        onSensorCreated={onSensorCreated}
      />
    </ReactFlowProvider>
  );
}

function WorkflowEditorInner({
  sensors,
  map,
  onSaveWorkflow,
  onSensorCreated,
}: WorkflowEditorProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Load saved workflow from localStorage on mount
  useEffect(() => {
    const savedWorkflow = localStorage.getItem('workflow-graph');
    if (savedWorkflow) {
      try {
        const { nodes: savedNodes, edges: savedEdges } = JSON.parse(savedWorkflow);
        console.log('📂 Loading saved workflow:', savedNodes.length, 'nodes');
        setNodes(savedNodes || []);
        setEdges(savedEdges || []);
      } catch (err) {
        console.error('Failed to load saved workflow:', err);
      }
    }
  }, []);

  // Visualize sensors on map when editor is open
  useEffect(() => {
    if (!map || !sensors || sensors.length === 0) return;

    console.log('🗺️ Adding sensor visualization to map, sensors:', sensors.length);
    console.log('📊 Full sensor data:', JSON.stringify(sensors, null, 2));

    const linesSourceId = 'workflow-editor-sensor-lines';
    const pointsSourceId = 'workflow-editor-sensor-points';
    
    // Create line features from sensors
    const lineFeatures = sensors
      .filter(sensor => Array.isArray(sensor.location) && sensor.location.length > 1)
      .map(sensor => ({
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: sensor.location
        },
        properties: {
          id: sensor.id,
          name: sensor.name,
          type: sensor.type,
          threshold: sensor.threshold,
          actionType: sensor.actionType
        }
      }));

    console.log('📍 Line features to display:', lineFeatures.length, JSON.stringify(lineFeatures, null, 2));

    // Create numbered point markers for each point in the sensor path
    const pointFeatures = sensors.flatMap((sensor) => {
      if (!Array.isArray(sensor.location)) return [];
      const coords = sensor.location as any;
      // Handle both single point [lng, lat] and array of points [[lng, lat], [lng, lat]]
      const pointArray = Array.isArray(coords[0]) ? coords : [coords];
      return pointArray.map((coord: [number, number], idx: number) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: coord
        },
        properties: {
          sensorId: sensor.id,
          name: sensor.name,
          number: idx + 1
        }
      }));
    });

    console.log('🔢 Point features to display:', pointFeatures.length);

    // Add/update line source and layer
    if (!map.getSource(linesSourceId)) {
      map.addSource(linesSourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: lineFeatures
        }
      });

      map.addLayer({
        id: `${linesSourceId}-layer`,
        type: 'line',
        source: linesSourceId,
        paint: {
          'line-color': '#f59e0b',
          'line-width': 4
        }
      });
      console.log('✅ Added sensor line layer to map');
    } else {
      const lineSource = map.getSource(linesSourceId) as any;
      lineSource.setData({
        type: 'FeatureCollection',
        features: lineFeatures
      });
      console.log('✅ Updated sensor line layer on map');
    }

    // Add/update points source and layers
    if (!map.getSource(pointsSourceId)) {
      map.addSource(pointsSourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: pointFeatures
        }
      });

      // Circle layer for points
      map.addLayer({
        id: `${pointsSourceId}-circle`,
        type: 'circle',
        source: pointsSourceId,
        paint: {
          'circle-radius': 10,
          'circle-color': '#f59e0b',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff'
        }
      });

      // Number labels on points
      map.addLayer({
        id: `${pointsSourceId}-label`,
        type: 'symbol',
        source: pointsSourceId,
        layout: {
          'text-field': ['to-string', ['get', 'number']],
          'text-size': 14,
          'text-allow-overlap': true
        },
        paint: {
          'text-color': '#ffffff'
        }
      });
      console.log('✅ Added sensor point markers to map');
    } else {
      const pointSource = map.getSource(pointsSourceId) as any;
      pointSource.setData({
        type: 'FeatureCollection',
        features: pointFeatures
      });
      console.log('✅ Updated sensor point markers on map');
    }

    // Add hover handlers for sensor lines
    const handleSensorHover = (e: any) => {
      map.getCanvas().style.cursor = 'pointer';
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const sensor = sensors.find(s => s.id === feature.properties.id);
        if (sensor) {
          setHoveredSensor(sensor);
          setSensorPopupPosition({ x: e.point.x, y: e.point.y });
        }
      }
    };

    const handleSensorLeave = () => {
      map.getCanvas().style.cursor = '';
      setHoveredSensor(null);
      setSensorPopupPosition(null);
    };

    map.on('mouseenter', `${linesSourceId}-layer`, handleSensorHover);
    map.on('mouseleave', `${linesSourceId}-layer`, handleSensorLeave);
    map.on('mouseenter', `${pointsSourceId}-circle`, handleSensorHover);
    map.on('mouseleave', `${pointsSourceId}-circle`, handleSensorLeave);

    // Cleanup when editor closes
    return () => {
      console.log('🧹 Cleaning up sensor visualization layers');
      map.off('mouseenter', `${linesSourceId}-layer`, handleSensorHover);
      map.off('mouseleave', `${linesSourceId}-layer`, handleSensorLeave);
      map.off('mouseenter', `${pointsSourceId}-circle`, handleSensorHover);
      map.off('mouseleave', `${pointsSourceId}-circle`, handleSensorLeave);
      
      if (map.getLayer(`${linesSourceId}-layer`)) 
        map.removeLayer(`${linesSourceId}-layer`);
      if (map.getSource(linesSourceId)) 
        map.removeSource(linesSourceId);
      
      if (map.getLayer(`${pointsSourceId}-circle`)) 
        map.removeLayer(`${pointsSourceId}-circle`);
      if (map.getLayer(`${pointsSourceId}-label`)) 
        map.removeLayer(`${pointsSourceId}-label`);
      if (map.getSource(pointsSourceId)) 
        map.removeSource(pointsSourceId);
      
      setHoveredSensor(null);
      setSensorPopupPosition(null);
    };
  }, [map, sensors]);
  const [selectedNodeType, setSelectedNodeType] = useState<
    "sensor" | "trigger" | "new-sensor" | null
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
  const [hoveredSensor, setHoveredSensor] = useState<Sensor | null>(null);
  const [sensorPopupPosition, setSensorPopupPosition] = useState<{ x: number; y: number } | null>(null);

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

    const markersSourceId = `temp-sensor-markers-${Date.now()}`;

    // Initialize marker source and layers for numbered markers
    if (!map.getSource(markersSourceId)) {
      map.addSource(markersSourceId, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: `${markersSourceId}-circle`,
        type: "circle",
        source: markersSourceId,
        paint: {
          "circle-radius": 8,
          "circle-color": "#ffffff",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#10b981",
        },
      });

      map.addLayer({
        id: `${markersSourceId}-label`,
        type: "symbol",
        source: markersSourceId,
        layout: {
          "text-field": ["get", "label"],
          "text-size": 12,
          "text-offset": [0, -1.5],
          "text-anchor": "top",
        },
        paint: {
          "text-color": "#000000",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
        },
      });
    }

    const updateMarkers = (points: [number, number][]) => {
      const markerSource = map.getSource(markersSourceId) as any;
      if (markerSource) {
        markerSource.setData({
          type: "FeatureCollection",
          features: points.map((point, index) => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: point,
            },
            properties: {
              label:
                index === 0
                  ? "🟢 Bắt đầu"
                  : index === points.length - 1
                    ? "🔴 Kết thúc"
                    : `${index + 1}`,
            },
          })),
        });
      }
    };

    const handleSensorPlacement = (e: any) => {
      const { lng, lat } = e.lngLat;

      // Add new point
      const newPoints = [...sensorLinePoints, [lng, lat]] as [number, number][];
      setSensorLinePoints(newPoints);

      // Update numbered markers
      updateMarkers(newPoints);

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
        if (map.getLayer(`${markersSourceId}-circle`))
          map.removeLayer(`${markersSourceId}-circle`);
        if (map.getLayer(`${markersSourceId}-label`))
          map.removeLayer(`${markersSourceId}-label`);
        if (map.getSource(markersSourceId))
          map.removeSource(markersSourceId);
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

      // Clean up on unmount
      if (map.getLayer(`${markersSourceId}-circle`))
        map.removeLayer(`${markersSourceId}-circle`);
      if (map.getLayer(`${markersSourceId}-label`))
        map.removeLayer(`${markersSourceId}-label`);
      if (map.getSource(markersSourceId))
        map.removeSource(markersSourceId);
    };
  }, [map, creatingNewSensor, showSensorForm, sensorLinePoints]);

  // Save sensor after form submission
  const handleSaveSensor = () => {
    if (sensorLinePoints.length < 2) {
      alert("Vui lòng chọn ít nhất 2 điểm cho cảm biến!");
      return;
    }

    const sensor = {
      ...newSensorForm,
      id: `sensor-${Date.now()}`,
      location: sensorLinePoints, // Use the array of points, not single point
      createdAt: Date.now(),
    };

    fetch("/api/sensors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sensor),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("Sensor created response:", data);
        
        // Handle response - sensor is returned directly
        const createdSensor = data.sensor || data;
        
        if (!createdSensor || !createdSensor.id) {
          console.error("Invalid sensor response:", data);
          alert("Failed to create sensor - invalid response");
          return;
        }

        // Notify parent to reload sensors first
        if (onSensorCreated) {
          onSensorCreated();
        }

        // Clean up UI
        setCreatingNewSensor(false);
        setShowSensorForm(false);
        setTempSensorLocation(null);
        setSensorLinePoints([]);

        // Clean up temp markers and line
        if (map) {
          // Remove numbered marker layers
          const markerLayers = map.getStyle()?.layers?.filter((layer: any) => 
            layer.id.includes('temp-sensor-markers')
          );
          markerLayers?.forEach((layer: any) => {
            if (map.getLayer(layer.id)) map.removeLayer(layer.id);
          });
          
          const markerSources = Object.keys(map.getStyle()?.sources || {}).filter(id => 
            id.includes('temp-sensor-markers')
          );
          markerSources?.forEach((sourceId: string) => {
            if (map.getSource(sourceId)) map.removeSource(sourceId);
          });

          // Remove line
          if (map.getSource("temp-sensor-line")) {
            map.removeLayer("temp-sensor-line-layer");
            map.removeSource("temp-sensor-line");
          }
        }

        setNewSensorForm({
          name: "",
          type: "water_level",
          threshold: 0,
          actionType: "flood",
        });
      })
      .catch((error) => {
        console.error("Failed to create sensor:", error);
        alert("Failed to create sensor - check console for details");
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

      const currentPoints = (node.data as any).points || [];
      const actionShape = (node.data as any).actionShape;

      // Add marker to map
      if (typeof window !== "undefined" && (window as any).maplibregl) {
        const marker = new (window as any).maplibregl.Marker({
          color: (node.data as any).actionType === "flood" ? "#3b82f6" : "#ef4444",
        })
          .setLngLat([lng, lat])
          .addTo(map);

        setTempMarkers((prev) => [...prev, marker]);
      }

      // For line shape: limit to 2 points
      if (actionShape === "line") {
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
      } else {
        // For circle shape: allow multiple points (AND gate)
        updateNodeData(selectingPointsFor, {
          points: [...currentPoints, [lng, lat]],
        });
      }
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        // Finish selection
        setSelectingPointsFor(null);
      } else if (e.key === "Escape") {
        // Cancel and clear points
        if (selectingPointsFor) {
          updateNodeData(selectingPointsFor, { points: [] });
          setSelectingPointsFor(null);
        }
      }
    };

    map.on("click", handleMapClick);
    window.addEventListener("keydown", handleKeyPress);

    return () => {
      map.off("click", handleMapClick);
      window.removeEventListener("keydown", handleKeyPress);
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

      if (selectedNodeType === "trigger") {
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

  // Handle drop on canvas
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const data = event.dataTransfer.getData("application/reactflow");
      if (!data) return;

      const { sensor, nodeType } = JSON.parse(data);
      if (nodeType !== "sensor" || !sensor) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `sensor-${sensor.id}-${Date.now()}`,
        type: "sensor",
        position,
        data: {
          label: sensor.name,
          type: sensor.type,
          threshold: sensor.threshold,
          sensorId: sensor.id,
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [screenToFlowPosition, setNodes],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

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
    console.log('💾 Saving workflow with nodes:', nodes);
    console.log('💾 Edges:', edges);
    
    // Convert trigger nodes to sensor rules
    const newRules: any[] = [];
    
    // Process trigger nodes (standalone automation)
    const triggerNodes = nodes.filter(n => n.type === 'trigger');
    console.log('🎯 Trigger nodes found:', triggerNodes.length, triggerNodes);
    
    triggerNodes.forEach(trigger => {
      const data = trigger.data as any;
      console.log('🔍 Processing trigger:', trigger.id, data);
      
      // For line triggers with exactly 2 points
      if (data.actionShape === 'line' && (data.points as [number, number][])?.length === 2) {
        newRules.push({
          name: data.label,
          type: '1-sensor',
          sensors: [data.sensorId],
          actionType: data.actionType as 'flood' | 'outage',
          actionShape: 'line',
          enabled: true,
          metadata: {
            condition: data.condition,
            points: data.points
          }
        });
      } else if (data.actionShape === 'circle' && (data.points as [number, number][])?.length > 0) {
        // Circle trigger with multiple points (AND gate - create zones at ALL points)
        newRules.push({
          name: data.label,
          type: '1-sensor',
          sensors: [data.sensorId],
          actionType: data.actionType as 'flood' | 'outage',
          actionShape: 'circle',
          enabled: true,
          metadata: {
            condition: data.condition,
            points: data.points // Multiple points for AND gate
          }
        });
      } else if (data.actionShape === 'circle' && !data.points) {
        // Circle trigger without specific points (use sensor location)
        newRules.push({
          name: data.label,
          type: '1-sensor',
          sensors: [data.sensorId],
          actionType: data.actionType as 'flood' | 'outage',
          actionShape: 'circle',
          enabled: true,
          metadata: {
            condition: data.condition
          }
        });
      }
    });
    
    console.log('📋 Rules to save:', newRules);
    
    if (newRules.length === 0) {
      alert('⚠️ Chưa có quy tắc nào để lưu!\n\nHướng dẫn:\n1. Kéo cảm biến vào canvas\n2. Nhấn "Thêm Kích Hoạt"\n3. Nhấp đúp vào Kích Hoạt để cấu hình\n4. Chọn điểm trên bản đồ (Enter để hoàn thành)\n5. Lưu lại');
      return;
    }
    
    // Save rules to API
    let savedCount = 0;
    newRules.forEach(rule => {
      const fullRule = {
        ...rule,
        id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now()
      };
      
      fetch('/api/sensor-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullRule)
      }).then(res => res.json())
        .then(data => {
          savedCount++;
          if (savedCount === newRules.length) {
            const andGateRules = newRules.filter(r => r.actionShape === 'circle' && r.metadata?.points?.length > 1);
            const message = andGateRules.length > 0 
              ? `✅ Đã lưu ${newRules.length} quy tắc!\n🔘 ${andGateRules.length} quy tắc AND gate (kích hoạt nhiều điểm)`
              : `✅ Đã lưu ${newRules.length} quy tắc tự động!`;
            alert(message);
          }
        })
        .catch(err => {
          console.error('Failed to save rule:', err);
          alert('❌ Lỗi khi lưu quy tắc!');
        });
    });
    
    // Save the graph state to localStorage
    const workflowData = { nodes, edges };
    localStorage.setItem('workflow-graph', JSON.stringify(workflowData));
    console.log('💾 Saved workflow graph to localStorage');
    
    if (onSaveWorkflow) {
      onSaveWorkflow(nodes, edges);
    }
    console.log("Workflow saved:", { nodes, edges, rules: newRules });
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
                className="bg-white border-2 border-green-200 rounded-lg p-3 text-sm hover:border-green-400 hover:shadow-md transition-all relative group"
              >
                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "application/reactflow",
                      JSON.stringify({ sensor, nodeType: "sensor" }),
                    );
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className="cursor-move"
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
                {/* Delete button */}
                <button
                  onClick={async () => {
                    if (confirm(`Xóa cảm biến "${sensor.name}"?`)) {
                      try {
                        const res = await fetch(`/api/sensors?id=${sensor.id}`, {
                          method: 'DELETE'
                        });
                        if (res.ok) {
                          alert('✅ Đã xóa cảm biến!');
                          if (onSensorCreated) onSensorCreated(); // Reload sensors
                        } else {
                          alert('❌ Lỗi khi xóa cảm biến!');
                        }
                      } catch (err) {
                        console.error('Failed to delete sensor:', err);
                        alert('❌ Lỗi khi xóa cảm biến!');
                      }
                    }
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold"
                  title="Xóa cảm biến"
                >
                  ✕
                </button>
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
          🔥 Kích Hoạt Tự Động
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
          {((nodes.find((n) => n.id === selectingPointsFor)?.data as any)?.points
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
      <div
        ref={reactFlowWrapper}
        className="flex-1 bg-gray-100"
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
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
                Chỉnh Sửa Kích Hoạt
              </h3>

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

                  {editingNode.data.actionShape === "circle" && (
                    <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        🔘 Các Điểm Kích Hoạt (AND Gate - Kích hoạt TẤT CẢ)
                      </label>
                      <div className="text-sm text-gray-600 mb-3">
                        {editingNode.data.points?.length === 0 &&
                          "Chưa chọn điểm nào"}
                        {editingNode.data.points?.length > 0 &&
                          `✓ ${editingNode.data.points.length} điểm - sẽ tạo ${editingNode.data.points.length} vùng khi kích hoạt`}
                      </div>
                      <button
                        onClick={() => {
                          startSelectingPoints(editingNode.id);
                        }}
                        className="w-full p-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-colors"
                      >
                        {editingNode.data.points?.length > 0
                          ? "🔄 Chọn Lại Điểm"
                          : "🗺️ Chọn Điểm Trên Bản Đồ"}
                      </button>
                      {editingNode.data.points?.length > 0 && (
                        <button
                          onClick={() => {
                            updateNodeData(editingNode.id, { points: [] });
                          }}
                          className="w-full mt-2 p-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors"
                        >
                          🗑️ Xóa Tất Cả Điểm
                        </button>
                      )}
                      <div className="mt-3 text-xs text-gray-500 bg-white p-2 rounded">
                        💡 AND Gate: Nhấp nhiều lần trên bản đồ để chọn nhiều điểm. 
                        Khi cảm biến kích hoạt, hệ thống sẽ tạo vùng cảnh báo tại TẤT CẢ các điểm đã chọn.
                        Nhấn Enter khi xong.
                      </div>
                    </div>
                  )}

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

      {/* Sensor hover popup on map */}
      {hoveredSensor && sensorPopupPosition && (
        <div
          className="fixed bg-white rounded-lg shadow-2xl p-4 z-50 pointer-events-none"
          style={{
            left: sensorPopupPosition.x + 10,
            top: sensorPopupPosition.y + 10,
            maxWidth: '250px'
          }}
        >
          <div className="font-bold text-gray-800 mb-2">
            {hoveredSensor.type === 'water_level' ? '💧' : 
             hoveredSensor.type === 'temperature' ? '🌡️' : '💨'} {hoveredSensor.name}
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            <div>
              <span className="font-semibold">Loại:</span>{' '}
              {hoveredSensor.type === 'water_level' ? 'Mực nước' :
               hoveredSensor.type === 'temperature' ? 'Nhiệt độ' : 'Độ ẩm'}
            </div>
            <div>
              <span className="font-semibold">Ngưỡng:</span> {hoveredSensor.threshold}
              {hoveredSensor.type === 'water_level' ? 'm' :
               hoveredSensor.type === 'temperature' ? '°C' : '%'}
            </div>
            <div>
              <span className="font-semibold">Hành động:</span>{' '}
              <span className={`font-semibold ${hoveredSensor.actionType === 'flood' ? 'text-blue-600' : 'text-red-600'}`}>
                {hoveredSensor.actionType === 'flood' ? 'Lũ lụt' : 'Mất điện'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
