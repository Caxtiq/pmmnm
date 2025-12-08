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

import { Server } from "bun";

const server = Bun.serve({
  port: 3001,

  fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (req.headers.get("upgrade") === "websocket") {
      const userId = url.searchParams.get("userId");
      if (!userId) {
        return new Response("Missing userId", { status: 400 });
      }

      const success = server.upgrade(req, {
        data: { userId },
      });

      if (success) {
        return undefined;
      }

      return new Response("WebSocket upgrade failed", { status: 500 });
    }

    return new Response("Not found", { status: 404 });
  },

  websocket: {
    open(ws) {
      console.log("WebSocket connected:", ws.data.userId);
    },

    message(ws, message) {
      console.log("Message from", ws.data.userId, ":", message);
    },

    close(ws) {
      console.log("WebSocket disconnected:", ws.data.userId);
    },
  },
});

console.log(`WebSocket server running on port ${server.port}`);

// Export for use in API routes
export function notifyUser(userId: string, notification: any) {
  // Bun's WebSocket doesn't expose active connections directly
  // In production, use a Map to track connections
  console.log("Notify user:", userId, notification);
}

export function notifyNearbyUsers(
  location: [number, number],
  radiusKm: number,
  notification: any,
) {
  console.log("Notify nearby users:", location, radiusKm, notification);
}

export function notifyAllUsers(notification: any) {
  console.log("Notify all users:", notification);
}
