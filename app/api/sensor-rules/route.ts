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
  getAllSensorRules,
  createSensorRule,
  updateSensorRule,
  deleteSensorRule,
  SensorRule,
} from "@/lib/db/sensor-rules";

// GET /api/sensor-rules - Get all sensor rules
export async function GET() {
  try {
    const rules = await getAllSensorRules();
    return NextResponse.json({ rules });
  } catch (error) {
    console.error("Failed to get sensor rules:", error);
    return NextResponse.json(
      { error: "Failed to get sensor rules" },
      { status: 500 },
    );
  }
}

// POST /api/sensor-rules - Create a new sensor rule
export async function POST(request: NextRequest) {
  try {
    const rule: SensorRule = await request.json();
    const newRule = await createSensorRule(rule);
    return NextResponse.json({ rule: newRule }, { status: 201 });
  } catch (error) {
    console.error("Failed to create sensor rule:", error);
    return NextResponse.json(
      { error: "Failed to create sensor rule" },
      { status: 500 },
    );
  }
}

// PATCH /api/sensor-rules?id=xxx - Update a sensor rule
export async function PATCH(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Rule ID required" }, { status: 400 });
    }
    const updates: Partial<SensorRule> = await request.json();
    await updateSensorRule(id, updates);
    return NextResponse.json({ message: "Rule updated" });
  } catch (error) {
    console.error("Failed to update sensor rule:", error);
    return NextResponse.json(
      { error: "Failed to update sensor rule" },
      { status: 500 },
    );
  }
}

// DELETE /api/sensor-rules?id=xxx - Delete a sensor rule
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Rule ID required" }, { status: 400 });
    }
    await deleteSensorRule(id);
    return NextResponse.json({ message: "Rule deleted" });
  } catch (error) {
    console.error("Failed to delete sensor rule:", error);
    return NextResponse.json(
      { error: "Failed to delete sensor rule" },
      { status: 500 },
    );
  }
}
