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

import { getDatabase } from "../mongodb";
import { COLLECTIONS } from "./collections";

export interface Prediction {
  id?: number;
  type: "flood" | "outage";
  location: [number, number];
  probability: number;
  severity?: "low" | "medium" | "high";
  timestamp: number;
  expiresAt?: number;
}

// Insert prediction
export async function insertPrediction(
  prediction: Prediction,
): Promise<number> {
  const db = await getDatabase();
  const collection = db.collection(COLLECTIONS.PREDICTIONS);

  // Get next ID
  const lastDoc = await collection.findOne({}, { sort: { id: -1 } });
  const id = lastDoc?.id ? lastDoc.id + 1 : 1;

  const newPrediction = { ...prediction, id };
  await collection.insertOne(newPrediction as any);
  return id;
}

// Get active predictions
export async function getActivePredictions(): Promise<Prediction[]> {
  const db = await getDatabase();
  const now = Date.now();
  const predictions = await db
    .collection(COLLECTIONS.PREDICTIONS)
    .find({
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
    })
    .sort({ timestamp: -1 })
    .toArray();
  return predictions.map((p) => ({ ...p, _id: undefined }) as any);
}

// Get predictions by type
export async function getPredictionsByType(
  type: "flood" | "outage",
): Promise<Prediction[]> {
  const db = await getDatabase();
  const now = Date.now();
  const predictions = await db
    .collection(COLLECTIONS.PREDICTIONS)
    .find({
      type,
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
    })
    .sort({ timestamp: -1 })
    .toArray();
  return predictions.map((p) => ({ ...p, _id: undefined }) as any);
}

// Delete expired predictions
export async function deleteExpiredPredictions(): Promise<number> {
  const db = await getDatabase();
  const now = Date.now();
  const result = await db.collection(COLLECTIONS.PREDICTIONS).deleteMany({
    expiresAt: { $exists: true, $lt: now },
  });
  return result.deletedCount;
}

// Delete all predictions
export async function deleteAllPredictions(): Promise<void> {
  const db = await getDatabase();
  await db.collection(COLLECTIONS.PREDICTIONS).deleteMany({});
}
