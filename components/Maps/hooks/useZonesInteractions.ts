import { useEffect, useRef } from "react";
import vietmapgl from "@vietmap/vietmap-gl-js/dist/vietmap-gl.js";
import { Zone } from "../types";

interface UseZoneInteractionsProps {
  map: vietmapgl.Map | null;
  zones: Zone[];
  setHoveredZone: (zone: Zone | null) => void;
  setPopupPosition: (pos: { x: number; y: number } | null) => void;
  hoverTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
}
export const useZoneInteractions = ({
  map,
  zones,
  setHoveredZone,
  setPopupPosition,
  hoverTimeoutRef,
}: UseZoneInteractionsProps) => {
  useEffect(() => {
    if (!map) return;

    const handleFloodHover = (e: any) => {
      map.getCanvas().style.cursor = "pointer";
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const zone = zones.find((z) => z.id === feature.properties.id);
        if (zone) {
          // Clear any pending hide timeout
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
          }
          setHoveredZone(zone);
          setPopupPosition({ x: e.point.x, y: e.point.y });
        }
      }
    };

    const handleOutageHover = (e: any) => {
      map.getCanvas().style.cursor = "pointer";
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const zone = zones.find((z) => z.id === feature.properties.id);
        if (zone) {
          // Clear any pending hide timeout
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
          }
          setHoveredZone(zone);
          setPopupPosition({ x: e.point.x, y: e.point.y });
        }
      }
    };

    const handleLineHover = (e: any) => {
      map.getCanvas().style.cursor = "pointer";
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const zone = zones.find((z) => z.id === feature.properties.id);
        if (zone) {
          // Clear any pending hide timeout
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
          }
          setHoveredZone(zone);
          setPopupPosition({ x: e.point.x, y: e.point.y });
        }
      }
    };

    const handleLeave = () => {
      map.getCanvas().style.cursor = "";
      // Delay hiding to allow mouse to move to popup
      hoverTimeoutRef.current = setTimeout(() => {
        setHoveredZone(null);
        setPopupPosition(null);
      }, 200);
    };

    map.on("mousemove", "flood-zones", handleFloodHover);
    map.on("mousemove", "outage-zones", handleOutageHover);
    map.on("mousemove", "zones-lines", handleLineHover);
    map.on("mouseleave", "flood-zones", handleLeave);
    map.on("mouseleave", "outage-zones", handleLeave);
    map.on("mouseleave", "zones-lines", handleLeave);

    return () => {
      map.off("mousemove", "flood-zones", handleFloodHover);
      map.off("mousemove", "outage-zones", handleOutageHover);
      map.off("mousemove", "zones-lines", handleLineHover);
      map.off("mouseleave", "flood-zones", handleLeave);
      map.off("mouseleave", "outage-zones", handleLeave);
      map.off("mouseleave", "zones-lines", handleLeave);
    };
  }, [map, zones]);
};
