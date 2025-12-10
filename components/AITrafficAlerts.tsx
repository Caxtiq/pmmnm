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

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBrain,
  faRefresh,
  faMapMarkerAlt,
  faExclamationTriangle,
  faCar,
  faWater,
  faHardHat,
  faTimes,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import { useToast } from './ToastProvider';

interface TrafficIssue {
  location: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  type: 'flood' | 'accident' | 'congestion' | 'construction' | 'other';
  coordinates?: [number, number][];
  fullLocation?: string;
}

interface AITrafficAlertsProps {
  onIssueClick?: (issue: TrafficIssue) => void;
  onClose?: () => void;
}

export default function AITrafficAlerts({ onIssueClick, onClose }: AITrafficAlertsProps) {
  const { showToast } = useToast();
  const [issues, setIssues] = useState<TrafficIssue[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [analyzedAt, setAnalyzedAt] = useState<number | null>(null);
  const [articlesCount, setArticlesCount] = useState<number>(0);
  const [isCached, setIsCached] = useState(false);

  const analyzeTraffic = async (forceRefresh: boolean = false) => {
    setLoading(true);
    try {
      const url = forceRefresh ? '/api/traffic-analysis?refresh=true' : '/api/traffic-analysis';
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setIssues(data.issues || []);
        setSummary(data.summary || '');
        setAnalyzedAt(data.analyzedAt);
        setArticlesCount(data.articlesAnalyzed || 0);
        setIsCached(data.cached || false);
        
        if (data.cached && !forceRefresh) {
          showToast('Hiển thị kết quả đã lưu (cập nhật mỗi 30 phút)', 'info');
        } else if (data.issues.length > 0) {
          showToast(`Phát hiện ${data.issues.length} vấn đề giao thông từ tin tức`, 'success');
        } else {
          showToast('Không tìm thấy vấn đề giao thông nghiêm trọng', 'info');
        }
      } else {
        showToast('Lỗi phân tích tin tức: ' + data.error, 'error');
      }
    } catch (error) {
      console.error('Failed to analyze traffic:', error);
      showToast('Không thể phân tích tin tức giao thông', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      default:
        return 'bg-green-100 text-green-700 border-green-300';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'high':
        return '🔴 Nghiêm trọng';
      case 'medium':
        return '🟡 Trung bình';
      default:
        return '🟢 Nhẹ';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'flood':
        return faWater;
      case 'accident':
        return faExclamationTriangle;
      case 'congestion':
        return faCar;
      case 'construction':
        return faHardHat;
      default:
        return faMapMarkerAlt;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'flood':
        return 'Ngập lụt';
      case 'accident':
        return 'Tai nạn';
      case 'congestion':
        return 'Tắc đường';
      case 'construction':
        return 'Thi công';
      default:
        return 'Khác';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'flood':
        return 'text-blue-600';
      case 'accident':
        return 'text-red-600';
      case 'congestion':
        return 'text-orange-600';
      case 'construction':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  const handleIssueClick = (issue: TrafficIssue) => {
    if (issue.coordinates && issue.coordinates.length > 0) {
      onIssueClick?.(issue);
    } else {
      showToast('Không tìm thấy tọa độ cho vị trí này', 'warning');
    }
  };

  return (
    <div className="fixed top-20 right-4 bottom-4 z-30 bg-white rounded-2xl shadow-2xl w-96 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 rounded-t-2xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FontAwesomeIcon icon={faBrain} />
            AI Phân Tích Tin Tức
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => analyzeTraffic(true)}
              disabled={loading}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors disabled:opacity-50"
              title="Làm mới (bỏ qua cache)"
            >
              <FontAwesomeIcon icon={loading ? faSpinner : faRefresh} className={loading ? 'animate-spin' : ''} />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                title="Đóng"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            )}
          </div>
        </div>
        
        {analyzedAt && (
          <div className="text-white/80 text-xs">
            <p>
              {isCached && '💾 '}Phân tích {articlesCount} bài báo
              {isCached && ' (đã lưu)'}
            </p>
            <p>{new Date(analyzedAt).toLocaleString('vi-VN')}</p>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center py-12">
            <FontAwesomeIcon icon={faSpinner} className="text-4xl text-purple-500 mb-3 animate-spin" />
            <p className="text-gray-600">Đang phân tích tin tức với AI...</p>
            <p className="text-xs text-gray-500 mt-2">Có thể mất vài giây</p>
          </div>
        ) : issues.length === 0 && !summary ? (
          <div className="text-center py-12">
            <FontAwesomeIcon icon={faBrain} className="text-4xl text-gray-400 mb-3" />
            <p className="text-gray-600 mb-4">Chưa có dữ liệu phân tích</p>
            <div className="flex gap-2">
              <button
                onClick={() => analyzeTraffic(false)}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                <FontAwesomeIcon icon={faBrain} className="mr-2" />
                Phân Tích
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            {summary && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <FontAwesomeIcon icon={faBrain} className="text-purple-600" />
                  Tổng Quan
                </h3>
                <p className="text-sm text-gray-700">{summary}</p>
              </div>
            )}

            {/* Issues */}
            {issues.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-bold text-gray-800">Vấn Đề Phát Hiện ({issues.length})</h3>
                {issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={`bg-white border-2 rounded-xl p-4 cursor-pointer hover:shadow-lg transition-all ${
                      issue.coordinates && issue.coordinates.length > 0
                        ? 'hover:border-purple-400'
                        : 'opacity-75 cursor-not-allowed'
                    }`}
                    onClick={() => handleIssueClick(issue)}
                  >
                    {/* Type & Severity */}
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${getSeverityColor(issue.severity)} border`}>
                        {getSeverityLabel(issue.severity)}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold bg-gray-100 ${getTypeColor(issue.type)}`}>
                        <FontAwesomeIcon icon={getTypeIcon(issue.type)} className="mr-1" />
                        {getTypeLabel(issue.type)}
                      </span>
                    </div>

                    {/* Location */}
                    <div className="mb-2">
                      <div className="flex items-start gap-2">
                        <FontAwesomeIcon icon={faMapMarkerAlt} className="text-purple-600 mt-1" />
                        <div className="flex-1">
                          <p className="font-bold text-gray-800">{issue.fullLocation || issue.location}</p>
                          {issue.coordinates && issue.coordinates.length > 0 && (
                            <p className="text-xs text-green-600 mt-1">
                              ✓ Đã xác định vị trí ({issue.coordinates.length} điểm)
                            </p>
                          )}
                          {(!issue.coordinates || issue.coordinates.length === 0) && (
                            <p className="text-xs text-orange-600 mt-1">
                              ⚠ Chưa tìm thấy tọa độ chính xác
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                      {issue.description}
                    </p>

                    {/* Action hint */}
                    {issue.coordinates && issue.coordinates.length > 0 && (
                      <p className="text-xs text-purple-600 mt-2 text-center">
                        👆 Click để xem trên bản đồ
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {issues.length === 0 && summary && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                <p className="text-sm text-blue-700">
                  ✓ Không phát hiện vấn đề giao thông nghiêm trọng
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-50 px-4 py-3 rounded-b-2xl border-t">
        <p className="text-xs text-gray-500 text-center">
          🤖 Được phân tích bởi Google Gemini AI
        </p>
      </div>
    </div>
  );
}
