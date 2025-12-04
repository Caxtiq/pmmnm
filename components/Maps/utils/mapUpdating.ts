import { Sensor, Zone } from "../types";
import { createCircleCoordinates } from "./utils";

export const updateZonesOnMap = (zonesData: Zone[], map: vietmapgl.Map) => {
  const features = zonesData
    .map((zone) => {
      if (zone.shape === "circle" && zone.center && zone.radius) {
        const circleCoords = createCircleCoordinates(zone.center, zone.radius);
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

  const source = map?.getSource("zones") as any;
  if (source) {
    source.setData({
      type: "FeatureCollection",
      features,
    });
  }
};

export const updateSensorsOnMap = (
  sensorsData: Sensor[],
  map: vietmapgl.Map,
) => {
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

  const source = map?.getSource("sensors") as any;
  if (source) {
    source.setData({
      type: "FeatureCollection",
      features,
    });
  }
};
