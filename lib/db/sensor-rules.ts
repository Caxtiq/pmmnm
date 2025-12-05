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

export interface Sensor {
  id: string;
  name: string;
  location: [number, number];
  type: "water_level" | "temperature" | "humidity";
  threshold: number;
  actionType: "flood" | "outage";
  actionTarget?: string;
  createdAt?: number;
}

export interface SensorRule {
  id: string;
  name: string;
  type: "1-sensor" | "2-sensor";
  sensors: string[];
  operator?: "AND" | "OR";
  actionType: "flood" | "outage";
  actionShape: "circle" | "line";
  actionCoordinates?: number[][] | number[];
  actionRadius?: number;
  enabled: boolean;
  createdAt?: number;
  metadata?: {
    condition?: "active" | "inactive";
    points?: [number, number][];
  };
}

// Get all sensors
export async function getAllSensors(): Promise<Sensor[]> {
  try {
    const db = await getDatabase();
    const sensors = await db
      .collection(COLLECTIONS.SENSORS)
      .find({ name: { $exists: true } })
      .toArray();
    return sensors.map((s) => ({ ...s, _id: undefined }) as any);
  } catch {
    return [];
  }
}

// Create sensor
export async function createSensor(sensor: Sensor): Promise<Sensor> {
  const db = await getDatabase();
  const newSensor = { ...sensor, createdAt: Date.now() };
  await db.collection(COLLECTIONS.SENSORS).insertOne(newSensor as any);
  return newSensor;
}

// Update sensor
export async function updateSensor(
  id: string,
  updates: Partial<Sensor>,
): Promise<void> {
  const db = await getDatabase();
  await db
    .collection(COLLECTIONS.SENSORS)
    .updateOne({ id, name: { $exists: true } }, { $set: updates });
}

// Delete sensor
export async function deleteSensor(id: string): Promise<void> {
  const db = await getDatabase();
  await db
    .collection(COLLECTIONS.SENSORS)
    .deleteOne({ id, name: { $exists: true } });
}

// Get all sensor rules
export async function getAllSensorRules(): Promise<SensorRule[]> {
  try {
    const db = await getDatabase();
    const rules = await db
      .collection(COLLECTIONS.SENSOR_RULES)
      .find({})
      .toArray();
    return rules.map((r) => ({ ...r, _id: undefined }) as any);
  } catch {
    return [];
  }
}

// Create sensor rule
export async function createSensorRule(rule: SensorRule): Promise<SensorRule> {
  const db = await getDatabase();
  const newRule = { ...rule, createdAt: Date.now() };
  await db.collection(COLLECTIONS.SENSOR_RULES).insertOne(newRule as any);
  return newRule;
}

// Update sensor rule
export async function updateSensorRule(
  id: string,
  updates: Partial<SensorRule>,
): Promise<void> {
  const db = await getDatabase();
  await db
    .collection(COLLECTIONS.SENSOR_RULES)
    .updateOne({ id }, { $set: updates });
}

// Delete sensor rule
export async function deleteSensorRule(id: string): Promise<void> {
  const db = await getDatabase();
  await db.collection(COLLECTIONS.SENSOR_RULES).deleteOne({ id });
}

// Toggle sensor rule
export async function toggleSensorRule(id: string): Promise<void> {
  const db = await getDatabase();
  const rule = await db.collection(COLLECTIONS.SENSOR_RULES).findOne({ id });
  if (rule) {
    await db
      .collection(COLLECTIONS.SENSOR_RULES)
      .updateOne({ id }, { $set: { enabled: !rule.enabled } });
  }
}
