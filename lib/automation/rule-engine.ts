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

import {
  getAllSensorRules,
  getAllSensors,
  Sensor,
} from "@/lib/db/sensor-rules";
import { createZone, getAllZones } from "@/lib/db/zones";

interface SensorReading {
  sensorId: string;
  value: number;
  timestamp: number;
  sensorName: string;
  type: string;
}

interface ExecutionResult {
  rulesChecked: number;
  rulesTriggered: number;
  zonesCreated: string[];
}

// Store latest sensor readings in memory (could be moved to DB if needed)
const sensorReadings = new Map<string, SensorReading>();

export function updateSensorReading(reading: SensorReading) {
  sensorReadings.set(reading.sensorId, reading);
}

export function getLatestReading(sensorId: string): SensorReading | undefined {
  return sensorReadings.get(sensorId);
}

export async function checkAndExecuteRules(
  reading: SensorReading,
  sensor: Sensor,
): Promise<ExecutionResult> {
  // Update sensor reading
  updateSensorReading(reading);

  const result: ExecutionResult = {
    rulesChecked: 0,
    rulesTriggered: 0,
    zonesCreated: [],
  };

  // Get all enabled rules
  const allRules = await getAllSensorRules();
  const enabledRules = allRules.filter((rule) => rule.enabled);

  for (const rule of enabledRules) {
    result.rulesChecked++;

    let shouldTrigger = false;

    if (rule.type === "1-sensor") {
      // Single sensor rule
      if (rule.sensors.includes(reading.sensorId)) {
        const condition = rule.metadata?.condition || "active";
        const thresholdExceeded = reading.value > sensor.threshold;

        if (condition === "active" && thresholdExceeded) {
          shouldTrigger = true;
        } else if (condition === "inactive" && !thresholdExceeded) {
          shouldTrigger = true;
        }
      }
    } else if (rule.type === "2-sensor") {
      // Two sensor rule with AND/OR operator
      const sensor1Reading = getLatestReading(rule.sensors[0]);
      const sensor2Reading = getLatestReading(rule.sensors[1]);

      if (sensor1Reading && sensor2Reading) {
        // Get sensor configs to check thresholds
        const sensors = await getAllSensors();
        const s1 = sensors.find((s: Sensor) => s.id === rule.sensors[0]);
        const s2 = sensors.find((s: Sensor) => s.id === rule.sensors[1]);

        if (s1 && s2) {
          const s1Triggered = sensor1Reading.value > s1.threshold;
          const s2Triggered = sensor2Reading.value > s2.threshold;

          if (rule.operator === "AND") {
            shouldTrigger = s1Triggered && s2Triggered;
          } else if (rule.operator === "OR") {
            shouldTrigger = s1Triggered || s2Triggered;
          }
        }
      }
    }

    if (shouldTrigger) {
      result.rulesTriggered++;

      // Create zone based on rule configuration
      const zoneId = await createAutomatedZone(rule, reading);
      if (zoneId) {
        result.zonesCreated.push(zoneId);
      }
    }
  }

  return result;
}

async function createAutomatedZone(
  rule: any,
  reading: SensorReading,
): Promise<string | null> {
  try {
    const zones = await getAllZones();

    // Check if zone already exists from this rule (prevent duplicates)
    const existingZone = zones.find(
      (z: any) =>
        z.automatedFrom === rule.id &&
        z.createdAt &&
        Date.now() - z.createdAt < 300000, // Within last 5 minutes
    );

    if (existingZone) {
      console.log("Zone already exists from this rule, skipping duplicate");
      return existingZone.id;
    }

    const zoneId = `auto-zone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    let newZone: any = {
      id: zoneId,
      type: rule.actionType,
      shape: rule.actionShape,
      title: `Tự Động: ${rule.name}`,
      description: `Được tạo tự động từ cảm biến ${reading.sensorName} (giá trị: ${reading.value})`,
      riskLevel: 80,
      createdAt: Date.now(),
      automatedFrom: rule.id,
      triggeredBy: reading.sensorId,
    };

    if (rule.actionShape === "circle") {
      // Use sensor location as center with default radius
      const sensors = await getAllSensors();
      const sensor = sensors.find((s: Sensor) => s.id === reading.sensorId);

      if (sensor && sensor.location) {
        newZone.center = sensor.location;
        newZone.radius = rule.actionRadius || 500; // 500m default
      } else {
        console.warn("Cannot create circle zone without sensor location");
        return null;
      }
    } else if (rule.actionShape === "line") {
      // Use points from rule metadata if available
      if (rule.metadata?.points && rule.metadata.points.length >= 2) {
        newZone.coordinates = rule.metadata.points;
      } else {
        console.warn("Cannot create line zone without points");
        return null;
      }
    }

    await createZone(newZone);

    console.log(`✅ Created automated zone: ${zoneId} from rule: ${rule.name}`);
    return zoneId;
  } catch (error) {
    console.error("Failed to create automated zone:", error);
    return null;
  }
}

// Clean up old automated zones (optional utility)
export async function cleanupOldAutomatedZones(maxAgeMs: number = 3600000) {
  try {
    const { deleteZone } = await import("@/lib/db/zones");
    const zones = await getAllZones();
    const now = Date.now();

    let removedCount = 0;
    for (const zone of zones) {
      const z = zone as any;
      if (z.automatedFrom && now - (z.createdAt || 0) >= maxAgeMs) {
        await deleteZone(z.id);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`🧹 Cleaned up ${removedCount} old automated zones`);
    }
  } catch (error) {
    console.error("Failed to cleanup zones:", error);
  }
}
