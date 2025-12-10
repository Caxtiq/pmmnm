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
import { COLLECTIONS } from './collections';

export interface AITrafficAnalysis {
  id: string;
  issues: Array<{
    location: string;
    fullLocation?: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    type: 'flood' | 'accident' | 'congestion' | 'construction' | 'other';
    coordinates?: [number, number][];
  }>;
  summary: string;
  analyzedAt: number;
  articlesAnalyzed: number;
  expiresAt: number; // TTL - 30 minutes
}

/**
 * Get the latest cached AI analysis (if still valid)
 */
export async function getCachedAnalysis(): Promise<AITrafficAnalysis | null> {
  const db = await getDatabase();
  const now = Date.now();
  
  const analysis = await db
    .collection(COLLECTIONS.AI_TRAFFIC_ANALYSIS)
    .findOne(
      { expiresAt: { $gt: now } },
      { sort: { analyzedAt: -1 } }
    );

  if (!analysis) return null;

  return {
    id: analysis.id,
    issues: analysis.issues,
    summary: analysis.summary,
    analyzedAt: analysis.analyzedAt,
    articlesAnalyzed: analysis.articlesAnalyzed,
    expiresAt: analysis.expiresAt,
  };
}

/**
 * Save AI analysis to database with 30-minute TTL
 */
export async function saveAnalysis(
  issues: AITrafficAnalysis['issues'],
  summary: string,
  articlesAnalyzed: number
): Promise<string> {
  const db = await getDatabase();
  const now = Date.now();
  const TTL = 30 * 60 * 1000; // 30 minutes

  const analysis: AITrafficAnalysis = {
    id: `analysis_${now}`,
    issues,
    summary,
    analyzedAt: now,
    articlesAnalyzed,
    expiresAt: now + TTL,
  };

  await db.collection(COLLECTIONS.AI_TRAFFIC_ANALYSIS).insertOne(analysis as any);
  
  return analysis.id;
}

/**
 * Clean up expired analyses
 */
export async function cleanExpiredAnalyses(): Promise<number> {
  const db = await getDatabase();
  const now = Date.now();
  
  const result = await db
    .collection(COLLECTIONS.AI_TRAFFIC_ANALYSIS)
    .deleteMany({ expiresAt: { $lt: now } });
  
  return result.deletedCount;
}
