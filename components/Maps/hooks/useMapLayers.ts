import { useEffect } from "react";
import { Zone, Sensor } from "../types";
import { updateSensorsOnMap, updateZonesOnMap } from "../utils/mapUpdating";

interface MapLayer {
  map: vietmapgl.Map | null;
  zones: Zone[];
  sensors: Sensor[];
  isAdmin: boolean;
}

export const useMapLayers = ({ map, zones, sensors, isAdmin }: MapLayer) => {
  // Update map when zones change
  useEffect(() => {
    if (map && zones.length > 0) {
      updateZonesOnMap(zones, map);
    }
  }, [zones, map]);

  // Update map when sensors change
  useEffect(() => {
    if (map && isAdmin) {
      updateSensorsOnMap(sensors, map);
    }
  }, [sensors, map, isAdmin]);
};
