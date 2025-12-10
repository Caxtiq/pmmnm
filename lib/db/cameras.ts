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

import { getDatabase } from '../mongodb';
import { ObjectId } from 'mongodb';

export interface CameraThresholds {
  bicycle: number;
  bus: number;
  car: number;
  container_truck: number;
  fire_engine: number;
  motorcycle: number;
  truck: number;
  van: number;
  total: number;
}

export interface CameraActions {
  createFloodZone: boolean;
  createOutageZone: boolean;
  sendAlert: boolean;
  triggerGraphNode: string[];
}

export interface CameraCounts {
  bicycle: number;
  bus: number;
  car: number;
  container_truck: number;
  fire_engine: number;
  motorcycle: number;
  truck: number;
  van: number;
  total: number;
}

export interface CameraStats {
  lastUpdate: number;
  avgVehiclesPerMinute: number;
  peakTime: string;
  peakCount: number;
}

export interface Camera {
  _id?: ObjectId;
  id: string;
  name: string;
  path: [number, number][]; // Array of [lng, lat] coordinates forming a line
  status: 'active' | 'inactive' | 'error';
  streamUrl?: string; // Optional RTSP/HTTP URL
  threshold: number; // Total vehicle count that triggers crowded status
  thresholds?: CameraThresholds; // Optional detailed thresholds
  actions?: CameraActions; // Optional actions
  currentCounts: CameraCounts;
  stats: CameraStats;
  
  // WebRTC configuration
  webrtc: {
    peerId: string; // AI server peer ID
    signalingState: 'disconnected' | 'connecting' | 'connected';
    lastConnected?: number;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'cameras';

export async function createCamera(camera: Omit<Camera, '_id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const db = await getDatabase();
  const collection = db.collection<Camera>(COLLECTION_NAME);
  
  const now = new Date();
  const result = await collection.insertOne({
    ...camera,
    createdAt: now,
    updatedAt: now,
  });
  
  return result.insertedId.toString();
}

export async function getAllCameras(): Promise<Camera[]> {
  const db = await getDatabase();
  const collection = db.collection<Camera>(COLLECTION_NAME);
  return await collection.find({}).toArray();
}

export async function getActiveCameras(): Promise<Camera[]> {
  const db = await getDatabase();
  const collection = db.collection<Camera>(COLLECTION_NAME);
  return await collection.find({ status: 'active' }).toArray();
}

export async function getCameraById(id: string): Promise<Camera | null> {
  const db = await getDatabase();
  const collection = db.collection<Camera>(COLLECTION_NAME);
  return await collection.findOne({ id });
}

export async function updateCamera(id: string, updates: Partial<Camera>): Promise<boolean> {
  const db = await getDatabase();
  const collection = db.collection<Camera>(COLLECTION_NAME);
  
  const result = await collection.updateOne(
    { id },
    { 
      $set: { 
        ...updates, 
        updatedAt: new Date() 
      } 
    }
  );
  
  return result.modifiedCount > 0;
}

export async function updateCameraCounts(
  id: string, 
  counts: CameraCounts, 
  uniqueCounts: CameraCounts
): Promise<boolean> {
  const db = await getDatabase();
  const collection = db.collection<Camera>(COLLECTION_NAME);
  
  const now = Date.now();
  
  const result = await collection.updateOne(
    { id },
    {
      $set: {
        currentCounts: counts,
        'stats.lastUpdate': now,
        updatedAt: new Date()
      }
    }
  );
  
  // Update peak if current count is higher
  const camera = await collection.findOne({ id });
  if (camera && counts.total > camera.stats.peakCount) {
    await collection.updateOne(
      { id },
      {
        $set: {
          'stats.peakCount': counts.total,
          'stats.peakTime': new Date().toISOString()
        }
      }
    );
  }
  
  return result.modifiedCount > 0;
}

export async function deleteCamera(id: string): Promise<boolean> {
  const db = await getDatabase();
  const collection = db.collection<Camera>(COLLECTION_NAME);
  
  const result = await collection.deleteOne({ id });
  return result.deletedCount > 0;
}

export async function updateCameraStatus(id: string, status: Camera['status']): Promise<boolean> {
  const db = await getDatabase();
  const collection = db.collection<Camera>(COLLECTION_NAME);
  
  const result = await collection.updateOne(
    { id },
    { 
      $set: { 
        status,
        updatedAt: new Date() 
      } 
    }
  );
  
  return result.modifiedCount > 0;
}

export async function updateCameraWebRTC(
  id: string,
  webrtcState: Partial<Camera['webrtc']>
): Promise<boolean> {
  const db = await getDatabase();
  const collection = db.collection<Camera>(COLLECTION_NAME);
  
  const result = await collection.updateOne(
    { id },
    {
      $set: {
        'webrtc.signalingState': webrtcState.signalingState,
        'webrtc.lastConnected': webrtcState.lastConnected || Date.now(),
        updatedAt: new Date()
      }
    }
  );
  
  return result.modifiedCount > 0;
}

// Camera detection history for analytics
export interface CameraDetectionLog {
  _id?: ObjectId;
  cameraId: string;
  timestamp: Date;
  counts: CameraCounts;
  uniqueCounts: CameraCounts;
  congestionLevel: 'low' | 'medium' | 'high';
}

const DETECTION_LOG_COLLECTION = 'camera_detection_logs';

export async function logDetection(log: Omit<CameraDetectionLog, '_id'>): Promise<string> {
  const db = await getDatabase();
  const collection = db.collection<CameraDetectionLog>(DETECTION_LOG_COLLECTION);
  
  const result = await collection.insertOne(log);
  return result.insertedId.toString();
}

export async function getDetectionHistory(
  cameraId: string,
  startTime: Date,
  endTime: Date
): Promise<CameraDetectionLog[]> {
  const db = await getDatabase();
  const collection = db.collection<CameraDetectionLog>(DETECTION_LOG_COLLECTION);
  
  return await collection
    .find({
      cameraId,
      timestamp: { $gte: startTime, $lte: endTime }
    })
    .sort({ timestamp: 1 })
    .toArray();
}

// Clean up old detection logs (older than 30 days)
export async function cleanOldDetectionLogs(): Promise<number> {
  const db = await getDatabase();
  const collection = db.collection<CameraDetectionLog>(DETECTION_LOG_COLLECTION);
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const result = await collection.deleteMany({
    timestamp: { $lt: thirtyDaysAgo }
  });
  
  return result.deletedCount;
}
