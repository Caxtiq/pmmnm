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

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: string;
  content?: string;
}

interface ExtractedLocation {
  address: string;
  coordinates?: [number, number];
  confidence: number;
}

interface NewsAnalysis {
  type: 'flood' | 'traffic' | 'outage';
  severity: 'low' | 'medium' | 'high';
  locations: ExtractedLocation[];
  summary: string;
  article: NewsArticle;
}

// Vietnamese location patterns
const LOCATION_PATTERNS = [
  /(?:đường|phố|tại|khu vực|vùng|ở)\s+([A-ZĐÂĂÊÔƠƯ][a-zđâăêôơư\s]+(?:[,]\s*(?:quận|huyện|phường|xã)\s+[A-ZĐÂĂÊÔƠƯ0-9][a-zđâăêôơư\s0-9]*)*)/gi,
  /(?:quận|huyện)\s+([A-ZĐÂĂÊÔƠƯ0-9][a-zđâăêôơư\s0-9]*)/gi,
  /(?:thành phố|tỉnh)\s+([A-ZĐÂĂÊÔƠƯ][a-zđâăêôơư\s]+)/gi,
];

const FLOOD_KEYWORDS = [
  'ngập', 'lụt', 'úng', 'nước dâng', 'triều cường', 
  'mưa lớn', 'thiên tai', 'bão', 'lũ quét'
];

const TRAFFIC_KEYWORDS = [
  'kẹt xe', 'tắc đường', 'ùn tắc', 'đông đúc', 
  'giao thông', 'tắc nghẽn', 'xe cộ đông'
];

const OUTAGE_KEYWORDS = [
  'mất điện', 'cúp điện', 'sự cố điện', 'chập điện', 'điện lực'
];

export class NewsAnalyzer {
  private vietmapApiKey: string;

  constructor(apiKey: string) {
    this.vietmapApiKey = apiKey;
  }

