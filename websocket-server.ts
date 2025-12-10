import { Server, ServerWebSocket } from 'bun';
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

interface WebSocketData {
  userId?: string;
  cameraId?: string;
  type: 'user' | 'camera' | 'signaling';
}

// Track all active connections
const connections = new Map<string, ServerWebSocket<WebSocketData>>();

const server = Bun.serve<WebSocketData>({
  port: 3001,

  fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (req.headers.get("upgrade") === "websocket") {
      const userId = url.searchParams.get("userId");
      const cameraId = url.searchParams.get("cameraId");
      const path = url.pathname;

      let wsData: WebSocketData;

      if (path === '/camera-feed' && cameraId) {
        // Camera detection data connection
        wsData = { type: 'camera', cameraId };
      } else if (path === '/signaling') {
        // WebRTC signaling connection
        wsData = { type: 'signaling', userId: userId || 'anonymous' };
      } else if (userId) {
        // User notification connection
        wsData = { type: 'user', userId };
      } else {
        return new Response("Invalid connection parameters", { status: 400 });
      }

      const success = server.upgrade(req, {
        data: wsData,
      });

      if (success) {
        return undefined;
      }

      return new Response("WebSocket upgrade failed", { status: 500 });
    }

    return new Response("Not found", { status: 404 });
  },

  websocket: {
    open(ws: ServerWebSocket<WebSocketData>) {
      const connId = ws.data.userId || ws.data.cameraId || Math.random().toString();
      connections.set(connId, ws);
      console.log(`WebSocket connected [${ws.data.type}]:`, connId);
    },
    
    async message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
      try {
        const data = JSON.parse(message.toString());

        // Handle camera detection data
        if (ws.data.type === 'camera' && data.type === 'detection') {
          await handleCameraDetection(data);
          // Broadcast to all user connections
          broadcastToUsers({
            type: 'camera-update',
            cameraId: data.cameraId,
            counts: data.counts,
            timestamp: data.timestamp,
          });
        }

        // Handle WebRTC signaling
        if (ws.data.type === 'signaling') {
          await handleSignaling(ws, data);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    },
    
    close(ws: ServerWebSocket<WebSocketData>) {
      const connId = ws.data.userId || ws.data.cameraId || '';
      connections.delete(connId);
      console.log(`WebSocket disconnected [${ws.data.type}]:`, connId);
    }
  }
});

// Handler functions
import { updateCameraCounts, getCameraById, updateCameraWebRTC } from './lib/db/cameras';

async function handleCameraDetection(data: any) {
  const { cameraId, counts, uniqueCounts, timestamp } = data;
  
  try {
    // Update camera counts in database
    await updateCameraCounts(cameraId, counts, uniqueCounts);
    
    // Check if thresholds are exceeded
    const camera = await getCameraById(cameraId);
    if (!camera) return;
    
    const thresholds = camera.thresholds;
    if (!thresholds) return;
    
    const exceeded = Object.keys(counts).some((key) => {
      const vehicleType = key as keyof typeof counts;
      const threshold = thresholds[vehicleType as keyof typeof thresholds];
      return threshold !== undefined && counts[vehicleType] > threshold;
    });
    
    if (exceeded) {
      console.log(`⚠️  Camera ${cameraId} threshold exceeded:`, counts);
      
      // TODO: Execute camera actions
      // - Create flood/outage zones
      // - Send alerts
      // - Trigger graph nodes
    }
  } catch (error) {
    console.error('Error handling camera detection:', error);
  }
}

function broadcastToUsers(message: any) {
  connections.forEach((ws, id) => {
    if (ws.data.type === 'user') {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Error sending to user ${id}:`, error);
      }
    }
  });
}

// WebRTC signaling messages storage
const signalingMessages = new Map<string, any[]>();

async function handleSignaling(ws: ServerWebSocket<WebSocketData>, data: any) {
  const { type, cameraId, peerId, sdp, candidate } = data;
  
  // Store signaling messages for camera peers
  if (type === 'offer' || type === 'answer') {
    if (!signalingMessages.has(cameraId)) {
      signalingMessages.set(cameraId, []);
    }
    signalingMessages.get(cameraId)?.push({ type, sdp, peerId, timestamp: Date.now() });
    
    // Forward to camera peer if connected
    const cameraWs = Array.from(connections.values()).find(
      (c) => c.data.type === 'camera' && c.data.cameraId === cameraId
    );
    
    if (cameraWs) {
      cameraWs.send(JSON.stringify({ type, peerId, sdp, candidate }));
    }
    
    // Update camera WebRTC state
    await updateCameraWebRTC(cameraId, { signalingState: 'connecting' });
  }
  
  // ICE candidates
  if (type === 'ice-candidate') {
    const cameraWs = Array.from(connections.values()).find(
      (c) => c.data.type === 'camera' && c.data.cameraId === cameraId
    );
    
    if (cameraWs) {
      cameraWs.send(JSON.stringify({ type: 'ice-candidate', candidate, peerId }));
    }
  }
  
  // Connection established
  if (type === 'connected') {
    await updateCameraWebRTC(cameraId, { 
      signalingState: 'connected',
      lastConnected: Date.now()
    });
  }
}

console.log(`WebSocket server running on port ${server.port}`);

// Export for use in API routes
export function notifyUser(userId: string, notification: any) {
  const ws = connections.get(userId);
  if (ws && ws.data.type === 'user') {
    ws.send(JSON.stringify(notification));
  }
}

export function notifyNearbyUsers(
  location: [number, number],
  radiusKm: number,
  notification: any,
) {
  // TODO: Filter users by location
  broadcastToUsers(notification);
}

export function notifyAllUsers(notification: any) {
  broadcastToUsers(notification);
}

export function sendToCamera(cameraId: string, message: any) {
  const ws = Array.from(connections.values()).find(
    (c) => c.data.type === 'camera' && c.data.cameraId === cameraId
  );
  
  if (ws) {
    ws.send(JSON.stringify(message));
  }
}
