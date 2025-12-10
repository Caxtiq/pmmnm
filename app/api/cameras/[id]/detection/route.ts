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

import { NextRequest, NextResponse } from 'next/server';
import { updateCameraCounts, getCameraById } from '@/lib/db/cameras';

// POST /api/cameras/[id]/detection - Update camera detection counts
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cameraId } = await params;
    const body = await request.json();

    const { counts, uniqueCounts, detections, timestamp } = body;

    // Validate required fields
    if (!counts || typeof counts !== 'object') {
      return NextResponse.json(
        { error: 'Missing or invalid counts object' },
        { status: 400 }
      );
    }

    // Check if camera exists
    const camera = await getCameraById(cameraId);
    if (!camera) {
      return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
    }

    // Update camera counts in database
    await updateCameraCounts(cameraId, counts, uniqueCounts || counts);

    // Check if thresholds are exceeded
    const thresholds = camera.thresholds;
    const exceeded: { [key: string]: { count: number; threshold: number } } = {};
    
    if (thresholds) {
      Object.keys(counts).forEach((key) => {
        const vehicleType = key as string;
        const threshold = thresholds[vehicleType as keyof typeof thresholds];
        if (threshold !== undefined && counts[vehicleType] > threshold) {
          exceeded[vehicleType] = {
            count: counts[vehicleType],
            threshold,
          };
        }
      });
    }

    const isExceeded = Object.keys(exceeded).length > 0;

    if (isExceeded) {
      console.log(`⚠️  Camera ${cameraId} threshold exceeded:`, exceeded);
      // TODO: Trigger alerts/actions
    }

    return NextResponse.json({
      success: true,
      cameraId,
      counts,
      thresholds: camera.thresholds,
      exceeded: isExceeded ? exceeded : null,
      timestamp: timestamp || Date.now(),
    });
  } catch (error) {
    console.error('Error updating camera detection:', error);
    return NextResponse.json(
      { error: 'Failed to update detection data' },
      { status: 500 }
    );
  }
}
