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

// WebSocket server for real-time notifications
import { WebSocketServer, WebSocket } from "ws";

interface Client {
  userId: string;
  ws: WebSocket;
}

const wss = new WebSocketServer({ port: 3001 });
const clients: Client[] = [];

console.log("WebSocket server started on port 3001");

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "", "ws://localhost");
  const userId = url.searchParams.get("userId");

  if (!userId) {
    ws.close();
    return;
  }

  // Add client
  const client: Client = { userId, ws };
  clients.push(client);
  console.log(`Client connected: ${userId}. Total clients: ${clients.length}`);

  ws.on("close", () => {
    const index = clients.findIndex((c) => c.ws === ws);
    if (index !== -1) {
      clients.splice(index, 1);
      console.log(
        `Client disconnected: ${userId}. Total clients: ${clients.length}`,
      );
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

// Broadcast notification to specific user
export function notifyUser(userId: string, notification: any) {
  const userClients = clients.filter((c) => c.userId === userId);
  userClients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(notification));
    }
  });
}

// Broadcast to all users near a location
export function notifyNearbyUsers(
  location: [number, number],
  radiusKm: number,
  notification: any,
) {
  // For simplicity, broadcast to all clients
  // In production, you'd filter by actual user location
  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(notification));
    }
  });
}

// Broadcast to all users
export function notifyAllUsers(notification: any) {
  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(notification));
    }
  });
}

export default wss;
