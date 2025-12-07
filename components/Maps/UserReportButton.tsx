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
    faExclamationTriangle, 
    faTimes, 
    faWater, 
    faBolt, 
    faCircleExclamation,
    faMapMarkerAlt,
    faCheckCircle
} from '@fortawesome/free-solid-svg-icons';
import vietmapgl from '@vietmap/vietmap-gl-js/dist/vietmap-gl.js';
import { useToast } from '@/components/ToastProvider';

interface UserReportButtonProps {
    map?: any;
}

export default function UserReportButton({ map }: UserReportButtonProps) {
    const { showToast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isSelectingLocation, setIsSelectingLocation] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [formData, setFormData] = useState({
        type: 'flood' as 'flood' | 'outage' | 'other',
        location: null as [number, number] | null,
        coordinates: null as number[][] | null, // For line reports
        description: '',
        severity: 'medium' as 'low' | 'medium' | 'high',
        reporterName: '',
        reporterContact: '',
        images: [] as string[] // Image URLs from GCS
    });
    const [uploadingImages, setUploadingImages] = useState<boolean>(false);
    const [tempMarkers, setTempMarkers] = useState<any[]>([]);
    const [tempLineLayer, setTempLineLayer] = useState<string | null>(null);

    useEffect(() => {
        if (!isSelectingLocation) {
            // Clean up markers
            setTempMarkers(prevMarkers => {
                prevMarkers.forEach(marker => marker.remove());
                return [];
            });
            
            // Clean up line layer
            setTempLineLayer(prevLayerId => {
                if (prevLayerId && map) {
                    if (map.getLayer(prevLayerId)) map.removeLayer(prevLayerId);
                    if (map.getSource(prevLayerId)) map.removeSource(prevLayerId);
                }
                return null;
            });
        }
    }, [isSelectingLocation, map]);

    const handleLocationSelect = () => {
        if (!map) return;
        
        setIsSelectingLocation(true);
        map.getCanvas().style.cursor = 'crosshair';

        const points: number[][] = [];
        const markers: any[] = [];
        const layerId = `temp-line-${Date.now()}`;

        const updateLine = () => {
            if (points.length < 2) return;

            // Remove old layer/source if exists
            if (map.getLayer(layerId)) map.removeLayer(layerId);
            if (map.getSource(layerId)) map.removeSource(layerId);

            // Add new line
            map.addSource(layerId, {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: points
                    }
                }
            });

            map.addLayer({
                id: layerId,
                type: 'line',
                source: layerId,
                paint: {
                    'line-color': '#ef4444',
                    'line-width': 4,
                    'line-opacity': 0.8
                }
            });

            setTempLineLayer(layerId);
        };

        const handleMapClick = (e: any) => {
            const { lng, lat } = e.lngLat;
            
            points.push([lng, lat]);

            // Add marker for this point
            const marker = new vietmapgl.Marker({ color: '#ef4444' })
                .setLngLat([lng, lat])
                .addTo(map);
            
            markers.push(marker);
            setTempMarkers(markers);

            // Update line if we have multiple points
            if (points.length >= 2) {
                updateLine();
            }

            // Store first point as main location, all points as coordinates
            if (points.length === 1) {
                setFormData(prev => ({ 
                    ...prev, 
                    location: [lng, lat],
                    coordinates: [[lng, lat]]
                }));
            } else {
                setFormData(prev => ({ 
                    ...prev, 
                    coordinates: [...points]
                }));
            }
        };

        const handleDblClick = (e: any) => {
            e.preventDefault();
            finishSelection();
        };

        const finishSelection = () => {
            if (points.length === 0) {
                showToast('Vui lòng chọn ít nhất một điểm', 'warning');
                return;
            }

            setIsSelectingLocation(false);
            map.getCanvas().style.cursor = '';
            map.off('click', handleMapClick);
            map.off('dblclick', handleDblClick);
            window.removeEventListener('keydown', handleKeyPress);
        };

        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                // Cancel selection
                setIsSelectingLocation(false);
                map.getCanvas().style.cursor = '';
                map.off('click', handleMapClick);
                map.off('dblclick', handleDblClick);
                window.removeEventListener('keydown', handleKeyPress);
                
                // Clear markers and line
                markers.forEach(m => m.remove());
                setTempMarkers([]);
                if (map.getLayer(layerId)) map.removeLayer(layerId);
                if (map.getSource(layerId)) map.removeSource(layerId);
                setTempLineLayer(null);
                
                setFormData(prev => ({ ...prev, location: null, coordinates: null }));
            } else if (e.key === 'Enter') {
                // Finish selection
                finishSelection();
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        map.on('click', handleMapClick);
        map.on('dblclick', handleDblClick);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        if (formData.images.length + files.length > 5) {
            showToast('Tối đa 5 ảnh', 'warning');
            return;
        }

        setUploadingImages(true);

        try {
            const uploadPromises = Array.from(files).map(async (file) => {
                const formData = new FormData();
                formData.append('file', file);

                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    throw new Error('Upload failed');
                }

                const data = await response.json();
                return data.url;
            });

            const imageUrls = await Promise.all(uploadPromises);
            setFormData(prev => ({
                ...prev,
                images: [...prev.images, ...imageUrls]
            }));
        } catch (error) {
            console.error('Image upload error:', error);
            showToast('Không thể tải ảnh lên', 'error');
        } finally {
            setUploadingImages(false);
        }
    };

    const removeImage = (index: number) => {
        setFormData(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.location) {
            showToast('Vui lòng chọn vị trí trên bản đồ', 'warning');
            return;
        }

        if (!formData.description.trim()) {
            showToast('Vui lòng mô tả tình huống', 'warning');
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch('/api/user-reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                setShowSuccess(true);
                showToast('Đã gửi báo cáo thành công!', 'success');
                setTimeout(() => {
                    setShowSuccess(false);
                    setIsOpen(false);
                    resetForm();
                }, 3000);
            } else {
                showToast('Lỗi: ' + (data.error || 'Không thể gửi báo cáo'), 'error');
            }
        } catch (error) {
            console.error('Failed to submit report:', error);
            showToast('Không thể kết nối đến máy chủ. Vui lòng thử lại.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            type: 'flood',
            location: null,
            coordinates: null,
            description: '',
            severity: 'medium',
            reporterName: '',
            reporterContact: '',
            images: []
        });
        
        // Clean up markers
        tempMarkers.forEach(marker => marker.remove());
        setTempMarkers([]);
        
        // Clean up line layer
        if (tempLineLayer && map) {
            if (map.getLayer(tempLineLayer)) map.removeLayer(tempLineLayer);
            if (map.getSource(tempLineLayer)) map.removeSource(tempLineLayer);
            setTempLineLayer(null);
        }
    };

    const handleClose = () => {
        setIsOpen(false);
        resetForm();
    };

    return (
        <>
            {/* Floating Report Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-24 right-4 z-30 bg-red-500 hover:bg-red-600 text-white rounded-full p-4 shadow-2xl transition-all hover:shadow-xl"
                title="Báo cáo sự cố"
            >
                <FontAwesomeIcon icon={faExclamationTriangle} size="lg" />
            </button>

            {/* Location Selection Indicator */}
            {isSelectingLocation && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[60] bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 rounded-xl shadow-2xl animate-pulse">
                    <div className="flex items-center gap-3">
                        <FontAwesomeIcon icon={faMapMarkerAlt} className="text-2xl" />
                        <div>
                            <p className="font-bold">📍 Nhấp để thêm điểm trên bản đồ</p>
                            <p className="text-xs text-blue-100">Nhấp đúp hoặc Enter để hoàn tất • ESC để hủy</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Report Modal */}
            {isOpen && !isSelectingLocation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white p-6 rounded-t-2xl relative">
                            <button
                                onClick={handleClose}
                                className="absolute top-4 right-4 text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all"
                            >
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                            <h2 className="text-2xl font-bold flex items-center gap-3">
                                <FontAwesomeIcon icon={faExclamationTriangle} />
                                Báo Cáo Sự Cố
                            </h2>
                            <p className="text-sm mt-1 text-red-50">
                                Giúp cộng đồng bằng cách báo cáo tình trạng khẩn cấp
                            </p>
                        </div>

                        {/* Success Message */}
                        {showSuccess && (
                            <div className="bg-green-50 border-l-4 border-green-500 p-4 m-6 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 text-2xl" />
                                    <div>
                                        <h3 className="font-bold text-green-800">Gửi báo cáo thành công!</h3>
                                        <p className="text-sm text-green-700">Cảm ơn bạn đã góp phần giúp cộng đồng.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Form */}
                        {!showSuccess && (
                            <form onSubmit={handleSubmit} className="p-6 space-y-5">
                                {/* Type Selection */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-3">
                                        Loại Sự Cố *
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, type: 'flood' })}
                                            className={`p-3 rounded-xl font-medium transition-all flex flex-col items-center gap-2 ${
                                                formData.type === 'flood'
                                                    ? 'bg-blue-500 text-white shadow-lg'
                                                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                            }`}
                                        >
                                            <FontAwesomeIcon icon={faWater} className="text-xl" />
                                            <span className="text-xs">Lũ Lụt</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, type: 'outage' })}
                                            className={`p-3 rounded-xl font-medium transition-all flex flex-col items-center gap-2 ${
                                                formData.type === 'outage'
                                                    ? 'bg-orange-500 text-white shadow-lg'
                                                    : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                                            }`}
                                        >
                                            <FontAwesomeIcon icon={faBolt} className="text-xl" />
                                            <span className="text-xs">Mất Điện</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, type: 'other' })}
                                            className={`p-3 rounded-xl font-medium transition-all flex flex-col items-center gap-2 ${
                                                formData.type === 'other'
                                                    ? 'bg-gray-500 text-white shadow-lg'
                                                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                                            }`}
                                        >
                                            <FontAwesomeIcon icon={faCircleExclamation} className="text-xl" />
                                            <span className="text-xs">Khác</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Location */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Vị Trí *
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleLocationSelect}
                                        className={`w-full p-4 rounded-xl font-medium transition-all flex items-center justify-center gap-3 ${
                                            formData.location
                                                ? 'bg-green-50 border-2 border-green-400 text-green-700'
                                                : 'bg-gray-50 border-2 border-gray-300 text-gray-700 hover:border-gray-400'
                                        }`}
                                    >
                                        <FontAwesomeIcon icon={faMapMarkerAlt} className="text-xl" />
                                        {formData.location ? (
                                            <div className="text-sm">
                                                <div className="font-bold">✓ Đã chọn {formData.coordinates?.length || 1} điểm</div>
                                                {formData.coordinates && formData.coordinates.length > 1 && (
                                                    <div className="text-xs text-green-600 mt-1">
                                                        Đường kẻ từ {formData.coordinates.length} điểm
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span>Nhấp để chọn điểm trên bản đồ</span>
                                        )}
                                    </button>
                                    {isSelectingLocation && (
                                        <p className="text-xs text-blue-600 mt-2 animate-pulse">
                                            📍 Nhấp vào bản đồ để chọn vị trí...
                                        </p>
                                    )}
                                </div>

                                {/* Severity */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-3">
                                        Mức Độ Nghiêm Trọng *
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, severity: 'low' })}
                                            className={`p-3 rounded-xl font-medium transition-all ${
                                                formData.severity === 'low'
                                                    ? 'bg-yellow-400 text-yellow-900 shadow-lg'
                                                    : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                                            }`}
                                        >
                                            Nhẹ
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, severity: 'medium' })}
                                            className={`p-3 rounded-xl font-medium transition-all ${
                                                formData.severity === 'medium'
                                                    ? 'bg-orange-400 text-orange-900 shadow-lg'
                                                    : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                                            }`}
                                        >
                                            Trung Bình
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, severity: 'high' })}
                                            className={`p-3 rounded-xl font-medium transition-all ${
                                                formData.severity === 'high'
                                                    ? 'bg-red-500 text-white shadow-lg'
                                                    : 'bg-red-50 text-red-700 hover:bg-red-100'
                                            }`}
                                        >
                                            Nghiêm Trọng
                                        </button>
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Mô Tả Tình Huống *
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Mô tả chi tiết tình huống (ví dụ: nước ngập cao 50cm, đường không thể đi lại...)"
                                        rows={4}
                                        className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-red-400 focus:outline-none resize-none"
                                        required
                                    />
                                </div>

                                {/* Image Upload */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Hình Ảnh (tối đa 5 ảnh)
                                    </label>
                                    <div className="space-y-3">
                                        {formData.images.length > 0 && (
                                            <div className="grid grid-cols-3 gap-2">
                                                {formData.images.map((img, idx) => (
                                                    <div key={idx} className="relative group">
                                                        <img 
                                                            src={img} 
                                                            alt={`Upload ${idx + 1}`}
                                                            className="w-full h-24 object-cover rounded-lg"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => removeImage(idx)}
                                                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <FontAwesomeIcon icon={faTimes} className="text-xs" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {formData.images.length < 5 && (
                                            <label className="block w-full p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-red-400 transition-colors cursor-pointer text-center">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    multiple
                                                    onChange={handleImageUpload}
                                                    className="hidden"
                                                    disabled={uploadingImages}
                                                />
                                                <div className="text-gray-600">
                                                    {uploadingImages ? (
                                                        <span>⏳ Đang tải lên...</span>
                                                    ) : (
                                                        <>
                                                            <span className="text-2xl">📷</span>
                                                            <p className="text-sm font-semibold mt-1">Tải ảnh lên</p>
                                                            <p className="text-xs text-gray-500">Tối đa 5MB/ảnh</p>
                                                        </>
                                                    )}
                                                </div>
                                            </label>
                                        )}
                                    </div>
                                </div>

                                {/* Optional Contact Info */}
                                <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                                    <p className="text-xs font-bold text-gray-600">Thông tin liên hệ (không bắt buộc)</p>
                                    <input
                                        type="text"
                                        value={formData.reporterName}
                                        onChange={(e) => setFormData({ ...formData, reporterName: e.target.value })}
                                        placeholder="Tên của bạn"
                                        className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-red-400 focus:outline-none"
                                    />
                                    <input
                                        type="text"
                                        value={formData.reporterContact}
                                        onChange={(e) => setFormData({ ...formData, reporterContact: e.target.value })}
                                        placeholder="Số điện thoại hoặc email"
                                        className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-red-400 focus:outline-none"
                                    />
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !formData.location || !formData.description.trim()}
                                    className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold py-4 rounded-xl hover:from-red-600 hover:to-orange-600 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
                                >
                                    {isSubmitting ? '⏳ Đang gửi...' : '📤 Gửi Báo Cáo'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
