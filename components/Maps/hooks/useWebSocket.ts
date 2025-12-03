import { useEffect, useRef } from "react";

interface UseWebSocketProps {
  isAdmin: boolean;
  setZones: any;
  setSensors: any;
}

export const useWebSocket = ({
  isAdmin,
  setZones,
  setSensors,
}: UseWebSocketProps) => {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === "zone_created") {
          setZones((prev: any) => [...prev, message.zone]);
        } else if (message.type === "zone_updated") {
          setZones((prev: any) =>
            prev.map((z: any) => (z.id === message.zone.id ? message.zone : z)),
          );
        } else if (message.type === "zone_deleted") {
          setZones((prev: any) => prev.filter((z: any) => z.id !== message.zoneId));
        } else if (message.type === "zones_cleared") {
          setZones([]);
        } else if (message.type === "sensor_data") {
          console.log("Sensor data received:", message.data);
        } else if (message.type === "prediction") {
          console.log("Prediction received:", message.prediction);
        } else if (message.type === "sensor_created" && isAdmin) {
          setSensors((prev: any) => [...prev, message.sensor]);
        } else if (message.type === "sensor_deleted" && isAdmin) {
          setSensors((prev: any) => prev.filter((s: any) => s.id !== message.sensorId));
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
    };

    return () => {
      ws.close();
    };
  }, [isAdmin, setSensors, setZones]);

  return wsRef;
};
