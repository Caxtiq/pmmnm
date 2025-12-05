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
import { getAllZones, createZone, deleteAllZones, Zone } from "@/lib/db/zones";

// GET /api/zones - Get all zones
export async function GET() {
  try {
    const zones = await getAllZones();
    return NextResponse.json({ zones });
  } catch (error) {
    console.error("Failed to get zones:", error);
    return NextResponse.json({ error: "Failed to get zones" }, { status: 500 });
  }
}

// POST /api/zones - Create a new zone
export async function POST(request: NextRequest) {
  try {
    const zone: Zone = await request.json();
    const newZone = await createZone(zone);
    return NextResponse.json({ zone: newZone }, { status: 201 });
  } catch (error) {
    console.error("Failed to create zone:", error);
    return NextResponse.json(
      { error: "Failed to create zone" },
      { status: 500 },
    );
  }
}

// DELETE /api/zones - Delete all zones
export async function DELETE() {
  try {
    await deleteAllZones();
    return NextResponse.json({ message: "All zones deleted" });
  } catch (error) {
    console.error("Failed to delete zones:", error);
    return NextResponse.json(
      { error: "Failed to delete zones" },
      { status: 500 },
    );
  }
}
