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

// MongoDB collection names and indexes
export const COLLECTIONS = {
  ZONES: "zones",
  SENSORS: "sensors",
  SENSOR_DATA: "sensor_data",
  SENSOR_RULES: "sensor_rules",
  PREDICTIONS: "predictions",
  USER_REPORTS: "user_reports",
  USERS: "users",
  AI_TRAFFIC_ANALYSIS: "ai_traffic_analysis",
  CAMERAS: "cameras",
  CAMERA_DETECTION_LOGS: "camera_detection_logs",
};

// Initialize database indexes
export async function initializeIndexes(db: any) {
  try {
    // Zones indexes
    await db.collection(COLLECTIONS.ZONES).createIndex({ type: 1 });
    await db.collection(COLLECTIONS.ZONES).createIndex({ createdAt: -1 });

    // Sensors indexes
    await db
      .collection(COLLECTIONS.SENSORS)
      .createIndex({ id: 1 }, { unique: true });

    // Sensor data indexes
    await db
      .collection(COLLECTIONS.SENSOR_DATA)
      .createIndex({ sensorId: 1, timestamp: -1 });
    await db.collection(COLLECTIONS.SENSOR_DATA).createIndex({ timestamp: -1 });

    // Sensor rules indexes
    await db
      .collection(COLLECTIONS.SENSOR_RULES)
      .createIndex({ id: 1 }, { unique: true });
    await db.collection(COLLECTIONS.SENSOR_RULES).createIndex({ enabled: 1 });

    // Predictions indexes
    await db
      .collection(COLLECTIONS.PREDICTIONS)
      .createIndex({ type: 1, timestamp: -1 });
    await db.collection(COLLECTIONS.PREDICTIONS).createIndex({ expiresAt: 1 });

    // User reports indexes
    await db
      .collection(COLLECTIONS.USER_REPORTS)
      .createIndex({ id: 1 }, { unique: true });
    await db
      .collection(COLLECTIONS.USER_REPORTS)
      .createIndex({ type: 1, createdAt: -1 });
    await db.collection(COLLECTIONS.USER_REPORTS).createIndex({ status: 1 });
    await db
      .collection(COLLECTIONS.USER_REPORTS)
      .createIndex({ createdAt: -1 });

    // Camera indexes
    await db
      .collection(COLLECTIONS.CAMERAS)
      .createIndex({ id: 1 }, { unique: true });
    await db.collection(COLLECTIONS.CAMERAS).createIndex({ status: 1 });
    await db.collection(COLLECTIONS.CAMERAS).createIndex({ createdAt: -1 });

    // Camera detection logs indexes
    await db
      .collection(COLLECTIONS.CAMERA_DETECTION_LOGS)
      .createIndex({ cameraId: 1, timestamp: -1 });
    await db
      .collection(COLLECTIONS.CAMERA_DETECTION_LOGS)
      .createIndex({ timestamp: -1 });

    console.log("MongoDB indexes initialized");
  } catch (error) {
    console.error("Error initializing indexes:", error);
  }
}
