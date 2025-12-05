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

import { NextRequest, NextResponse } from "next/server";
import {
  insertSensorData,
  getRecentSensorData,
  SensorData,
} from "@/lib/db/sensors";
import { getAllSensors } from "@/lib/db/sensor-rules";
import { checkAndExecuteRules } from "@/lib/automation/rule-engine";

// GET /api/sensor-data - Get recent sensor data
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "100");

    const data = await getRecentSensorData(limit);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to get sensor data:", error);
    return NextResponse.json(
      { error: "Failed to get sensor data" },
      { status: 500 },
    );
  }
}

// POST /api/sensor-data - Insert sensor data and trigger automation
export async function POST(request: NextRequest) {
  try {
    const data: SensorData = await request.json();

    // Validate required fields
    if (!data.sensorId || typeof data.value !== "number") {
      return NextResponse.json(
        {
          error: "Invalid request format",
          required: { sensorId: "string", value: "number" },
          example: {
            sensorId: "sensor-123",
            value: 5.2,
            timestamp: 1234567890,
          },
        },
        { status: 400 },
      );
    }

    // Store sensor data
    const id = await insertSensorData(data);

    // Get sensor configuration
    const sensors = await getAllSensors();
    const sensor = sensors.find((s) => s.id === data.sensorId);

    if (!sensor) {
      return NextResponse.json(
        {
          warning: `Sensor ${data.sensorId} not found in system. Data saved but automation not triggered.`,
          id,
        },
        { status: 202 },
      );
    }

    // Trigger automation rules
    const sensorReading = {
      sensorId: data.sensorId,
      value: data.value,
      timestamp: data.timestamp || Date.now(),
      sensorName: sensor.name,
      type: sensor.type,
    };

    const executionResults = await checkAndExecuteRules(sensorReading, sensor);

    return NextResponse.json(
      {
        success: true,
        dataId: id,
        sensor: {
          id: sensor.id,
          name: sensor.name,
          threshold: sensor.threshold,
          currentValue: data.value,
        },
        thresholdExceeded: data.value > sensor.threshold,
        automation: {
          rulesChecked: executionResults.rulesChecked,
          rulesTriggered: executionResults.rulesTriggered,
          zonesCreated: executionResults.zonesCreated,
          message:
            executionResults.rulesTriggered > 0
              ? `Triggered ${executionResults.rulesTriggered} automation rule(s)`
              : "No rules triggered",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to insert sensor data:", error);
    return NextResponse.json(
      { error: "Failed to insert sensor data" },
      { status: 500 },
    );
  }
}
