import { useEffect, useRef } from "react";
import vietmapgl from "@vietmap/vietmap-gl-js/dist/vietmap-gl.js";
import { Zone } from "../types";

interface UseZoneInteractionsProps {
  map: vietmapgl.Map | null;
  zones: Zone[];
  setHoveredZone: (zone: Zone | null) => void;
  setPopupPosition: (pos: { x: number; y: number } | null) => void;
}

export const useZoneInteractions = ({
  map,
  zones,
  setHoveredZone,
  setPopupPosition,
}: UseZoneInteractionsProps) => {
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!map) return;

    // 1. Hàm xử lý chung cho việc Hover (Gộp logic lặp lại)
    const handleHover = (e: any) => {
      map.getCanvas().style.cursor = "pointer";

      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        // Tìm zone tương ứng với feature đang hover
        const zone = zones.find((z) => z.id === feature.properties?.id);

        if (zone) {
          // Xóa timeout ẩn popup nếu đang có (để chuột di chuyển mượt mà không bị nháy)
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
          }
          setHoveredZone(zone);
          setPopupPosition({ x: e.point.x, y: e.point.y });
        }
      }
    };

    // 2. Hàm xử lý khi chuột rời đi
    const handleLeave = () => {
      map.getCanvas().style.cursor = "";
      // Delay một chút trước khi ẩn để người dùng kịp di chuột vào popup (nếu cần)
      hoverTimeoutRef.current = setTimeout(() => {
        setHoveredZone(null);
        setPopupPosition(null);
      }, 200);
    };

    // 3. Danh sách các layer cần bắt sự kiện
    const interactionLayers = ["flood-zones", "outage-zones", "zones-lines"];

    // 4. Gán sự kiện (Loop qua mảng cho gọn)
    interactionLayers.forEach((layer) => {
      // Kiểm tra xem layer có tồn tại không trước khi gán (để tránh lỗi warning)
      if (map.getLayer(layer)) {
        map.on("mousemove", layer, handleHover);
        map.on("mouseleave", layer, handleLeave);
      }
    });

    // 5. Cleanup khi unmount hoặc dependencies thay đổi
    return () => {
      interactionLayers.forEach((layer) => {
        if (map.getLayer(layer)) {
          map.off("mousemove", layer, handleHover);
          map.off("mouseleave", layer, handleLeave);
        }
      });

      // Clear timeout nếu component unmount
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, [map, zones, setHoveredZone, setPopupPosition]);
};
