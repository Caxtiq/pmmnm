# AI Traffic Analysis - Environment Setup

## Required Environment Variables

Add these to your `.env.local` file:

```bash
# Google Gemini AI API Key
# Get your key from: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key_here

# VietMap API Key (already configured)
VIETMAP_API_KEY=your_vietmap_api_key_here
```

## Getting a Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and add it to your `.env.local` file

## Features

### 🤖 AI-Powered Traffic Analysis

The system uses **Google Gemini AI** to:
- Read Vietnamese traffic news articles from RSS feeds
- Extract exactly 2 most important traffic issues
- Identify specific locations (streets, intersections)
- Classify issue types (flood, accident, congestion, construction)
- Rate severity (low, medium, high)

### 🗺️ Road Finding Integration

After AI analysis, the system:
- Uses **VietMap Geocoding API** to find exact coordinates
- Supports both single points and road geometries
- Returns full location names in Vietnamese
- Handles multi-point roads for accurate mapping

### 📊 API Endpoints

#### GET `/api/traffic-analysis`
Automatically fetches latest news and analyzes them:
```json
{
  "success": true,
  "issues": [
    {
      "location": "Đường Nguyễn Huệ",
      "fullLocation": "Đường Nguyễn Huệ, Quận 1, TP.HCM",
      "description": "Ngập nước do mưa lớn",
      "severity": "high",
      "type": "flood",
      "coordinates": [[106.7, 10.77], [106.71, 10.78]]
    }
  ],
  "summary": "Phát hiện 2 vấn đề giao thông...",
  "analyzedAt": 1702234567890,
  "articlesAnalyzed": 10
}
```

#### POST `/api/traffic-analysis`
Analyze custom news articles:
```json
{
  "newsArticles": [
    {
      "title": "Đường Lê Lợi ngập nặng",
      "description": "Mưa lớn gây ngập...",
      "link": "https://..."
    }
  ]
}
```

### 🎨 UI Component

**AITrafficAlerts** component provides:
- One-click analysis button
- Real-time loading indicator
- AI-generated summary
- List of detected issues with:
  - Location name and coordinates
  - Issue type and severity
  - Description
  - Click-to-navigate on map
- Powered by Gemini AI badge

### 🚀 Usage

1. Click **"AI Tin Tức"** button in the top toolbar
2. Click **"Phân Tích Ngay"** to analyze latest news
3. View AI-detected traffic issues
4. Click any issue to fly to its location on the map
5. Issues with coordinates show in green ✓
6. Issues without exact locations show warning ⚠

### 💡 How It Works

```
RSS News Feed (10 articles)
    ↓
Gemini AI Analysis
    ↓
Structured JSON (2 traffic issues)
    ↓
VietMap Geocoding
    ↓
Coordinates + Road Geometry
    ↓
Display on Map
```

### 🔧 Technical Details

**Gemini Prompt Engineering:**
- Temperature: 0.4 (balanced creativity/accuracy)
- Max tokens: 2048
- JSON-only output enforced
- Extracts exactly 2 most important issues
- Vietnamese language optimized

**Road Finding Logic:**
- Searches VietMap with location name
- Handles boundaries for roads
- Falls back to single point for intersections
- Returns null if location not found

### 📝 Example Analysis

**Input:** 10 Vietnamese traffic news articles

**Gemini Output:**
```json
{
  "issues": [
    {
      "location": "Quốc lộ 1A đoạn qua Bình Dương",
      "description": "Tai nạn giao thông nghiêm trọng gây ùn tắc",
      "severity": "high",
      "type": "accident"
    },
    {
      "location": "Đường Trần Hưng Đạo, Hà Nội",
      "description": "Thi công sửa chữa đường, hạn chế lưu thông",
      "severity": "medium",
      "type": "construction"
    }
  ],
  "summary": "Giao thông có nhiều điểm tắc nghẽn..."
}
```

**After Road Finding:**
```json
{
  "issues": [
    {
      ...
      "fullLocation": "Quốc lộ 1A, Bình Dương, Việt Nam",
      "coordinates": [[106.6, 10.9], [106.61, 10.91], ...]
    }
  ]
}
```

### 🎯 Best Practices

1. **API Rate Limits**: Gemini has rate limits, cache results when possible
2. **Error Handling**: System gracefully handles API failures
3. **Data Quality**: More articles = better analysis
4. **Location Accuracy**: Vietnamese street names work best
5. **Refresh Interval**: Don't call too frequently (recommend 5-10 min intervals)

### 🔒 Security Notes

- Never commit API keys to git
- Use environment variables only
- Rate limit API calls in production
- Validate all user inputs
- Cache responses to reduce API costs

### 📞 Support

If issues occur:
1. Check API keys are valid
2. Verify network connectivity
3. Check browser console for errors
4. Review API response in Network tab
5. Ensure RSS feed is accessible
