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
  faChartLine, 
  faMapMarkerAlt, 
  faClock,
  faArrowUp,
  faArrowDown,
  faMinus,
  faInfoCircle,
  faRefresh,
  faTimes
} from '@fortawesome/free-solid-svg-icons';

interface CrowdingPrediction {
  location: [number, number];
  areaName: string;
  crowdingLevel: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  predictedFor: number;
  basedOnDays: number;
  factors: {
    historicalReports: number;
    timeOfDay: number;
    dayOfWeek: number;
    weatherImpact: number;
    activeZones: number;
  };
}

interface HourlyData {
  hour: number;
  crowdingLevel: number;
  confidence: number;
}

interface PredictionPanelProps {
  onPredictionClick?: (location: [number, number]) => void;
  onClose?: () => void;
}

export default function PredictionPanel({ onPredictionClick, onClose }: PredictionPanelProps) {
  const [predictions, setPredictions] = useState<CrowdingPrediction[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [selectedPrediction, setSelectedPrediction] = useState<CrowdingPrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'hourly'>('list');
  const [daysToAnalyze, setDaysToAnalyze] = useState(30);
  const [predictionHours, setPredictionHours] = useState(24);

  useEffect(() => {
    fetchPredictions();
  }, [daysToAnalyze, predictionHours]);

  const fetchPredictions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/predictions?type=general&days=${daysToAnalyze}&hours=${predictionHours}`);
      const data = await response.json();
      if (data.predictions) {
        setPredictions(data.predictions);
      }
    } catch (error) {
      console.error('Failed to fetch predictions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHourlyData = async (location: [number, number]) => {
    try {
      const response = await fetch(
        `/api/predictions?type=hourly&lat=${location[1]}&lng=${location[0]}&days=${daysToAnalyze}`
      );
      const data = await response.json();
      if (data.hourlyData) {
        setHourlyData(data.hourlyData);
      }
    } catch (error) {
      console.error('Failed to fetch hourly data:', error);
    }
  };

  const handlePredictionSelect = (prediction: CrowdingPrediction) => {
    setSelectedPrediction(prediction);
    fetchHourlyData(prediction.location);
    setView('hourly');
    onPredictionClick?.(prediction.location);
  };

  const getCrowdingColor = (level: number) => {
    if (level >= 70) return 'bg-red-500';
    if (level >= 40) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getCrowdingLabel = (level: number) => {
    if (level >= 70) return 'Đông đúc';
    if (level >= 40) return 'Trung bình';
    return 'Thưa thớt';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return faArrowUp;
      case 'decreasing': return faArrowDown;
      default: return faMinus;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'increasing': return 'text-red-500';
      case 'decreasing': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  const getTrendLabel = (trend: string) => {
    switch (trend) {
      case 'increasing': return 'Tăng';
      case 'decreasing': return 'Giảm';
      default: return 'Ổn định';
    }
  };

  return (
    <div className="fixed top-20 right-4 bottom-4 z-30 bg-white rounded-2xl shadow-2xl w-96 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 rounded-t-2xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FontAwesomeIcon icon={faChartLine} />
            Dự Đoán Mật Độ
          </h2>
          <div className="flex gap-2">
            <button
              onClick={fetchPredictions}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
              title="Làm mới"
            >
              <FontAwesomeIcon icon={faRefresh} />
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

        {/* Controls */}
        <div className="flex gap-2">
          <button
            onClick={() => setView('list')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
              view === 'list'
                ? 'bg-white text-indigo-600'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            Danh sách
          </button>
          <button
            onClick={() => setView('hourly')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
              view === 'hourly'
                ? 'bg-white text-indigo-600'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
            disabled={!selectedPrediction}
          >
            Theo giờ
          </button>
        </div>

        {/* Settings */}
        <div className="flex gap-2 mt-3">
          <select
            value={daysToAnalyze}
            onChange={(e) => setDaysToAnalyze(parseInt(e.target.value))}
            className="flex-1 px-3 py-1 bg-white/20 text-white text-sm rounded-lg border border-white/30 focus:outline-none"
          >
            <option value={7}>7 ngày</option>
            <option value={14}>14 ngày</option>
            <option value={30}>30 ngày</option>
            <option value={60}>60 ngày</option>
          </select>
          <select
            value={predictionHours}
            onChange={(e) => setPredictionHours(parseInt(e.target.value))}
            className="flex-1 px-3 py-1 bg-white/20 text-white text-sm rounded-lg border border-white/30 focus:outline-none"
          >
            <option value={6}>+6 giờ</option>
            <option value={12}>+12 giờ</option>
            <option value={24}>+24 giờ</option>
            <option value={48}>+48 giờ</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            <FontAwesomeIcon icon={faRefresh} className="text-4xl mb-3 animate-spin" />
            <p>Đang phân tích dữ liệu...</p>
          </div>
        ) : view === 'list' ? (
          <div className="space-y-3">
            {predictions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FontAwesomeIcon icon={faInfoCircle} className="text-4xl mb-3" />
                <p>Chưa có dự đoán</p>
                <p className="text-xs mt-2">Cần thêm dữ liệu lịch sử</p>
              </div>
            ) : (
              predictions.map((pred, idx) => (
                <div
                  key={idx}
                  className={`bg-gray-50 rounded-xl p-4 cursor-pointer hover:bg-gray-100 transition-colors ${
                    selectedPrediction === pred ? 'ring-2 ring-indigo-500' : ''
                  }`}
                  onClick={() => handlePredictionSelect(pred)}
                >
                  {/* Location */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
                        <FontAwesomeIcon icon={faMapMarkerAlt} className="text-indigo-600" />
                        {pred.areaName}
                      </h3>
                      <p className="text-xs text-gray-500">
                        <FontAwesomeIcon icon={faClock} className="mr-1" />
                        {new Date(pred.predictedFor).toLocaleString('vi-VN')}
                      </p>
                    </div>
                  </div>

                  {/* Crowding Level */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-700">
                        {getCrowdingLabel(pred.crowdingLevel)}
                      </span>
                      <span className="text-sm font-bold text-gray-800">{pred.crowdingLevel}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${getCrowdingColor(pred.crowdingLevel)}`}
                        style={{ width: `${pred.crowdingLevel}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Trend & Confidence */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className={`font-semibold ${getTrendColor(pred.trend)}`}>
                        <FontAwesomeIcon icon={getTrendIcon(pred.trend)} className="mr-1" />
                        {getTrendLabel(pred.trend)}
                      </span>
                      <span className="text-gray-500">
                        Độ tin cậy: {pred.confidence}%
                      </span>
                    </div>
                  </div>

                  {/* Factors (collapsed) */}
                  {selectedPrediction === pred && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Yếu tố ảnh hưởng:</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Báo cáo/ngày:</span>
                          <span className="font-semibold">{pred.factors.historicalReports}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Giờ trong ngày:</span>
                          <span className="font-semibold">{pred.factors.timeOfDay}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Thứ trong tuần:</span>
                          <span className="font-semibold">{pred.factors.dayOfWeek}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Khu vực nguy:</span>
                          <span className="font-semibold">{pred.factors.activeZones}</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Dựa trên {pred.basedOnDays} ngày dữ liệu
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          // Hourly View
          <div className="space-y-4">
            {selectedPrediction && (
              <>
                <button
                  onClick={() => setView('list')}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-semibold"
                >
                  ← Quay lại danh sách
                </button>

                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-bold text-gray-800 mb-1">{selectedPrediction.areaName}</h3>
                  <p className="text-xs text-gray-500 mb-4">Mật độ theo giờ trong ngày</p>

                  {/* Hourly Chart */}
                  <div className="space-y-2">
                    {hourlyData.map((data) => (
                      <div key={data.hour} className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-gray-600 w-12">
                          {data.hour}:00
                        </span>
                        <div className="flex-1 relative">
                          <div className="w-full bg-gray-200 rounded-full h-4">
                            <div
                              className={`h-4 rounded-full ${getCrowdingColor(data.crowdingLevel)}`}
                              style={{ width: `${data.crowdingLevel}%` }}
                            ></div>
                          </div>
                          <span className="absolute right-2 top-0 text-xs font-bold text-gray-700">
                            {data.crowdingLevel}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Legend */}
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Chú thích:</p>
                  <div className="flex gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-green-500 rounded"></div>
                      <span>Thưa (0-40%)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                      <span>TB (40-70%)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-red-500 rounded"></div>
                      <span>Đông (70-100%)</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
