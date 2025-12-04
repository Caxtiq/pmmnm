import { useEffect, useState } from "react";
import { Sensor } from "../types";

interface UseLoadSensorsProps {
  isAdmin: boolean;
}

export const useLoadSensors = ({ isAdmin }: UseLoadSensorsProps) => {
  const [sensors, setSensors] = useState<Sensor[]>([]);

  useEffect(() => {
    if (isAdmin) {
      fetch("/api/sensors")
        .then((res) => res.json())
        .then((data) => {
          if (data.sensors) {
            setSensors(data.sensors);
          }
        })
        .catch((err) => console.error("Failed to load sensors:", err));
    }
  }, [isAdmin]);

  return { sensors, setSensors };
};
