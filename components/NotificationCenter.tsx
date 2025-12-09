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

import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBell,
  faTimes,
  faCog,
  faCheck,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import notificationService, {
  NotificationData,
  NotificationPreferences,
} from "@/lib/notificationService";

export default function NotificationCenter({
  userId,
}: {
  userId: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    notificationService.getPreferences(),
  );
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    if (!userId) return;

    // Request notification permission
    notificationService.requestPermission().then((granted) => {
      setPermissionGranted(granted);
    });

    // Connect WebSocket
    notificationService.connectWebSocket(userId);

    // Load initial data
    setNotifications(notificationService.getNotifications());
    setUnreadCount(notificationService.getUnreadCount());

    // Listen for new notifications
    const listener = (notification: NotificationData) => {
      setNotifications(notificationService.getNotifications());
      setUnreadCount(notificationService.getUnreadCount());
    };
    notificationService.addListener(listener);

    return () => {
      notificationService.removeListener(listener);
    };
  }, [userId]);

  const handleMarkAsRead = (id: string) => {
    notificationService.markAsRead(id);
    setNotifications(notificationService.getNotifications());
    setUnreadCount(notificationService.getUnreadCount());
  };

  const handleMarkAllAsRead = () => {
    notificationService.markAllAsRead();
    setNotifications(notificationService.getNotifications());
    setUnreadCount(0);
  };

  const handleClearAll = () => {
    notificationService.clearAll();
    setNotifications([]);
    setUnreadCount(0);
  };

  const handleSavePreferences = () => {
    notificationService.setPreferences(preferences);
    setShowSettings(false);
  };

  const handleRequestPermission = async () => {
    const granted = await notificationService.requestPermission();
    setPermissionGranted(granted);
    if (granted) {
      setPreferences({ ...preferences, enabled: true });
      notificationService.setPreferences({ ...preferences, enabled: true });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-red-100 text-red-700 border-red-300";
      case "medium":
        return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "low":
        return "bg-blue-100 text-blue-700 border-blue-300";
      default:
        return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  if (!userId) return null;

  return (
    <>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-4 bg-white rounded-full shadow-2xl hover:shadow-xl transition-all z-30"
        title="Thông báo"
      >
        <FontAwesomeIcon icon={faBell} className="text-blue-600 text-xl" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="fixed top-20 right-4 w-96 max-h-[600px] bg-white rounded-2xl shadow-2xl z-[100] flex flex-col animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">Thông báo</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Cài đặt"
              >
                <FontAwesomeIcon icon={faCog} className="text-gray-600" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FontAwesomeIcon icon={faTimes} className="text-gray-600" />
              </button>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h4 className="font-bold mb-3">Cài đặt thông báo</h4>

              {!permissionGranted && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800 mb-2">
                    Vui lòng cấp quyền thông báo để nhận cảnh báo thời gian thực
                  </p>
                  <button
                    onClick={handleRequestPermission}
                    className="text-sm bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors"
                  >
                    Cấp quyền
                  </button>
                </div>
              )}

              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.enabled}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        enabled: e.target.checked,
                      })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Bật thông báo</span>
                </label>

                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Mức độ nghiêm trọng
                  </label>
                  <div className="space-y-1">
                    {["high", "medium", "low"].map((level) => (
                      <label key={level} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={preferences.severityLevels.includes(
                            level as any,
                          )}
                          onChange={(e) => {
                            const levels = e.target.checked
                              ? [...preferences.severityLevels, level as any]
                              : preferences.severityLevels.filter(
                                  (l) => l !== level,
                                );
                            setPreferences({
                              ...preferences,
                              severityLevels: levels,
                            });
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm capitalize">
                          {level === "high"
                            ? "Cao"
                            : level === "medium"
                              ? "Trung bình"
                              : "Thấp"}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Bán kính cảnh báo
                  </label>
                  <select
                    value={preferences.radius}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        radius: Number(e.target.value),
                      })
                    }
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value={1000}>1 km</option>
                    <option value={3000}>3 km</option>
                    <option value={5000}>5 km</option>
                    <option value={10000}>10 km</option>
                    <option value={20000}>20 km</option>
                  </select>
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.sound}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        sound: e.target.checked,
                      })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Âm thanh</span>
                </label>

                <button
                  onClick={handleSavePreferences}
                  className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                >
                  Lưu cài đặt
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          {notifications.length > 0 && (
            <div className="flex gap-2 p-3 border-b border-gray-200 bg-gray-50">
              <button
                onClick={handleMarkAllAsRead}
                className="flex-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <FontAwesomeIcon icon={faCheck} className="mr-1" />
                Đánh dấu đã đọc
              </button>
              <button
                onClick={handleClearAll}
                className="flex-1 text-sm text-red-600 hover:text-red-700 font-medium"
              >
                <FontAwesomeIcon icon={faTrash} className="mr-1" />
                Xóa tất cả
              </button>
            </div>
          )}

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto p-2">
            {notifications.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FontAwesomeIcon
                  icon={faBell}
                  className="text-4xl mb-3 opacity-50"
                />
                <p>Chưa có thông báo</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                      notification.read
                        ? "bg-white border-gray-200 opacity-70"
                        : "bg-blue-50 border-blue-300 shadow-sm"
                    }`}
                    onClick={() => handleMarkAsRead(notification.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-bold text-sm text-gray-900 flex-1">
                        {notification.title}
                      </h4>
                      <span
                        className={`text-xs px-2 py-1 rounded-lg border ${getSeverityColor(notification.severity)}`}
                      >
                        {notification.severity === "high"
                          ? "Cao"
                          : notification.severity === "medium"
                            ? "Trung bình"
                            : "Thấp"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">
                      {notification.body}
                    </p>
                    <span className="text-xs text-gray-500">
                      {new Date(notification.timestamp).toLocaleString("vi-VN")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
