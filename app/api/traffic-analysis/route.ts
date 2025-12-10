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
import { analyzeNewsAndFindRoads } from '@/lib/geminiNewsAnalyzer';
import { getCachedAnalysis, saveAnalysis, cleanExpiredAnalyses } from '@/lib/db/ai-traffic-analysis';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { newsArticles, forceRefresh } = body;

    if (!newsArticles || !Array.isArray(newsArticles)) {
      return NextResponse.json(
        { error: 'newsArticles array is required' },
        { status: 400 }
      );
    }

    // Check cache first unless force refresh
    if (!forceRefresh) {
      const cached = await getCachedAnalysis();
      if (cached) {
        console.log('Returning cached AI analysis');
        return NextResponse.json({
          success: true,
          cached: true,
          ...cached,
        });
      }
    }

    // Analyze news with Gemini and find road coordinates
    const result = await analyzeNewsAndFindRoads(newsArticles);

    // Save to cache
    await saveAnalysis(result.issues, result.summary, newsArticles.length);
    
    // Clean up expired entries
    await cleanExpiredAnalyses();

    return NextResponse.json({
      success: true,
      cached: false,
      ...result,
    });
  } catch (error: any) {
    console.error('Traffic analysis error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to analyze traffic news',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch latest RSS news and analyze (with caching)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Check cache first unless force refresh requested
    if (!forceRefresh) {
      const cached = await getCachedAnalysis();
      if (cached) {
        console.log('Returning cached AI analysis (TTL: 30 min)');
        return NextResponse.json({
          success: true,
          cached: true,
          ...cached,
        });
      }
    }

    console.log('Cache miss or force refresh - calling Gemini AI');

    // Fetch latest traffic news from RSS
    const rssResponse = await fetch(
      'https://api.rss2json.com/v1/api.json?rss_url=https://vnexpress.net/rss/giao-thong.rss'
    );
    
    if (!rssResponse.ok) {
      throw new Error('Failed to fetch news RSS');
    }

    const rssData = await rssResponse.json();
    
    if (!rssData.items || rssData.items.length === 0) {
      return NextResponse.json({
        success: true,
        cached: false,
        issues: [],
        summary: 'No news articles found',
        analyzedAt: Date.now(),
        articlesAnalyzed: 0,
      });
    }

    // Take top 10 articles for analysis
    const articles = rssData.items.slice(0, 10).map((item: any) => ({
      title: item.title,
      description: item.description || item.content || '',
      link: item.link,
    }));

    // Analyze with Gemini
    const result = await analyzeNewsAndFindRoads(articles);

    // Save to cache (even if empty results)
    await saveAnalysis(result.issues, result.summary, articles.length);
    
    // Clean up expired entries
    await cleanExpiredAnalyses();

    return NextResponse.json({
      success: true,
      cached: false,
      ...result,
      articlesAnalyzed: articles.length,
    });
  } catch (error: any) {
    console.error('Traffic analysis error:', error);
    
    // Try to return cached data as fallback
    const cached = await getCachedAnalysis();
    if (cached) {
      console.log('Returning stale cache due to error');
      return NextResponse.json({
        success: true,
        cached: true,
        stale: true,
        ...cached,
      });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to analyze traffic news',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
