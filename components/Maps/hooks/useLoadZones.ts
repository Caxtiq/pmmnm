import { useEffect, useState } from "react";
import { Zone } from "../types";

export const useLoadZones = () => {
  const [zones, setZones] = useState<Zone[]>([]);

  useEffect(() => {
    fetch("/api/zones")
      .then((res) => res.json())
      .then((data) => {
        if (data.zones) {
          setZones(data.zones);
        }
      })
      .catch((err) => console.error("Failed to load zones:", err));
  }, []);

  return { zones, setZones };
};
