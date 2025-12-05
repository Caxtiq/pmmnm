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

import { getDatabase } from "../mongodb";
import { COLLECTIONS } from "./collections";

export interface SensorData {
  id?: number;
  sensorId: string;
  timestamp: number;
  waterLevel?: number;
  temperature?: number;
  humidity?: number;
  location?: [number, number];
  data?: any;
}

// Insert sensor data
export async function insertSensorData(data: SensorData): Promise<number> {
  const db = await getDatabase();
  const collection = db.collection(COLLECTIONS.SENSOR_DATA);

  // Get next ID
  const lastDoc = await collection.findOne({}, { sort: { id: -1 } });
  const id = lastDoc?.id ? lastDoc.id + 1 : 1;

  const newData = { ...data, id };
  await collection.insertOne(newData as any);
  return id;
}

// Get recent sensor data
export async function getRecentSensorData(
  limit: number = 100,
): Promise<SensorData[]> {
  const db = await getDatabase();
  const data = await db
    .collection(COLLECTIONS.SENSOR_DATA)
    .find({})
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();
  return data.map((d) => ({ ...d, _id: undefined }) as any);
}

// Get sensor data by sensor ID
export async function getSensorDataBySensorId(
  sensorId: string,
  limit: number = 100,
): Promise<SensorData[]> {
  const db = await getDatabase();
  const data = await db
    .collection(COLLECTIONS.SENSOR_DATA)
    .find({ sensorId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();
  return data.map((d) => ({ ...d, _id: undefined }) as any);
}

// Delete old sensor data
export async function deleteOldSensorData(olderThan: number): Promise<number> {
  const db = await getDatabase();
  const result = await db.collection(COLLECTIONS.SENSOR_DATA).deleteMany({
    timestamp: { $lt: olderThan },
  });
  return result.deletedCount;
}
