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

'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faNewspaper, 
  faThumbsUp, 
  faThumbsDown,
  faFilter,
  faSortAmountDown,
  faMapMarkerAlt,
  faImage,
  faTimes,
  faRss,
  faUsers
} from '@fortawesome/free-solid-svg-icons';
import vietmapgl from '@vietmap/vietmap-gl-js/dist/vietmap-gl.js';
import ShareButton from '../ShareButton';
import { useToast } from '../ToastProvider';

interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  thumbnail?: string;
}

interface UserReport {
  id: string;
  type: 'flood' | 'outage' | 'other';
  location: [number, number];
  coordinates?: number[][];
  description: string;
  severity: 'low' | 'medium' | 'high';
  reporterName?: string;
  status: 'new' | 'investigating' | 'resolved';
  createdAt: number;
  images?: string[];
  upvotes?: string[];
  downvotes?: string[];
  voteScore?: number;
  zoneCreated?: boolean;
  adminApproved?: boolean;
}

interface CommunityFeedProps {
  userId?: string;
  map?: any;
  onReportClick?: (report: UserReport) => void;
}

export default function CommunityFeed({ userId, map, onReportClick }: CommunityFeedProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'community' | 'news'>('community');
  const [reports, setReports] = useState<UserReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<UserReport[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'flood' | 'outage' | 'other'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [currentPopup, setCurrentPopup] = useState<any>(null);
  const [newsItems, setNewsItems] = useState<RSSItem[]>([]);
  const [loadingNews, setLoadingNews] = useState(false);

  useEffect(() => {
    // Fetch current user
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setCurrentUserId(data.user.id);
        }
      })
      .catch(err => console.error('Failed to get user:', err));

    fetchReports();
    fetchNews();
    const interval = setInterval(fetchReports, 30000); // Refresh every 30s
    const newsInterval = setInterval(fetchNews, 300000); // Refresh news every 5 minutes
    return () => {
      clearInterval(interval);
      clearInterval(newsInterval);
    };
  }, []);

  useEffect(() => {
    let filtered = reports;

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(r => r.type === filterType);
    }

    // Sort
    if (sortBy === 'popular') {
      filtered = [...filtered].sort((a, b) => (b.voteScore || 0) - (a.voteScore || 0));
    } else {
      filtered = [...filtered].sort((a, b) => b.createdAt - a.createdAt);
    }

    setFilteredReports(filtered);
  }, [reports, filterType, sortBy]);

  const fetchReports = async () => {
    try {
      const response = await fetch('/api/user-reports');
      const data = await response.json();
      if (data.reports) {
        setReports(data.reports);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    }
  };

  const fetchNews = async () => {
    setLoadingNews(true);
    try {
      const response = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https://vnexpress.net/rss/giao-thong.rss');
      const data = await response.json();
      if (data.items) {
        setNewsItems(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch news:', error);
    } finally {
      setLoadingNews(false);
    }
  };

  const handleVote = async (reportId: string, voteType: 'up' | 'down') => {
    if (!currentUserId) {
      showToast('Vui lòng đăng nhập để bình chọn', 'info');
      return;
    }

    try {
      const response = await fetch('/api/user-reports/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, voteType }),
      });

      if (response.ok) {
        const data = await response.json();
        setReports(prev => prev.map(r => 
          r.id === reportId 
            ? { ...r, voteScore: data.voteScore, zoneCreated: data.zoneCreated }
            : r
        ));

        // Show notification if zone was auto-created
        if (data.zoneCreated) {
          const notification = document.createElement('div');
          notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-2xl z-[9999] animate-fadeIn';
          notification.innerHTML = `
            <div class="flex items-center gap-3">
              <span class="text-2xl">🔥</span>
              <div>
                <div class="font-bold">Đã tạo vùng tự động!</div>
                <div class="text-sm">Báo cáo này đã tạo khu vực nguy hiểm mới</div>
              </div>
            </div>
          `;
          document.body.appendChild(notification);
          setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.5s';
            setTimeout(() => notification.remove(), 500);
          }, 4000);
        }
      }
    } catch (error) {
      console.error('Vote error:', error);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'flood': return 'text-blue-600 bg-blue-50';
      case 'outage': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'flood': return 'Ngập lụt';
      case 'outage': return 'Mất điện';
      default: return 'Khác';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-green-100 text-green-700';
    }
  };

  const handleReportSelect = (report: UserReport) => {
    if (!map) return;

    // Close existing popup if any
    if (currentPopup) {
      currentPopup.remove();
      setCurrentPopup(null);
    }

    // Toggle selection
    if (selectedReportId === report.id) {
      setSelectedReportId(null);
      // Remove highlight layer
      if (map.getLayer('selected-report-highlight')) {
        map.removeLayer('selected-report-highlight');
      }
      if (map.getSource('selected-report-highlight')) {
        map.removeSource('selected-report-highlight');
      }
      return;
    }

    setSelectedReportId(report.id);

    // Remove old highlight
    if (map.getLayer('selected-report-highlight')) {
      map.removeLayer('selected-report-highlight');
    }
    if (map.getSource('selected-report-highlight')) {
      map.removeSource('selected-report-highlight');
    }

    // If report has coordinates (line), show the line
    if (report.coordinates && report.coordinates.length > 1) {
      map.addSource('selected-report-highlight', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: report.coordinates
          }
        }
      });

      map.addLayer({
        id: 'selected-report-highlight',
        type: 'line',
        source: 'selected-report-highlight',
        paint: {
          'line-color': report.type === 'flood' ? '#06b6d4' : report.type === 'outage' ? '#f97316' : '#8b5cf6',
          'line-width': 8,
          'line-opacity': 0.9
        }
      });

      // Fit map to line bounds with more padding
      const coords = report.coordinates;
      const bounds: [[number, number], [number, number]] = [
        [
          Math.min(...coords.map(c => c[0])),
          Math.min(...coords.map(c => c[1]))
        ],
        [
          Math.max(...coords.map(c => c[0])),
          Math.max(...coords.map(c => c[1]))
        ]
      ];
      
      map.fitBounds(bounds, { 
        padding: { top: 150, bottom: 150, left: 450, right: 150 },
        maxZoom: 14,
        duration: 2000,
        easing: (t: number) => {
          // Smooth ease-in-out curve
          return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        },
        essential: true
      });

      // Add popup at the center of the line
      const centerLng = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
      const centerLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;

      const popup = new vietmapgl.Popup({ 
        closeButton: true,
        closeOnClick: false,
        offset: 25
      })
        .on('close', () => {
          setCurrentPopup(null);
        })
        .setLngLat([centerLng, centerLat])
        .setHTML(`
            <div class="p-3 min-w-[250px]">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-2xl">
                  ${report.type === 'flood' ? '🌊' : report.type === 'outage' ? '⚡' : '⚠️'}
                </span>
                <div class="flex-1">
                  <div class="font-bold text-gray-800">
                    🗺️ Tuyến Đường (${coords.length} điểm)
                  </div>
                  <div class="text-xs text-gray-500">
                    ${new Date(report.createdAt).toLocaleString('vi-VN')}
                  </div>
                </div>
              </div>
              <div class="mb-2">
                <span class="inline-block px-2 py-1 rounded-full text-xs font-bold ${
                  report.severity === 'high' 
                    ? 'bg-red-100 text-red-700' 
                    : report.severity === 'medium' 
                    ? 'bg-orange-100 text-orange-700' 
                    : 'bg-yellow-100 text-yellow-700'
                }">
                  ${report.severity === 'high' ? '🔴 Nghiêm Trọng' : report.severity === 'medium' ? '🟠 Trung Bình' : '🟡 Nhẹ'}
                </span>
              </div>
              <p class="text-sm text-gray-700 mb-2">${report.description}</p>
              <div class="text-xs text-gray-500 border-t pt-2">
                📍 ${report.reporterName || 'Ẩn danh'}
              </div>
            </div>
          `)
          .addTo(map);
      
      setCurrentPopup(popup);
    } else {
      // Just fly to the point with smooth animation
      map.flyTo({ 
        center: report.location, 
        zoom: 14,
        duration: 2000,
        easing: (t: number) => {
          // Smooth ease-in-out curve
          return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        },
        essential: true,
        curve: 1.42,
        speed: 1.2
      });
    }

    onReportClick?.(report);
  };

  return (
    <>
      <div className="fixed top-20 left-4 bottom-4 z-30 bg-white rounded-2xl shadow-2xl w-96 flex flex-col">
        {/* Header with Tabs */}
        <div className="bg-gray-100 rounded-t-2xl">
          <div className="flex border-b border-gray-300">
            <button
              onClick={() => setActiveTab('community')}
              className={`flex-1 px-4 py-3 font-semibold transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'community'
                  ? 'bg-white text-gray-800 border-b-2 border-blue-500'
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              <FontAwesomeIcon icon={faUsers} />
              Cộng Đồng
              <span className="bg-gray-200 px-2 py-0.5 rounded-full text-xs font-bold">
                {filteredReports.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('news')}
              className={`flex-1 px-4 py-3 font-semibold transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'news'
                  ? 'bg-white text-gray-800 border-b-2 border-blue-500'
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              <FontAwesomeIcon icon={faRss} />
              Tin Tức
              {loadingNews && <span className="text-xs">⏳</span>}
            </button>
          </div>
        </div>

        {/* Community Tab Content */}
        {activeTab === 'community' && (
          <div className="flex-1 flex flex-col animate-fadeIn">
        {/* Filters */}
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setSortBy('recent')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                sortBy === 'recent'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <FontAwesomeIcon icon={faSortAmountDown} className="mr-2" />
              Mới nhất
            </button>
            <button
              onClick={() => setSortBy('popular')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                sortBy === 'popular'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <FontAwesomeIcon icon={faThumbsUp} className="mr-2" />
              Phổ biến
            </button>
          </div>

          <div className="flex gap-2">
            {['all', 'flood', 'outage', 'other'].map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type as any)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  filterType === type
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type === 'all' ? 'Tất cả' : getTypeLabel(type)}
              </button>
            ))}
          </div>
        </div>

        {/* Reports List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredReports.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FontAwesomeIcon icon={faNewspaper} className="text-4xl mb-3" />
              <p>Chưa có báo cáo nào</p>
            </div>
          ) : (
            filteredReports.map(report => (
              <div
                key={report.id}
                className={`rounded-xl p-4 transition-all cursor-pointer relative group ${
                  selectedReportId === report.id 
                    ? 'bg-cyan-50 border-2 border-cyan-400 shadow-lg' 
                    : 'bg-gray-50 hover:bg-gray-100 hover:shadow-md'
                }`}
                onClick={() => handleReportSelect(report)}
                title={report.coordinates && report.coordinates.length > 1 ? 'Click to show route on map' : 'Click to view location'}
              >
                {/* Hover tooltip */}
                <div className="absolute left-0 top-0 -translate-y-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap z-50 shadow-xl">
                  {report.coordinates && report.coordinates.length > 1 
                    ? `🗺️ ${report.coordinates.length} điểm - Click để xem tuyến đường`
                    : '📍 Click để xem vị trí'}
                  <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                </div>

                {/* Report Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {report.coordinates && report.coordinates.length > 1 && (
                        <span className="px-2 py-1 rounded-lg text-xs font-bold bg-purple-100 text-purple-700">
                          🗺️ Tuyến đường
                        </span>
                      )}
                      {report.zoneCreated && (
                        <span className="px-2 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-orange-400 to-red-500 text-white shadow-md animate-pulse">
                          🔥 Đã tạo vùng
                        </span>
                      )}
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${getTypeColor(report.type)}`}>
                        {getTypeLabel(report.type)}
                      </span>
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${getSeverityColor(report.severity)}`}>
                        {report.severity === 'high' ? 'Cao' : report.severity === 'medium' ? 'Trung bình' : 'Thấp'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 font-medium line-clamp-2">
                      {report.description}
                    </p>
                  </div>
                </div>

                {/* Images */}
                {report.images && report.images.length > 0 && (
                  <div className="flex gap-2 mb-2 overflow-x-auto">
                    {report.images.slice(0, 3).map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt="Report"
                        className="w-20 h-20 object-cover rounded-lg cursor-pointer hover:opacity-80"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedImage(img);
                        }}
                      />
                    ))}
                    {report.images.length > 3 && (
                      <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center text-gray-600 text-xs font-bold">
                        +{report.images.length - 3}
                      </div>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVote(report.id, 'up');
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 font-semibold transition-colors text-sm"
                    >
                      <FontAwesomeIcon icon={faThumbsUp} className="text-base" />
                      <span>{report.upvotes?.length || 0}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVote(report.id, 'down');
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-semibold transition-colors text-sm"
                    >
                      <FontAwesomeIcon icon={faThumbsDown} className="text-base" />
                      <span>{report.downvotes?.length || 0}</span>
                    </button>
                    <ShareButton 
                      reportId={report.id}
                      description={report.description}
                      type={report.type}
                      severity={report.severity}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{new Date(report.createdAt).toLocaleString('vi-VN')}</span>
                </div>
              </div>
            ))
          )}
        </div>
        </div>
        )}

        {/* News Tab Content */}
        {activeTab === 'news' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 animate-fadeIn">
            {loadingNews ? (
              <div className="text-center py-12 text-gray-500">
                <FontAwesomeIcon icon={faRss} className="text-4xl mb-3 animate-spin" />
                <p>Đang tải tin tức...</p>
              </div>
            ) : newsItems.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FontAwesomeIcon icon={faRss} className="text-4xl mb-3" />
                <p>Chưa có tin tức nào</p>
              </div>
            ) : (
              newsItems.map((item, idx) => (
                <a
                  key={idx}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex gap-3">
                    {item.thumbnail && (
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm text-gray-800 line-clamp-2 mb-1">
                        {item.title}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {new Date(item.pubDate).toLocaleString('vi-VN')}
                      </p>
                    </div>
                  </div>
                  <div 
                    className="text-xs text-gray-600 mt-2 line-clamp-2"
                    dangerouslySetInnerHTML={{ __html: item.description }}
                  />
                </a>
              ))
            )}
          </div>
        )}
      </div>

      {/* Image Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300"
            onClick={() => setSelectedImage(null)}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
          <img
            src={selectedImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
