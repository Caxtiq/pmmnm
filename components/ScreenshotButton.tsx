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

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCamera, faDownload } from "@fortawesome/free-solid-svg-icons";
import html2canvas from "html2canvas";
import { useToast } from "./ToastProvider";

interface ScreenshotButtonProps {
  mapContainerId?: string;
}

export default function ScreenshotButton({
  mapContainerId = "map",
}: ScreenshotButtonProps) {
  const { showToast } = useToast();
  const [isCapturing, setIsCapturing] = useState(false);

  const handleScreenshot = async () => {
    setIsCapturing(true);
    try {
      const mapElement = document.getElementById(mapContainerId);
      if (!mapElement) {
        showToast("Không tìm thấy bản đồ", "error");
        return;
      }

      // Hide UI elements temporarily
      const uiElements = document.querySelectorAll(".fixed, .absolute");
      const originalDisplays: string[] = [];
      uiElements.forEach((el) => {
        originalDisplays.push((el as HTMLElement).style.display);
        (el as HTMLElement).style.display = "none";
      });

      // Capture the screenshot
      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        scale: 2, // Higher quality
      });

      // Restore UI elements
      uiElements.forEach((el, index) => {
        (el as HTMLElement).style.display = originalDisplays[index];
      });

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.download = `map-screenshot-${Date.now()}.png`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
        }
      });

      // Show success message
      const notification = document.createElement("div");
      notification.className =
        "fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-2xl z-[9999] animate-fadeIn";
      notification.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="text-2xl">📸</span>
          <div>
            <div class="font-bold">Đã chụp màn hình!</div>
            <div class="text-sm">Ảnh đã được tải xuống</div>
          </div>
        </div>
      `;
      document.body.appendChild(notification);
      setTimeout(() => {
        notification.style.opacity = "0";
        notification.style.transition = "opacity 0.5s";
        setTimeout(() => notification.remove(), 500);
      }, 3000);
    } catch (error) {
      console.error("Screenshot error:", error);
      showToast("Không thể chụp màn hình. Vui lòng thử lại.", "error");
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <button
      onClick={handleScreenshot}
      disabled={isCapturing}
      className="p-4 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-full shadow-2xl hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed border-2 border-gray-200 dark:border-gray-700"
      title="Chụp màn hình bản đồ"
    >
      <FontAwesomeIcon
        icon={isCapturing ? faDownload : faCamera}
        size="lg"
        className={isCapturing ? "animate-pulse" : ""}
      />
    </button>
  );
}
