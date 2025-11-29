import { getDatabase } from '../mongodb';
import { COLLECTIONS } from './collections';

export interface Zone {
    id: string;
    type: 'flood' | 'outage';
    shape: 'circle' | 'line';
    center?: [number, number];
    radius?: number;
    coordinates?: number[][];
    riskLevel?: number;
    createdAt?: number;
    updatedAt?: number;
}

// Get all zones
export async function getAllZones(): Promise<Zone[]> {
    const db = await getDatabase();
    const zones = await db.collection(COLLECTIONS.ZONES)
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
    return zones.map(z => ({ ...z, _id: undefined } as any));
}

// Get zones by type
export async function getZonesByType(type: 'flood' | 'outage'): Promise<Zone[]> {
    const db = await getDatabase();
    const zones = await db.collection(COLLECTIONS.ZONES)
        .find({ type })
        .sort({ createdAt: -1 })
        .toArray();
    return zones.map(z => ({ ...z, _id: undefined } as any));
}

// Create a new zone
export async function createZone(zone: Zone): Promise<Zone> {
    const db = await getDatabase();
    const now = Date.now();
    const newZone = { ...zone, createdAt: now, updatedAt: now, riskLevel: zone.riskLevel || 50 };
    await db.collection(COLLECTIONS.ZONES).insertOne(newZone as any);
    return newZone;
}

// Update a zone
export async function updateZone(id: string, updates: Partial<Zone>): Promise<void> {
    const db = await getDatabase();
    await db.collection(COLLECTIONS.ZONES).updateOne(
        { id },
        { $set: { ...updates, updatedAt: Date.now() } }
    );
}

// Delete a zone
export async function deleteZone(id: string): Promise<void> {
    const db = await getDatabase();
    await db.collection(COLLECTIONS.ZONES).deleteOne({ id });
}

// Delete all zones
export async function deleteAllZones(): Promise<void> {
    const db = await getDatabase();
    await db.collection(COLLECTIONS.ZONES).deleteMany({});
}

// Delete zones by type
export async function deleteZonesByType(type: 'flood' | 'outage'): Promise<void> {
    const db = await getDatabase();
    await db.collection(COLLECTIONS.ZONES).deleteMany({ type });
}
