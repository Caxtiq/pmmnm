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
import {
  getAllCameras,
  getActiveCameras,
  getCameraById,
  createCamera,
  updateCamera,
  deleteCamera,
  updateCameraStatus,
  updateCameraCounts,
  Camera,
} from '@/lib/db/cameras';

// GET /api/cameras - Get all cameras or filter by status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const id = searchParams.get('id');

    if (id) {
      const camera = await getCameraById(id);
      if (!camera) {
        return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
      }
      return NextResponse.json(camera);
    }

    const cameras = status === 'active' 
      ? await getActiveCameras() 
      : await getAllCameras();

    return NextResponse.json({ cameras });
  } catch (error) {
    console.error('Error fetching cameras:', error);
    return NextResponse.json({ error: 'Failed to fetch cameras' }, { status: 500 });
  }
}

// POST /api/cameras - Create new camera
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Generate unique ID if not provided
    const cameraId = body.id || `camera_${Date.now()}`;

    // Validate required fields
    if (!body.name || !body.path || !Array.isArray(body.path) || body.path.length < 2) {
      return NextResponse.json(
        { error: 'Missing required fields: name, path (minimum 2 points)' },
        { status: 400 }
      );
    }

    // Check if camera with this ID already exists
    const existing = await getCameraById(cameraId);
    if (existing) {
      return NextResponse.json(
        { error: 'Camera with this ID already exists' },
        { status: 409 }
      );
    }

    // Set defaults (handle both isActive and status for backwards compatibility)
    const isActive = body.isActive !== undefined ? body.isActive : (body.status === 'active');
    
    const camera: Omit<Camera, '_id' | 'createdAt' | 'updatedAt'> = {
      id: cameraId,
      name: body.name,
      path: body.path,
      status: isActive ? 'active' : 'inactive',
      streamUrl: body.streamUrl || '',
      threshold: body.threshold || 50,
      thresholds: body.thresholds || {
        bicycle: 20,
        bus: 5,
        car: 30,
        container_truck: 3,
        fire_engine: 1,
        motorcycle: 50,
        truck: 10,
        van: 15,
        total: 100,
      },
      actions: body.actions || {
        createFloodZone: false,
        createOutageZone: false,
        sendAlert: true,
        triggerGraphNode: [],
      },
      currentCounts: {
        bicycle: 0,
        bus: 0,
        car: 0,
        container_truck: 0,
        fire_engine: 0,
        motorcycle: 0,
        truck: 0,
        van: 0,
        total: 0,
      },
      stats: {
        lastUpdate: Date.now(),
        avgVehiclesPerMinute: 0,
        peakTime: new Date().toISOString(),
        peakCount: 0,
      },
      webrtc: {
        peerId: body.webrtc?.peerId || body.id,
        signalingState: 'disconnected',
      },
    };

    const id = await createCamera(camera);
    const created = await getCameraById(camera.id);

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error creating camera:', error);
    return NextResponse.json({ error: 'Failed to create camera' }, { status: 500 });
  }
}

// PATCH /api/cameras - Update camera
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Camera ID required' }, { status: 400 });
    }

    const camera = await getCameraById(id);
    if (!camera) {
      return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
    }

    const success = await updateCamera(id, updates);
    if (!success) {
      return NextResponse.json({ error: 'Failed to update camera' }, { status: 500 });
    }

    const updated = await getCameraById(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating camera:', error);
    return NextResponse.json({ error: 'Failed to update camera' }, { status: 500 });
  }
}

// DELETE /api/cameras - Delete camera
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Camera ID required' }, { status: 400 });
    }

    const success = await deleteCamera(id);
    if (!success) {
      return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting camera:', error);
    return NextResponse.json({ error: 'Failed to delete camera' }, { status: 500 });
  }
}
