import { useEffect, useRef, useState } from "react";
import vietmapgl from "@vietmap/vietmap-gl-js/dist/vietmap-gl.js";

interface UseMapDataProps {
  isAdmin?: boolean;
  isMounted?: boolean; // Nhận thêm prop này từ component cha
}

export const useMapData = ({
  isAdmin = false,
  isMounted = false,
}: UseMapDataProps) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<vietmapgl.Map | null>(null);

  useEffect(() => {
    if (!isMounted || !mapContainerRef.current || map) return;

    const apiKey = process.env.NEXT_PUBLIC_VIETMAP_API_KEY || "";

    const mapInstance = new vietmapgl.Map({
      container: mapContainerRef.current,
      style: `https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=${apiKey}`,
      center: [105.748684, 20.962594], // Hanoi coordinates

      zoom: 12,
      transformRequest: (url: string) => {
        if (url.includes("vietmap.vn")) {
          return {
            url: url.includes("?")
              ? `${url}&apikey=${apiKey}`
              : `${url}?apikey=${apiKey}`,
          };
        }
        return { url };
      },
    });

    mapInstance.addControl(new vietmapgl.NavigationControl(), "top-right");
    mapInstance.addControl(
      new vietmapgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
        },
        trackUserLocation: true,
      }),
    );

    mapInstance.on("load", () => {
      // Add sources for zones
      mapInstance.addSource("zones", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      // Add source for sensors
      if (isAdmin) {
        mapInstance.addSource("sensors", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });
      }

      // Add layer for flood circle zones
      mapInstance.addLayer({
        id: "flood-zones",
        type: "fill",
        source: "zones",
        filter: [
          "all",
          ["==", ["get", "type"], "flood"],
          ["==", ["get", "shape"], "circle"],
        ],
        paint: {
          "fill-color": "#3b82f6",
          "fill-opacity": 0.4,
        },
      });

      // Add layer for outage circle zones
      mapInstance.addLayer({
        id: "outage-zones",
        type: "fill",
        source: "zones",
        filter: [
          "all",
          ["==", ["get", "type"], "outage"],
          ["==", ["get", "shape"], "circle"],
        ],
        paint: {
          "fill-color": "#ef4444",
          "fill-opacity": 0.4,
        },
      });

      // Add line layers for routes/paths
      mapInstance.addLayer({
        id: "zones-lines",
        type: "line",
        source: "zones",
        filter: ["==", ["get", "shape"], "line"],
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "type"], "flood"],
            "#2563eb",
            ["==", ["get", "type"], "outage"],
            "#dc2626",
            "#000000",
          ],
          "line-width": 6,
          "line-opacity": 0.8,
        },
      });

      // Add outline layers
      mapInstance.addLayer({
        id: "zones-outline",
        type: "line",
        source: "zones",
        filter: ["==", ["get", "shape"], "circle"],
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "type"], "flood"],
            "#2563eb",
            ["==", ["get", "type"], "outage"],
            "#dc2626",
            "#000000",
          ],
          "line-width": 2,
        },
      });

      // Add sensor layers for admins
      if (isAdmin) {
        mapInstance.addLayer({
          id: "sensors-circle",
          type: "circle",
          source: "sensors",
          paint: {
            "circle-radius": 8,
            "circle-color": "#10b981",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
            "circle-opacity": 0.8,
          },
        });

        mapInstance.addLayer({
          id: "sensors-label",
          type: "symbol",
          source: "sensors",
          layout: {
            "text-field": ["get", "name"],
            "text-size": 11,
            "text-offset": [0, 1.5],
            "text-anchor": "top",
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          },
          paint: {
            "text-color": "#000000",
            "text-halo-color": "#ffffff",
            "text-halo-width": 2,
          },
        });
      }

      setMap(mapInstance);
    });

    return () => {
      mapInstance.remove();
    };
  }, [isMounted]);

  return { map, mapContainerRef };
};
