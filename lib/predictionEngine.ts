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

import { getDatabase } from './mongodb';
import { COLLECTIONS } from './db/collections';
import { calculateDistance } from './geoUtils';

export interface CrowdingPrediction {
  location: [number, number];
  areaName: string;
  crowdingLevel: number; // 0-100
  confidence: number; // 0-100
  trend: 'increasing' | 'decreasing' | 'stable';
  predictedFor: number; // timestamp
  basedOnDays: number;
  factors: {
    historicalReports: number;
    timeOfDay: number;
    dayOfWeek: number;
    weatherImpact: number;
    activeZones: number;
  };
}

export interface TimePattern {
  hour: number;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  count: number;
  avgSeverity: number;
}

/**
 * Analyze historical data to predict crowding/congestion patterns
 */
export async function generateCrowdingPredictions(
  daysToAnalyze: number = 30,
  predictionHours: number = 24
): Promise<CrowdingPrediction[]> {
  const db = await getDatabase();
  const now = Date.now();
  const startTime = now - daysToAnalyze * 24 * 60 * 60 * 1000;

  // Fetch historical data
  const [reports, zones] = await Promise.all([
    db.collection(COLLECTIONS.USER_REPORTS)
      .find({ createdAt: { $gte: startTime } })
      .toArray(),
    db.collection(COLLECTIONS.ZONES)
      .find({})
      .toArray(),
  ]);

  // Group reports by location clusters
  const locationClusters = clusterReportsByLocation(reports as any[], 0.5); // 500m radius

  const predictions: CrowdingPrediction[] = [];

  for (const cluster of locationClusters) {
    const prediction = await analyzeCrowdingPattern(
      cluster,
      zones as any[],
      daysToAnalyze,
      predictionHours
    );
    if (prediction.crowdingLevel > 20) { // Only include significant predictions
      predictions.push(prediction);
    }
  }

  return predictions.sort((a, b) => b.crowdingLevel - a.crowdingLevel);
}

/**
 * Cluster reports by geographic proximity
 */
function clusterReportsByLocation(
  reports: any[],
  radiusKm: number
): Array<{ center: [number, number]; reports: any[]; name: string }> {
  const clusters: Array<{ center: [number, number]; reports: any[]; name: string }> = [];
  const processed = new Set<string>();

  for (const report of reports) {
    if (processed.has(report.id)) continue;

    const cluster = {
      center: report.location as [number, number],
      reports: [report],
      name: report.description?.substring(0, 30) || 'Unknown Area',
    };

    // Find nearby reports
    for (const other of reports) {
      if (other.id === report.id || processed.has(other.id)) continue;

      const distance = calculateDistance(
        report.location[1],
        report.location[0],
        other.location[1],
        other.location[0]
      );

      if (distance <= radiusKm) {
        cluster.reports.push(other);
        processed.add(other.id);
      }
    }

    // Update cluster center to centroid
    const avgLng = cluster.reports.reduce((sum, r) => sum + r.location[0], 0) / cluster.reports.length;
    const avgLat = cluster.reports.reduce((sum, r) => sum + r.location[1], 0) / cluster.reports.length;
    cluster.center = [avgLng, avgLat];

    processed.add(report.id);
    clusters.push(cluster);
  }

  return clusters;
}

/**
 * Analyze crowding pattern for a location cluster
 */
