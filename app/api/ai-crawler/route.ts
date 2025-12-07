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
import { getNewsAnalyzer } from '@/lib/news-analyzer';
import { getCurrentUser } from '@/lib/auth';

// POST /api/ai-crawler - Manually trigger news crawling (admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const analyzer = getNewsAnalyzer();

    // Fetch and analyze news
    console.log('Fetching news articles...');
    const articles = await analyzer.fetchNews();
    console.log(`Found ${articles.length} articles`);

    if (articles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No articles found',
        articlesFound: 0,
        zonesCreated: 0,
      });
    }

    // Analyze articles
    console.log('Analyzing articles...');
    const analyses = await analyzer.analyzeNews(articles);
    console.log(`Created ${analyses.length} analyses`);

    // Create zones from analyses
    const allZones: any[] = [];
    for (const analysis of analyses) {
      const zones = analyzer.createZonesFromAnalysis(analysis);
      allZones.push(...zones);
    }

    // Save zones to database
    let savedCount = 0;
    for (const zone of allZones) {
      try {
        const saveResponse = await fetch(`${request.nextUrl.origin}/api/zones`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(zone),
        });

        if (saveResponse.ok) {
          savedCount++;
        }
      } catch (error) {
        console.error('Failed to save zone:', error);
      }
    }

    return NextResponse.json({
      success: true,
      articlesFound: articles.length,
      articlesAnalyzed: analyses.length,
      zonesCreated: savedCount,
      zones: allZones,
    });
  } catch (error) {
    console.error('AI Crawler error:', error);
    return NextResponse.json(
      { error: 'Failed to crawl and analyze news' },
      { status: 500 }
    );
  }
}

// GET /api/ai-crawler/status - Get crawler status
export async function GET() {
  try {
    return NextResponse.json({
      enabled: true,
      sources: ['VnExpress RSS'],
      supportedTypes: ['flood', 'traffic', 'outage'],
      lastRun: null, // TODO: Store in DB
    });
  } catch (error) {
    console.error('Failed to get crawler status:', error);
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    );
  }
}
