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

const port = parseInt(process.env.PORT || "3000", 10);

const clients = new Set<any>();

Bun.serve({
  port,
  fetch(req, server) {
    const url = new URL(req.url);

    // Handle WebSocket upgrade
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req);
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return undefined;
    }

    // Proxy all other requests to Next.js dev server
    return fetch(`http://localhost:${port + 1}${url.pathname}${url.search}`, {
      method: req.method,
      headers: req.headers,
      body: req.body,
    });
  },
  websocket: {
    open(ws) {
      console.log("Client connected");
      clients.add(ws);
    },
    message(ws, message) {
      try {
        const data =
          typeof message === "string"
            ? message
            : new TextDecoder().decode(message);
        const parsed = JSON.parse(data);
        console.log("Received:", parsed);

        // Broadcast to all other clients
        clients.forEach((client) => {
          if (client !== ws) {
            client.send(JSON.stringify(parsed));
          }
        });
      } catch (error) {
        console.error("Failed to parse message:", error);
      }
    },
    close(ws) {
      console.log("Client disconnected");
      clients.delete(ws);
    },
    error(ws, error) {
      console.error("WebSocket error:", error);
      clients.delete(ws);
    },
  },
});

console.log(`> WebSocket server ready on ws://localhost:${port}/ws`);
console.log(`> Proxying HTTP requests to Next.js on port ${port + 1}`);
console.log(`> Run 'bun run dev:next' in another terminal`);
