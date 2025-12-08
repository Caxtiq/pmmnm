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

// Notification Service for Real-time Alerts
export interface NotificationPreferences {
  enabled: boolean;
  severityLevels: ("high" | "medium" | "low")[];
  types: ("flood" | "outage" | "zone" | "all")[];
  radius: number; // in meters
  sound: boolean;
}

export interface NotificationData {
  id: string;
  title: string;
  body: string;
  type: "zone" | "report" | "alert";
  severity: "high" | "medium" | "low";
  location?: [number, number];
  timestamp: Date;
  read: boolean;
  url?: string;
}

class NotificationService {
  private static instance: NotificationService;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private notifications: NotificationData[] = [];
  private listeners: ((notification: NotificationData) => void)[] = [];

  private constructor() {
    this.loadNotifications();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Request notification permission
  public async requestPermission(): Promise<boolean> {
    if (!("Notification" in window)) {
      console.log("This browser does not support notifications");
      return false;
    }

    if (Notification.permission === "granted") {
      return true;
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    }

    return false;
  }

  // Show browser notification
  public showNotification(notification: NotificationData) {
    if (Notification.permission === "granted") {
      const notif = new Notification(notification.title, {
        body: notification.body,
        icon: "/notification-icon.png",
        badge: "/badge-icon.png",
        tag: notification.id,
        requireInteraction: notification.severity === "high",
        silent: !this.getPreferences().sound,
      });

      notif.onclick = () => {
        window.focus();
        if (notification.url) {
          window.location.href = notification.url;
        }
        this.markAsRead(notification.id);
      };
    }

    // Add to history
    this.addNotification(notification);
  }

  // Connect to WebSocket for real-time updates
  public connectWebSocket(userId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";
    this.ws = new WebSocket(`${wsUrl}?userId=${userId}`);

    this.ws.onopen = () => {
      console.log("WebSocket connected for notifications");
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const notification: NotificationData = JSON.parse(event.data);
        this.handleIncomingNotification(notification);
      } catch (error) {
        console.error("Failed to parse notification:", error);
      }
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    this.ws.onclose = () => {
      console.log("WebSocket closed");
      this.attemptReconnect(userId);
    };
  }

  private attemptReconnect(userId: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
      setTimeout(() => this.connectWebSocket(userId), this.reconnectDelay);
    }
  }

  // Handle incoming notification
  private handleIncomingNotification(notification: NotificationData) {
    const prefs = this.getPreferences();

    // Check if notifications are enabled
    if (!prefs.enabled) return;

    // Check severity filter
    if (!prefs.severityLevels.includes(notification.severity)) return;

    // Check type filter
    if (!prefs.types.includes("all")) {
      const notifType = notification.type === "zone" ? "zone" : "flood"; // Simplified
      if (!prefs.types.includes(notifType)) return;
    }

    // Check location proximity if location is provided
    if (notification.location && prefs.radius > 0) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const distance = this.calculateDistance(
            position.coords.latitude,
            position.coords.longitude,
            notification.location![1],
            notification.location![0],
          );

          if (distance <= prefs.radius) {
            this.showNotification(notification);
            this.notifyListeners(notification);
          }
        },
        (error) => {
          console.error("Location error:", error);
          // Show notification anyway if location fails
          this.showNotification(notification);
          this.notifyListeners(notification);
        },
      );
    } else {
      this.showNotification(notification);
      this.notifyListeners(notification);
    }
  }

  // Calculate distance between two points (Haversine formula)
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  // Preferences management
  public getPreferences(): NotificationPreferences {
    if (typeof window === "undefined") {
      return this.getDefaultPreferences();
    }
    const stored = localStorage.getItem("notification_preferences");
    return stored ? JSON.parse(stored) : this.getDefaultPreferences();
  }

  public setPreferences(prefs: NotificationPreferences) {
    localStorage.setItem("notification_preferences", JSON.stringify(prefs));
  }

  private getDefaultPreferences(): NotificationPreferences {
    return {
      enabled: true,
      severityLevels: ["high", "medium", "low"],
      types: ["all"],
      radius: 5000, // 5km default
      sound: true,
    };
  }

  // Notification history management
  private loadNotifications() {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("notifications");
    this.notifications = stored ? JSON.parse(stored) : [];
  }

  private saveNotifications() {
    localStorage.setItem("notifications", JSON.stringify(this.notifications));
  }

  private addNotification(notification: NotificationData) {
    this.notifications.unshift(notification);
    // Keep only last 50 notifications
    if (this.notifications.length > 50) {
      this.notifications = this.notifications.slice(0, 50);
    }
    this.saveNotifications();
  }

  public getNotifications(): NotificationData[] {
    return this.notifications;
  }

  public getUnreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  public markAsRead(id: string) {
    const notification = this.notifications.find((n) => n.id === id);
    if (notification) {
      notification.read = true;
      this.saveNotifications();
    }
  }

  public markAllAsRead() {
    this.notifications.forEach((n) => (n.read = true));
    this.saveNotifications();
  }

  public clearAll() {
    this.notifications = [];
    this.saveNotifications();
  }

  // Event listeners
  public addListener(listener: (notification: NotificationData) => void) {
    this.listeners.push(listener);
  }

  public removeListener(listener: (notification: NotificationData) => void) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  private notifyListeners(notification: NotificationData) {
    this.listeners.forEach((listener) => listener(notification));
  }

  // Disconnect WebSocket
  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export default NotificationService.getInstance();