  // Fetch news from multiple sources
  async fetchNews(): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];

    try {
      // VnExpress RSS (example - you can add more sources)
      const rssUrls = [
        'https://vnexpress.net/rss/thoi-su.rss',
        'https://vnexpress.net/rss/giao-thong.rss',
      ];

      for (const rssUrl of rssUrls) {
        try {
          const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`);
          const data = await response.json();

          if (data.items) {
            articles.push(...data.items.map((item: any) => ({
              title: item.title,
              description: item.description,
              url: item.link,
              publishedAt: item.pubDate,
              source: 'VnExpress',
              content: item.content,
            })));
          }
        } catch (error) {
          console.error(`Failed to fetch from ${rssUrl}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to fetch news:', error);
    }

    return articles;
  }

  // Analyze article content to determine type and severity
  analyzeArticle(article: NewsArticle): { type: 'flood' | 'traffic' | 'outage' | null; severity: 'low' | 'medium' | 'high' } {
    const text = `${article.title} ${article.description} ${article.content || ''}`.toLowerCase();

    // Determine type
    let type: 'flood' | 'traffic' | 'outage' | null = null;
    let maxScore = 0;

    const floodScore = FLOOD_KEYWORDS.filter(kw => text.includes(kw)).length;
    const trafficScore = TRAFFIC_KEYWORDS.filter(kw => text.includes(kw)).length;
    const outageScore = OUTAGE_KEYWORDS.filter(kw => text.includes(kw)).length;

    if (floodScore > maxScore) {
      maxScore = floodScore;
      type = 'flood';
    }
    if (trafficScore > maxScore) {
      maxScore = trafficScore;
      type = 'traffic';
    }
    if (outageScore > maxScore) {
      maxScore = outageScore;
      type = 'outage';
    }

    if (!type || maxScore === 0) {
      return { type: null, severity: 'low' };
    }

    // Determine severity based on keywords
    let severity: 'low' | 'medium' | 'high' = 'low';
    
    const severityKeywords = {
      high: ['nghiêm trọng', 'nguy hiểm', 'khẩn cấp', 'sơ tán', 'đe dọa', 'chết người', 'thiệt hại lớn'],
      medium: ['ảnh hưởng', 'khó khăn', 'gián đoạn', 'chậm trễ', 'tăng cao'],
    };

    if (severityKeywords.high.some(kw => text.includes(kw))) {
      severity = 'high';
    } else if (severityKeywords.medium.some(kw => text.includes(kw))) {
      severity = 'medium';
    }

    return { type, severity };
  }

  // Extract locations from article text
  extractLocations(text: string): string[] {
    const locations = new Set<string>();

    for (const pattern of LOCATION_PATTERNS) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          locations.add(match[1].trim());
        }
      }
    }

    return Array.from(locations);
  }

  // Geocode location using VietMap API
  async geocodeLocation(address: string): Promise<[number, number] | null> {
    try {
      const response = await fetch(
        `https://maps.vietmap.vn/api/autocomplete/v4?apikey=${this.vietmapApiKey}&text=${encodeURIComponent(address)}&display_type=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const result = data[0];
        
        // Get detailed location
        const placeResponse = await fetch(
          `https://maps.vietmap.vn/api/place/v4?apikey=${this.vietmapApiKey}&refid=${encodeURIComponent(result.ref_id)}`
        );
        const placeData = await placeResponse.json();

        if (placeData && placeData.lat && placeData.lng) {
          return [placeData.lng, placeData.lat];
        }
      }
    } catch (error) {
      console.error(`Failed to geocode ${address}:`, error);
    }

    return null;
  }

  // Process and analyze news articles
  async analyzeNews(articles: NewsArticle[]): Promise<NewsAnalysis[]> {
    const analyses: NewsAnalysis[] = [];

    for (const article of articles) {
      const { type, severity } = this.analyzeArticle(article);

      if (!type) continue;

      // Extract locations from article
      const text = `${article.title} ${article.description} ${article.content || ''}`;
      const locationNames = this.extractLocations(text);

      if (locationNames.length === 0) continue;

      // Geocode locations
      const locations: ExtractedLocation[] = [];
      
      for (const locationName of locationNames) {
        const coordinates = await this.geocodeLocation(locationName);
        locations.push({
          address: locationName,
          coordinates: coordinates || undefined,
          confidence: coordinates ? 0.8 : 0.3,
        });

        // Rate limit to avoid API throttling
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (locations.some(loc => loc.coordinates)) {
        analyses.push({
          type,
          severity,
          locations: locations.filter(loc => loc.coordinates),
          summary: article.title,
          article,
        });
      }
    }

    return analyses;
  }

  // Create zones from news analysis
  createZonesFromAnalysis(analysis: NewsAnalysis) {
    return analysis.locations
      .filter(loc => loc.coordinates && loc.confidence > 0.5)
      .map(loc => ({
        id: `news-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: analysis.type === 'traffic' ? 'outage' as const : analysis.type as 'flood' | 'outage',
        shape: 'circle' as const,
        center: loc.coordinates!,
        radius: analysis.severity === 'high' ? 1000 : analysis.severity === 'medium' ? 500 : 250,
        title: analysis.summary,
        description: `Nguồn: ${analysis.article.source} - ${loc.address}`,
        riskLevel: analysis.severity === 'high' ? 80 : analysis.severity === 'medium' ? 50 : 30,
        source: 'ai-crawler',
        sourceUrl: analysis.article.url,
        createdAt: Date.now(),
      }));
  }
}

// Singleton instance
let analyzerInstance: NewsAnalyzer | null = null;

export function getNewsAnalyzer(): NewsAnalyzer {
  if (!analyzerInstance) {
    const apiKey = process.env.NEXT_PUBLIC_VIETMAP_API_KEY || '';
    analyzerInstance = new NewsAnalyzer(apiKey);
  }
  return analyzerInstance;
}
