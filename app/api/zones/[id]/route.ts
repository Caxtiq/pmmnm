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
import { deleteZone, updateZone, Zone } from "@/lib/db/zones";

// PATCH /api/zones/[id] - Update a zone
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const updates: Partial<Zone> = await request.json();
    await updateZone(id, updates);
    return NextResponse.json({ message: "Zone updated" });
  } catch (error) {
    console.error("Failed to update zone:", error);
    return NextResponse.json(
      { error: "Failed to update zone" },
      { status: 500 },
    );
  }
}

// DELETE /api/zones/[id] - Delete a zone
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await deleteZone(id);
    return NextResponse.json({ message: "Zone deleted" });
  } catch (error) {
    console.error("Failed to delete zone:", error);
    return NextResponse.json(
      { error: "Failed to delete zone" },
      { status: 500 },
    );
  }
}
