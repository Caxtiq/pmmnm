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

interface Camera {
    id: string;
    name: string;
    path: [number, number][]; // Array of [lng, lat] points forming a line
    status: 'active' | 'inactive' | 'error';
    threshold: number; // Total vehicle count threshold
    thresholds?: {
        car?: number;
        motorcycle?: number;
        truck?: number;
        bus?: number;
        bicycle?: number;
        person?: number;
        total?: number;
    };
    currentCounts?: {
        car: number;
        motorcycle: number;
        truck: number;
        bus: number;
        bicycle: number;
        person: number;
        total: number;
    };
}

interface CameraManagerProps {
    map: any;
    onClose: () => void;
    onStartPathDrawing?: (callback: (path: [number, number][]) => void) => void;
    onCompletePathDrawing?: () => void;
    onCancelPathDrawing?: () => void;
}

export default function CameraManager({ map, onClose, onStartPathDrawing, onCompletePathDrawing, onCancelPathDrawing }: CameraManagerProps) {
    const [cameras, setCameras] = useState<Camera[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddingCamera, setIsAddingCamera] = useState(false);
    const [isSelectingPath, setIsSelectingPath] = useState(false);
    const [pathPoints, setPathPoints] = useState<[number, number][]>([]);
    const [newCamera, setNewCamera] = useState({
        name: '',
        threshold: 50,
        streamUrl: '',
    });

    useEffect(() => {
        fetchCameras();
    }, []);

    useEffect(() => {
        // Cleanup on unmount
        return () => {
            if (isSelectingPath && onCancelPathDrawing) {
                onCancelPathDrawing();
            }
        };
    }, [isSelectingPath, onCancelPathDrawing]);

    const fetchCameras = async () => {
        try {
            const response = await fetch('/api/cameras');
            if (response.ok) {
                const data = await response.json();
                setCameras(data.cameras || []);
            }
        } catch (error) {
            console.error('Failed to fetch cameras:', error);
        } finally {
            setLoading(false);
        }
    };

    const startPathSelection = () => {
        if (!onStartPathDrawing) return;
        
        setIsSelectingPath(true);
        setPathPoints([]);
        
        // Start camera path drawing mode
        onStartPathDrawing((completedPath: [number, number][]) => {
            // This callback is called when user presses Enter in Maps.tsx
            setPathPoints(completedPath);
            setIsSelectingPath(false);
        });
    };

    const handleCancelPath = () => {
        setIsSelectingPath(false);
        setPathPoints([]);
        if (onCancelPathDrawing) {
            onCancelPathDrawing();
        }
    };

    const handleAddCamera = async () => {
        if (!newCamera.name || pathPoints.length < 2) {
            alert('Please provide camera name and select at least 2 points on the map (Press Enter to complete)');
            return;
        }

        try {
            const response = await fetch('/api/cameras', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newCamera.name,
                    path: pathPoints,
                    threshold: newCamera.threshold,
                    streamUrl: newCamera.streamUrl,
                }),
            });

            if (response.ok) {
                await fetchCameras();
                setNewCamera({ name: '', threshold: 50, streamUrl: '' });
                setIsAddingCamera(false);
                setPathPoints([]);
            } else {
                alert('Failed to add camera');
            }
        } catch (error) {
            console.error('Failed to add camera:', error);
            alert('Failed to add camera');
        }
    };

    const handleDeleteCamera = async (id: string) => {
        if (!confirm('Are you sure you want to delete this camera?')) return;

        try {
            const response = await fetch(`/api/cameras?id=${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                await fetchCameras();
            } else {
                alert('Failed to delete camera');
            }
        } catch (error) {
            console.error('Failed to delete camera:', error);
            alert('Failed to delete camera');
        }
    };

    const handleToggleStatus = async (camera: Camera) => {
        const newStatus = camera.status === 'active' ? 'inactive' : 'active';
        
        try {
            const response = await fetch('/api/cameras', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: camera.id,
                    status: newStatus,
                }),
            });

            if (response.ok) {
                await fetchCameras();
            } else {
                alert('Failed to update camera status');
            }
        } catch (error) {
            console.error('Failed to update camera:', error);
            alert('Failed to update camera');
        }
    };

    return (
        <div className={`fixed top-4 right-4 z-50 bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col ${isSelectingPath ? 'pointer-events-none opacity-50' : ''}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-purple-700 text-white">
                <h2 className="text-xl font-bold">📹 Camera Management</h2>
                <button
                    onClick={onClose}
                    className="text-white hover:text-gray-200 text-2xl font-bold transition-colors"
                >
                    ×
                </button>
            </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {/* Add Camera Section */}
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                        <button
                            onClick={() => {
                                setIsAddingCamera(!isAddingCamera);
                                if (isAddingCamera) {
                                    handleCancelPath();
                                    setNewCamera({ name: '', threshold: 50, streamUrl: '' });
                                }
                            }}
                            className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                        >
                            {isAddingCamera ? '− Cancel' : '+ Add New Camera'}
                        </button>

                        {isAddingCamera && (
                            <div className="space-y-3 mt-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Camera Name
                                    </label>
                                    <input
                                        type="text"
                                        value={newCamera.name}
                                        onChange={(e) => setNewCamera({ ...newCamera, name: e.target.value })}
                                        placeholder="e.g., Main Street Cam"
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Stream URL (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={newCamera.streamUrl}
                                        onChange={(e) => setNewCamera({ ...newCamera, streamUrl: e.target.value })}
                                        placeholder="rtsp://... or http://..."
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Threshold (vehicles)
                                    </label>
                                    <input
                                        type="number"
                                        value={newCamera.threshold}
                                        onChange={(e) => setNewCamera({ ...newCamera, threshold: parseInt(e.target.value) || 50 })}
                                        min="1"
                                        max="1000"
                                        placeholder="50"
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Road becomes crowded when this count is exceeded</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Path: {pathPoints.length >= 2 ? (
                                            <span className="text-green-600 font-semibold text-xs">
                                                ✓ {pathPoints.length} points
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 text-xs">
                                                {pathPoints.length === 1 ? '1 point (need 1+ more)' : 'Not selected'}
                                            </span>
                                        )}
                                    </label>
                                    <button
                                        onClick={startPathSelection}
                                        disabled={isSelectingPath}
                                        className={`w-full px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                                            isSelectingPath
                                                ? 'bg-yellow-500 text-white cursor-wait animate-pulse'
                                                : pathPoints.length >= 2
                                                ? 'bg-green-600 text-white hover:bg-green-700'
                                                : 'bg-purple-600 text-white hover:bg-purple-700'
                                        }`}
                                    >
                                        {isSelectingPath ? (
                                            <>🎯 Click points... (Enter to finish, ESC to cancel)</>
                                        ) : pathPoints.length >= 2 ? (
                                            <>✓ Path Selected</>
                                        ) : (
                                            <>📍 Select Path</>
                                        )}
                                    </button>
                                </div>
                                <button
                                    onClick={handleAddCamera}
                                    className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold"
                                >
                                    ✓ Create Camera
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Camera List */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-800 mb-2">Cameras ({cameras.length})</h3>
                        
                        {loading ? (
                            <div className="text-center py-4 text-sm text-gray-500">Loading...</div>
                        ) : cameras.length === 0 ? (
                            <div className="text-center py-4 text-sm text-gray-500">No cameras yet</div>
                        ) : (
                            <div className="space-y-2">
                                {cameras.map((camera) => (
                                    <div
                                        key={camera.id}
                                        className="p-3 border border-gray-200 rounded-lg hover:shadow-md transition-shadow bg-white"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="font-semibold text-sm text-gray-800 truncate">{camera.name}</h4>
                                                    <span
                                                        className={`px-1.5 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${
                                                            camera.status === 'active'
                                                                ? 'bg-green-100 text-green-700'
                                                                : camera.status === 'error'
                                                                ? 'bg-red-100 text-red-700'
                                                                : 'bg-gray-100 text-gray-700'
                                                        }`}
                                                    >
                                                        {camera.status}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-500 mb-1">
                                                    📍 Path with {camera.path.length} points | 🎯 Threshold: {camera.threshold}
                                                </p>
                                                {camera.currentCounts && (
                                                    <div className="text-xs text-gray-600 flex flex-wrap gap-1">
                                                        <span>🚗 {camera.currentCounts.car}</span>
                                                        <span>🏍️ {camera.currentCounts.motorcycle}</span>
                                                        <span>🚛 {camera.currentCounts.truck}</span>
                                                        <span className="font-semibold">Total: {camera.currentCounts.total}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => handleToggleStatus(camera)}
                                                className={`flex-1 px-2 py-1 rounded text-xs font-semibold transition-colors ${
                                                    camera.status === 'active'
                                                        ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                                                        : 'bg-green-500 text-white hover:bg-green-600'
                                                }`}
                                            >
                                                {camera.status === 'active' ? 'Pause' : 'Activate'}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteCamera(camera.id)}
                                                className="px-2 py-1 bg-red-500 text-white rounded text-xs font-semibold hover:bg-red-600 transition-colors"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
    );
}
