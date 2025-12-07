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
import { faRobot, faSpinner, faNewspaper, faMapMarkerAlt, faCheckCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

interface AICrawlerButtonProps {
  onZonesCreated?: () => void;
}

export default function AICrawlerButton({ onZonesCreated }: AICrawlerButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCrawl = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/ai-crawler', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        if (onZonesCreated) {
          onZonesCreated();
        }
      } else {
        setError(data.error || 'Không thể thu thập tin tức');
      }
    } catch (err) {
      console.error('Crawler error:', err);
      setError('Không thể kết nối đến máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all font-semibold flex items-center gap-2"
        title="AI News Crawler"
      >
        <FontAwesomeIcon icon={faRobot} />
        <span>AI Crawler</span>
      </button>
    );
  }

  return (
    <div className="fixed top-20 right-4 z-50 bg-white rounded-2xl shadow-2xl w-96 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <FontAwesomeIcon icon={faRobot} className="text-2xl text-purple-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">AI News Crawler</h3>
            <p className="text-xs text-gray-500">Thu thập & phân tích tin tức</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
          <div className="flex items-start gap-3">
            <FontAwesomeIcon icon={faNewspaper} className="text-blue-600 mt-1" />
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 text-sm mb-1">Tính năng</h4>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Thu thập tin từ VnExpress</li>
                <li>• Nhận diện ngập lụt & tắc đường</li>
                <li>• Tự động tạo vùng cảnh báo</li>
                <li>• Xác định mức độ nghiêm trọng</li>
              </ul>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-200 p-3 rounded-xl flex items-start gap-2">
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-600 mt-1" />
            <div className="flex-1">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {result && (
          <div className="bg-green-50 border-2 border-green-200 p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />
              <h4 className="font-bold text-gray-900">Kết quả</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Bài viết tìm thấy:</span>
                <span className="font-bold text-gray-900">{result.articlesFound}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Bài viết phân tích:</span>
                <span className="font-bold text-gray-900">{result.articlesAnalyzed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Vùng tạo mới:</span>
                <span className="font-bold text-blue-600 flex items-center gap-1">
                  <FontAwesomeIcon icon={faMapMarkerAlt} className="text-xs" />
                  {result.zonesCreated}
                </span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleCrawl}
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <FontAwesomeIcon icon={faSpinner} spin />
              <span>Đang thu thập...</span>
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faRobot} />
              <span>Bắt đầu thu thập</span>
            </>
          )}
        </button>

        <p className="text-xs text-gray-500 text-center">
          Bot sẽ tìm kiếm tin tức về ngập lụt, tắc đường và tự động tạo vùng cảnh báo trên bản đồ
        </p>
      </div>
    </div>
  );
}
