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
  generateCrowdingPredictions, 
  getHourlyPredictions,
  getPredictionForTime 
} from '@/lib/predictionEngine';

// GET /api/predictions - Get crowding predictions based on historical data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'general';
    const daysToAnalyze = parseInt(searchParams.get('days') || '30');
    const predictionHours = parseInt(searchParams.get('hours') || '24');

    // General predictions for all areas
    if (type === 'general') {
      const predictions = await generateCrowdingPredictions(daysToAnalyze, predictionHours);
      return NextResponse.json({ 
        predictions,
        generatedAt: Date.now(),
        daysAnalyzed: daysToAnalyze,
        predictionWindow: predictionHours
      });
    }

    // Hourly pattern for specific location
    if (type === 'hourly') {
      const lat = parseFloat(searchParams.get('lat') || '0');
      const lng = parseFloat(searchParams.get('lng') || '0');
      const radius = parseFloat(searchParams.get('radius') || '1');

      if (!lat || !lng) {
        return NextResponse.json(
          { error: 'Missing lat/lng parameters for hourly predictions' },
          { status: 400 }
        );
      }

      const hourlyData = await getHourlyPredictions([lng, lat], radius, daysToAnalyze);
      return NextResponse.json({ 
        location: [lng, lat],
        hourlyData,
        generatedAt: Date.now(),
        daysAnalyzed: daysToAnalyze
      });
    }

    // Specific time prediction
    if (type === 'specific') {
      const lat = parseFloat(searchParams.get('lat') || '0');
      const lng = parseFloat(searchParams.get('lng') || '0');
      const targetTime = parseInt(searchParams.get('time') || '0');
      const radius = parseFloat(searchParams.get('radius') || '1');

      if (!lat || !lng || !targetTime) {
        return NextResponse.json(
          { error: 'Missing lat/lng/time parameters' },
          { status: 400 }
        );
      }

      const prediction = await getPredictionForTime(
        [lng, lat], 
        new Date(targetTime),
        radius,
        daysToAnalyze
      );

      if (!prediction) {
        return NextResponse.json(
          { error: 'No prediction available for this location/time' },
          { status: 404 }
        );
      }

      return NextResponse.json({ 
        prediction,
        generatedAt: Date.now()
      });
    }

    return NextResponse.json(
      { error: 'Invalid type parameter. Use: general, hourly, or specific' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Prediction API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate predictions' },
      { status: 500 }
    );
  }
}
