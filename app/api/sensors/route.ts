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
  getAllSensors,
  createSensor,
  deleteSensor,
  Sensor,
} from "@/lib/db/sensor-rules";

// GET /api/sensors - Get all sensors
export async function GET() {
  try {
    const sensors = await getAllSensors();
    return NextResponse.json({ sensors });
  } catch (error) {
    console.error("Failed to get sensors:", error);
    return NextResponse.json(
      { error: "Failed to get sensors" },
      { status: 500 },
    );
  }
}

// POST /api/sensors - Create a new sensor
export async function POST(request: NextRequest) {
  try {
    const sensor: Sensor = await request.json();
    const newSensor = await createSensor(sensor);
    return NextResponse.json({ sensor: newSensor }, { status: 201 });
  } catch (error) {
    console.error("Failed to create sensor:", error);
    return NextResponse.json(
      { error: "Failed to create sensor" },
      { status: 500 },
    );
  }
}

// DELETE /api/sensors?id=xxx - Delete a sensor
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "Sensor ID required" },
        { status: 400 },
      );
    }
    await deleteSensor(id);
    return NextResponse.json({ message: "Sensor deleted" });
  } catch (error) {
    console.error("Failed to delete sensor:", error);
    return NextResponse.json(
      { error: "Failed to delete sensor" },
      { status: 500 },
    );
  }
}
