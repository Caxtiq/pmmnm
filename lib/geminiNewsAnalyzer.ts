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

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface TrafficIssue {
  location: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  type: 'flood' | 'accident' | 'congestion' | 'construction' | 'other';
  timestamp?: string;
}

export interface GeminiAnalysisResult {
  issues: TrafficIssue[];
  summary: string;
  analyzedAt: number;
}

/**
 * Analyze news articles using Gemini AI to extract traffic issues
 */
export async function analyzeNewsWithGemini(
  newsArticles: Array<{ title: string; description: string; link: string }>
): Promise<GeminiAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  // Initialize Gemini AI
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.4,
      topK: 32,
      topP: 1,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json', // Force JSON response
    }
  });

  // Prepare news content for analysis
  const newsContent = newsArticles
    .map((article, idx) => {
      return `Article ${idx + 1}:
Title: ${article.title}
Description: ${article.description}
---`;
    })
    .join('\n\n');

  const prompt = `You are a traffic analysis AI for Hanoi, Vietnam. Analyze Vietnamese news articles and extract UP TO 2 MOST CRITICAL CURRENT traffic issues.

CRITICAL LOCATION REQUIREMENTS:
- Use EXACT street names as written in the article (e.g., "Phạm Hùng", "Nguyễn Trãi", "Giải Phóng")
- For intersections, use format: "Ngã tư Đường A - Đường B" or "Giao lộ Đường A - Đường B"
- For specific areas: "Khu vực [tên đường/khu vực]"
- Include district if mentioned: "Đường [tên], quận [số/tên]"
- Use Vietnamese diacritics correctly (ă, â, đ, ê, ô, ơ, ư)
- Examples of GOOD locations:
  * "Đường Phạm Hùng"
  * "Ngã tư Nguyễn Trãi - Khuất Duy Tiến"
  * "Cầu Nhật Tân"
  * "Đường Giải Phóng, quận Hoàng Mai"

ONLY extract issues with:
- Actual traffic disruptions (accidents, flooding, road closures)
- CURRENT/ONGOING problems (not future plans or past events)

Ignore:
- General traffic reports without specific issues
- Safety tips, announcements
- Future construction plans
- Historical incidents

Return JSON:
{
  "issues": [
    {
      "location": "EXACT street/intersection name from article with proper Vietnamese diacritics",
      "description": "brief current issue description",
      "severity": "low|medium|high",
      "type": "flood|accident|congestion|construction|other"
    }
  ],
  "summary": "brief summary"
}

If NO issues found:
{
  "issues": [],
  "summary": "No significant traffic issues detected in current news"
}

NEWS ARTICLES:
${newsContent}

Return ONLY the JSON object, no other text or explanation.`;

  try {
    // Generate content with JSON schema enforcement
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    // Parse the JSON response (already guaranteed to be valid JSON by responseMimeType)
    const parsedResult = JSON.parse(text);

    return {
      issues: parsedResult.issues || [],
      summary: parsedResult.summary || 'No summary available',
      analyzedAt: Date.now(),
    };
  } catch (error) {
    console.error('Error analyzing news with Gemini:', error);
    throw error;
  }
}

/**
 * Find road coordinates using VietMap API
 */
export async function findRoadCoordinates(
  locationName: string
): Promise<{ coordinates: [number, number][]; fullName: string } | null> {
  const apiKey = process.env.NEXT_PUBLIC_VIETMAP_API_KEY;
  
  if (!apiKey) {
    console.error('NEXT_PUBLIC_VIETMAP_API_KEY not configured');
    return null;
  }

  try {
    // Use VietMap search API
    const searchQuery = encodeURIComponent(locationName + ', Hà Nội, Vietnam');
    const response = await fetch(
      `https://maps.vietmap.vn/api/search/v3?apikey=${apiKey}&text=${searchQuery}`
    );

    if (!response.ok) {
      console.error('VietMap API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    
    console.log('VietMap search result for', locationName, ':', data);
    
    if (!data || data.length === 0) {
      console.log(`No results found for: ${locationName}`);
      return null;
    }

    // Get the first (best) result
    const result = data[0];
    
    // VietMap Search v3 API returns: { lat, lng, display, boundaries?, ... }
    if (result.boundaries && Array.isArray(result.boundaries) && result.boundaries.length > 0) {
      // Has boundary coordinates (for roads/areas)
      const coordinates: [number, number][] = result.boundaries.map((coord: any) => {
        // Boundaries could be [lng, lat] or {lng, lat}
        if (Array.isArray(coord)) {
          return [Number(coord[0]), Number(coord[1])];
        } else {
          return [Number(coord.lng), Number(coord.lat)];
        }
      }).filter((coord: [number, number]) => 
        !isNaN(coord[0]) && !isNaN(coord[1]) && 
        coord[0] >= -180 && coord[0] <= 180 && 
        coord[1] >= -85 && coord[1] <= 85
      );
      
      if (coordinates.length > 0) {
        return {
          coordinates,
          fullName: result.display || result.name || locationName,
        };
      }
    }
    
    // Fallback to single point if lat/lng available
    if (result.lat && result.lng) {
      const lng = Number(result.lng);
      const lat = Number(result.lat);
      
      if (!isNaN(lng) && !isNaN(lat) && lng >= -180 && lng <= 180 && lat >= -85 && lat <= 85) {
        return {
          coordinates: [[lng, lat]],
          fullName: result.display || result.name || locationName,
        };
      }
    }

    console.log(`Invalid coordinates for: ${locationName}`);
    return null;
  } catch (error) {
    console.error('Error finding road coordinates:', error);
    return null;
  }
}

/**
 * Analyze news and find road coordinates for detected issues
 */
export async function analyzeNewsAndFindRoads(
  newsArticles: Array<{ title: string; description: string; link: string }>
): Promise<{
  issues: Array<TrafficIssue & { coordinates?: [number, number][]; fullLocation?: string }>;
  summary: string;
  analyzedAt: number;
}> {
  // First, analyze with Gemini
  const analysis = await analyzeNewsWithGemini(newsArticles);

  // Then find coordinates for each issue
  const issuesWithCoordinates = await Promise.all(
    analysis.issues.map(async (issue) => {
      const roadInfo = await findRoadCoordinates(issue.location);
      
      return {
        ...issue,
        coordinates: roadInfo?.coordinates,
        fullLocation: roadInfo?.fullName || issue.location,
      };
    })
  );

  return {
    issues: issuesWithCoordinates,
    summary: analysis.summary,
    analyzedAt: analysis.analyzedAt,
  };
}