async function analyzeCrowdingPattern(
  cluster: { center: [number, number]; reports: any[]; name: string },
  zones: any[],
  daysAnalyzed: number,
  predictionHours: number
): Promise<CrowdingPrediction> {
  const now = Date.now();
  const reports = cluster.reports;

  // Calculate time patterns
  const hourPatterns = new Map<number, { count: number; totalSeverity: number }>();
  const dayPatterns = new Map<number, { count: number; totalSeverity: number }>();

  for (const report of reports) {
    const date = new Date(report.createdAt);
    const hour = date.getHours();
    const day = date.getDay();

    const severityScore = report.severity === 'high' ? 3 : report.severity === 'medium' ? 2 : 1;

    // Hour pattern
    if (!hourPatterns.has(hour)) {
      hourPatterns.set(hour, { count: 0, totalSeverity: 0 });
    }
    const hourData = hourPatterns.get(hour)!;
    hourData.count++;
    hourData.totalSeverity += severityScore;

    // Day pattern
    if (!dayPatterns.has(day)) {
      dayPatterns.set(day, { count: 0, totalSeverity: 0 });
    }
    const dayData = dayPatterns.get(day)!;
    dayData.count++;
    dayData.totalSeverity += severityScore;
  }

  // Calculate predicted crowding level
  const currentDate = new Date(now + predictionHours * 60 * 60 * 1000);
  const predictedHour = currentDate.getHours();
  const predictedDay = currentDate.getDay();

  const hourData = hourPatterns.get(predictedHour) || { count: 0, totalSeverity: 0 };
  const dayData = dayPatterns.get(predictedDay) || { count: 0, totalSeverity: 0 };

  // Calculate factors
  const historicalReports = reports.length;
  const avgReportsPerDay = historicalReports / daysAnalyzed;
  
  // Time of day factor (normalized)
  const timeOfDayFactor = hourData.count > 0 ? (hourData.count / avgReportsPerDay) * 100 : 0;
  
  // Day of week factor
  const dayOfWeekFactor = dayData.count > 0 ? (dayData.count / (historicalReports / 7)) * 100 : 0;

  // Weather impact (simplified - high severity indicates weather-related issues)
  const highSeverityCount = reports.filter(r => r.severity === 'high').length;
  const weatherImpact = (highSeverityCount / historicalReports) * 100;

  // Active zones nearby
  const nearbyZones = zones.filter(zone => {
    if (!zone.center) return false;
    const distance = calculateDistance(
      cluster.center[1],
      cluster.center[0],
      zone.center[1],
      zone.center[0]
    );
    return distance <= 1; // Within 1km
  });
  const activeZonesImpact = Math.min(nearbyZones.length * 20, 100);

  // Calculate overall crowding level (weighted average)
  const crowdingLevel = Math.min(
    Math.round(
      (timeOfDayFactor * 0.25 +
        dayOfWeekFactor * 0.20 +
        weatherImpact * 0.15 +
        activeZonesImpact * 0.25 +
        Math.min(avgReportsPerDay * 10, 100) * 0.15)
    ),
    100
  );

  // Calculate trend
  const recentReports = reports.filter(r => r.createdAt > now - 7 * 24 * 60 * 60 * 1000);
  const olderReports = reports.filter(r => r.createdAt <= now - 7 * 24 * 60 * 60 * 1000);
  
  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (recentReports.length > olderReports.length * 1.2) {
    trend = 'increasing';
  } else if (recentReports.length < olderReports.length * 0.8) {
    trend = 'decreasing';
  }

  // Confidence based on data amount
  const confidence = Math.min(Math.round((historicalReports / daysAnalyzed) * 10), 100);

  return {
    location: cluster.center,
    areaName: cluster.name,
    crowdingLevel,
    confidence,
    trend,
    predictedFor: now + predictionHours * 60 * 60 * 1000,
    basedOnDays: daysAnalyzed,
    factors: {
      historicalReports: Math.round(avgReportsPerDay * 10) / 10,
      timeOfDay: Math.round(timeOfDayFactor),
      dayOfWeek: Math.round(dayOfWeekFactor),
      weatherImpact: Math.round(weatherImpact),
      activeZones: nearbyZones.length,
    },
  };
}

/**
 * Get hourly prediction pattern for a specific location
 */
export async function getHourlyPredictions(
  location: [number, number],
  radiusKm: number = 1,
  daysToAnalyze: number = 30
): Promise<Array<{ hour: number; crowdingLevel: number; confidence: number }>> {
  const db = await getDatabase();
  const now = Date.now();
  const startTime = now - daysToAnalyze * 24 * 60 * 60 * 1000;

  // Fetch reports near location
  const reports = await db
    .collection(COLLECTIONS.USER_REPORTS)
    .find({ createdAt: { $gte: startTime } })
    .toArray();

  const nearbyReports = reports.filter((report: any) => {
    const distance = calculateDistance(
      location[1],
      location[0],
      report.location[1],
      report.location[0]
    );
    return distance <= radiusKm;
  });

  // Group by hour
  const hourlyData = new Array(24).fill(0).map((_, hour) => {
    const hourReports = nearbyReports.filter((r: any) => {
      return new Date(r.createdAt).getHours() === hour;
    });

    const avgSeverity = hourReports.length > 0
      ? hourReports.reduce((sum: number, r: any) => {
          const score = r.severity === 'high' ? 3 : r.severity === 'medium' ? 2 : 1;
          return sum + score;
        }, 0) / hourReports.length
      : 0;

    const crowdingLevel = Math.min(Math.round(avgSeverity * 33.33), 100);
    const confidence = Math.min(Math.round((hourReports.length / (daysToAnalyze / 24)) * 100), 100);

    return { hour, crowdingLevel, confidence };
  });

  return hourlyData;
}

/**
 * Get prediction for specific time and location
 */
export async function getPredictionForTime(
  location: [number, number],
  targetTime: Date,
  radiusKm: number = 1,
  daysToAnalyze: number = 30
): Promise<CrowdingPrediction | null> {
  const predictions = await generateCrowdingPredictions(daysToAnalyze, 
    Math.round((targetTime.getTime() - Date.now()) / (1000 * 60 * 60)));

  // Find closest prediction to target location
  let closest: CrowdingPrediction | null = null;
  let minDistance = Infinity;

  for (const pred of predictions) {
    const distance = calculateDistance(
      location[1],
      location[0],
      pred.location[1],
      pred.location[0]
    );
    if (distance <= radiusKm && distance < minDistance) {
      minDistance = distance;
      closest = pred;
    }
  }

  return closest;
}
