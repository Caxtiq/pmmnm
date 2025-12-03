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

  // Dùng ref để giữ instance map thật sự, tránh bị lừa bởi state ảo trong Strict Mode
  const mapInstanceRef = useRef<vietmapgl.Map | null>(null);

  useEffect(() => {
    // 1. Chỉ chạy khi đã mount và có thẻ div
    if (!isMounted || !mapContainerRef.current) return;

    // 2. CHỐT CHẶN QUAN TRỌNG: Nếu ref đã giữ map rồi thì không tạo mới
    if (mapInstanceRef.current) return;

    const apiKey = process.env.NEXT_PUBLIC_VIETMAP_API_KEY || "";

    // 3. Khởi tạo Map
    const mapInstance = new vietmapgl.Map({
      container: mapContainerRef.current,
      style: `https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=${apiKey}`,
      center: [105.748684, 20.962594],
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

    // 4. Lưu instance vào Ref ngay lập tức
    mapInstanceRef.current = mapInstance;

    mapInstance.addControl(new vietmapgl.NavigationControl(), "top-right");
    mapInstance.addControl(
      new vietmapgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
    );

    mapInstance.on("load", () => {
      // Init các Sources & Layers rỗng (giữ nguyên logic cũ của bạn)
      mapInstance.addSource("zones", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      if (isAdmin) {
        mapInstance.addSource("sensors", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }

      // Add Layers (Flood, Outage, Lines...) - Code cũ của bạn
      mapInstance.addLayer({
        id: "flood-zones",
        type: "fill",
        source: "zones",
        filter: [
          "all",
          ["==", ["get", "type"], "flood"],
          ["==", ["get", "shape"], "circle"],
        ],
        paint: { "fill-color": "#3b82f6", "fill-opacity": 0.4 },
      });

      // ... (Giữ nguyên các layer khác) ...
      mapInstance.addLayer({
        id: "zones-outline",
        type: "line",
        source: "zones",
        filter: ["==", ["get", "shape"], "circle"],
        paint: {
          "line-color": "#000000",
          "line-width": 2,
        },
      });

      // Cuối cùng mới set vào State để kích hoạt các hook khác
      setMap(mapInstance);
    });

    // 5. Cleanup function
    return () => {
      mapInstance.remove();
      mapInstanceRef.current = null; // Reset ref về null để lần sau tạo lại được
      // setMap(null); // Không cần setMap(null) ở đây để tránh re-render thừa
    };
  }, [isMounted, isAdmin]); // Dependencies

  return { map, mapContainerRef };
};
