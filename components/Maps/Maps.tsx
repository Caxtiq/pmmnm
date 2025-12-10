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
import vietmapgl from '@vietmap/vietmap-gl-js/dist/vietmap-gl.js';
import '@vietmap/vietmap-gl-js/dist/vietmap-gl.css';
import { useState, useEffect, useRef } from 'react';
import AdminPanel from './AdminPanel';
import UserReportButton from './UserReportButton';
import WeatherPanel from './WeatherPanel';
import CameraViewer from '../CameraViewer';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMap, faCloudSun } from '@fortawesome/free-solid-svg-icons';

interface Zone {
    id: string;
    type: 'flood' | 'outage';
    shape: 'circle' | 'line';
    center?: number[]; // [lng, lat] for circles (zones)
    radius?: number; // in meters for circles (zones)
    coordinates?: number[][]; // for lines (routes/paths)
    riskLevel?: number;
    title?: string;
    description?: string;
}

interface Sensor {
    id: string;
    name: string;
    location: [number, number];
    type: 'water_level' | 'temperature' | 'humidity';
    threshold: number;
    actionType: 'flood' | 'outage';
    createdAt?: number;
}

interface UserReport {
    id: string;
    type: 'flood' | 'outage' | 'other';
    location: [number, number];
    description: string;
    severity: 'low' | 'medium' | 'high';
    reporterName?: string;
    status: 'new' | 'investigating' | 'resolved';
    createdAt: number;
}

interface MapsProps {
    isAdmin?: boolean;
}

export default function Maps({ isAdmin = false }: MapsProps) {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const [map, setMap] = useState<vietmapgl.Map | null>(null);
    const [isMounted, setIsMounted] = useState(false);
    const [zones, setZones] = useState<Zone[]>([]);
    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawingType, setDrawingType] = useState<'flood' | 'outage' | null>(null);
    const [drawingShape, setDrawingShape] = useState<'circle' | 'line'>('circle');
    const [drawingCenter, setDrawingCenter] = useState<number[] | null>(null);
    const [drawingRadius, setDrawingRadius] = useState<number>(0);
    const [drawingPoints, setDrawingPoints] = useState<number[][]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const [hoveredZone, setHoveredZone] = useState<Zone | null>(null);
    const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
    const [showTitleDialog, setShowTitleDialog] = useState(false);
    const [pendingZone, setPendingZone] = useState<Zone | null>(null);
    const [zoneForm, setZoneForm] = useState({ title: '', description: '' });
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [userReports, setUserReports] = useState<UserReport[]>([]);
    const [viewMode, setViewMode] = useState<'map' | 'weather'>('map');
    const [cameras, setCameras] = useState<any[]>([]);
    const [selectedCamera, setSelectedCamera] = useState<any | null>(null);
    const [isDrawingCameraPath, setIsDrawingCameraPath] = useState(false);
    const [cameraPathPoints, setCameraPathPoints] = useState<[number, number][]>([]);
    const [cameraPathCallback, setCameraPathCallback] = useState<((path: [number, number][]) => void) | null>(null);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Load zones, sensors, and user reports from database on mount
    useEffect(() => {
        fetch('/api/zones')
            .then(res => res.json())
            .then(data => {
                if (data.zones) {
                    setZones(data.zones);
                }
            })
            .catch(err => console.error('Failed to load zones:', err));
        
        fetch('/api/user-reports')
            .then(res => res.json())
            .then(data => {
                if (data.reports) {
                    setUserReports(data.reports);
                }
            })
            .catch(err => console.error('Failed to load user reports:', err));
        
        if (isAdmin) {
            fetch('/api/sensors')
                .then(res => res.json())
                .then(data => {
                    if (data.sensors) {
                        setSensors(data.sensors);
                    }
                })
                .catch(err => console.error('Failed to load sensors:', err));
            
            // Load cameras
            fetch('/api/cameras')
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setCameras(data);
                    }
                })
                .catch(err => console.error('Failed to load cameras:', err));
        }
    }, [isAdmin]);

    // Setup WebSocket connection for real-time updates
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('WebSocket connected');
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                
                if (message.type === 'zone_created') {
                    setZones(prev => [...prev, message.zone]);
                } else if (message.type === 'zone_updated') {
                    setZones(prev => prev.map(z => z.id === message.zone.id ? message.zone : z));
                } else if (message.type === 'zone_deleted') {
                    setZones(prev => prev.filter(z => z.id !== message.zoneId));
                } else if (message.type === 'zones_cleared') {
                    setZones([]);
                } else if (message.type === 'sensor_data') {
                    console.log('Sensor data received:', message.data);
                } else if (message.type === 'prediction') {
                    console.log('Prediction received:', message.prediction);
                } else if (message.type === 'sensor_created' && isAdmin) {
                    setSensors(prev => [...prev, message.sensor]);
                } else if (message.type === 'sensor_deleted' && isAdmin) {
                    setSensors(prev => prev.filter(s => s.id !== message.sensorId));
                } else if (message.type === 'user_report_created') {
                    setUserReports(prev => [...prev, message.report]);
                } else if (message.type === 'camera-update') {
                    // Update camera counts in real-time
                    setCameras(prev => prev.map(cam => 
                        cam.id === message.cameraId 
                            ? { ...cam, currentCounts: message.counts, stats: { ...cam.stats, lastUpdate: message.timestamp } }
                            : cam
                    ));
                }
            } catch (error) {
                console.error('Failed to parse WebSocket message:', error);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected');
        };

        return () => {
            ws.close();
        };
    }, []);

    // Update map when zones change
    useEffect(() => {
        if (map && zones.length > 0) {
            updateZonesOnMap(zones);
        }
    }, [zones, map]);

    // Update map when sensors change
    useEffect(() => {
        if (map && isAdmin) {
            updateSensorsOnMap(sensors);
        }
    }, [sensors, map, isAdmin]);

    // Update map when cameras change
    useEffect(() => {
        if (map && isAdmin && cameras.length > 0) {
            updateCamerasOnMap(cameras);
        }
    }, [cameras, map, isAdmin]);

    // Update map when user reports change
    useEffect(() => {
        if (map && userReports.length > 0) {
            updateUserReportsOnMap(userReports);
        }
    }, [userReports, map]);

    useEffect(() => {
        if (!isMounted || !mapContainerRef.current || map) return;

        const apiKey = process.env.NEXT_PUBLIC_VIETMAP_API_KEY || '';

        const mapInstance = new vietmapgl.Map({
            container: mapContainerRef.current,
            style: `https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=${apiKey}`,
            center: [105.748684, 20.962594], // Hanoi coordinates
            
            zoom: 12,
            transformRequest: (url: string) => {
                if (url.includes('vietmap.vn')) {
                    return {
                        url: url.includes('?') ? `${url}&apikey=${apiKey}` : `${url}?apikey=${apiKey}`
                    };
                }
                return { url };
            }
        });

        mapInstance.addControl(new vietmapgl.NavigationControl(), 'top-right');
        mapInstance.addControl(new vietmapgl.GeolocateControl({
            positionOptions: {
                enableHighAccuracy: true
            },
            trackUserLocation: true
        }));

        mapInstance.on('load', () => {
            // Add sources for zones
            mapInstance.addSource('zones', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: []
                }
            });

            // Add source for sensors
            if (isAdmin) {
                mapInstance.addSource('sensors', {
                    type: 'geojson',
                    data: {
                        type: 'FeatureCollection',
                        features: []
                    }
                });

                // Add source for cameras
                mapInstance.addSource('cameras', {
                    type: 'geojson',
                    data: {
                        type: 'FeatureCollection',
                        features: []
                    }
                });
            }

            // Add source for user reports
            mapInstance.addSource('user-reports', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: []
                }
            });

            // Add layer for flood circle zones
            mapInstance.addLayer({
                id: 'flood-zones',
                type: 'fill',
                source: 'zones',
                filter: ['all', ['==', ['get', 'type'], 'flood'], ['==', ['get', 'shape'], 'circle']],
                paint: {
                    'fill-color': '#3b82f6',
                    'fill-opacity': 0.4
                }
            });

            // Add layer for outage circle zones
            mapInstance.addLayer({
                id: 'outage-zones',
                type: 'fill',
                source: 'zones',
                filter: ['all', ['==', ['get', 'type'], 'outage'], ['==', ['get', 'shape'], 'circle']],
                paint: {
                    'fill-color': '#ef4444',
                    'fill-opacity': 0.4
                }
            });

            // Add line layers for routes/paths
            mapInstance.addLayer({
                id: 'zones-lines',
                type: 'line',
                source: 'zones',
                filter: ['==', ['get', 'shape'], 'line'],
                paint: {
                    'line-color': ['case',
                        ['==', ['get', 'type'], 'flood'], '#2563eb',
                        ['==', ['get', 'type'], 'outage'], '#dc2626',
                        '#000000'
                    ],
                    'line-width': 6,
                    'line-opacity': 0.8
                }
            });

            // Add outline layers
            mapInstance.addLayer({
                id: 'zones-outline',
                type: 'line',
                source: 'zones',
                filter: ['==', ['get', 'shape'], 'circle'],
                paint: {
                    'line-color': ['case',
                        ['==', ['get', 'type'], 'flood'], '#2563eb',
                        ['==', ['get', 'type'], 'outage'], '#dc2626',
                        '#000000'
                    ],
                    'line-width': 2
                }
            });

            // Add sensor layers for admins
            if (isAdmin) {
                mapInstance.addLayer({
                    id: 'sensors-circle',
                    type: 'circle',
                    source: 'sensors',
                    paint: {
                        'circle-radius': 8,
                        'circle-color': '#10b981',
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#ffffff',
                        'circle-opacity': 0.8
                    }
                });

                mapInstance.addLayer({
                    id: 'sensors-label',
                    type: 'symbol',
                    source: 'sensors',
                    layout: {
                        'text-field': ['get', 'name'],
                        'text-size': 11,
                        'text-offset': [0, 1.5],
                        'text-anchor': 'top',
                        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold']
                    },
                    paint: {
                        'text-color': '#000000',
                        'text-halo-color': '#ffffff',
                        'text-halo-width': 2
                    }
                });

                // Add camera path line layer
                mapInstance.addLayer({
                    id: 'cameras-path',
                    type: 'line',
                    source: 'cameras',
                    paint: {
                        'line-width': [
                            'case',
                            ['get', 'isCrowded'], 8,
                            5
                        ],
                        'line-color': [
                            'case',
                            ['get', 'isCrowded'], '#ef4444', // Red when crowded
                            ['==', ['get', 'status'], 'active'], '#10b981', // Green when active
                            ['==', ['get', 'status'], 'error'], '#f59e0b', // Orange when error
                            '#6b7280' // Gray when inactive
                        ],
                        'line-opacity': 0.8
                    }
                });

                // Add camera start/end markers
                mapInstance.addLayer({
                    id: 'cameras-icon',
                    type: 'circle',
                    source: 'cameras',
                    paint: {
                        'circle-radius': 8,
                        'circle-color': [
                            'case',
                            ['get', 'isCrowded'], '#ef4444',
                            ['==', ['get', 'status'], 'active'], '#10b981',
                            ['==', ['get', 'status'], 'error'], '#f59e0b',
                            '#6b7280'
                        ],
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#ffffff',
                        'circle-opacity': 0.9
                    }
                });

                // Add camera label with count
                mapInstance.addLayer({
                    id: 'cameras-label',
                    type: 'symbol',
                    source: 'cameras',
                    layout: {
                        'text-field': [
                            'concat',
                            '📹 ',
                            ['get', 'name'],
                            '\n',
                            ['to-string', ['get', 'totalCount']],
                            '/',
                            ['to-string', ['get', 'threshold']],
                            ' vehicles',
                            ['case', ['get', 'isCrowded'], ' 🚨 CROWDED', '']
                        ],
                        'text-size': 11,
                        'text-offset': [0, 0.5],
                        'text-anchor': 'top',
                        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                        'symbol-placement': 'line-center'
                    },
                    paint: {
                        'text-color': ['case', ['get', 'isCrowded'], '#ef4444', '#000000'],
                        'text-halo-color': '#ffffff',
                        'text-halo-width': 2
                    }
                });

                // Add click handler for cameras (both path and icon)
                mapInstance.on('click', 'cameras-path', (e: any) => {
                    if (e.features && e.features.length > 0) {
                        const cameraId = e.features[0].properties.id;
                        const camera = cameras.find(c => c.id === cameraId);
                        if (camera) {
                            setSelectedCamera(camera);
                        }
                    }
                });

                mapInstance.on('click', 'cameras-icon', (e: any) => {
                    if (e.features && e.features.length > 0) {
                        const cameraId = e.features[0].properties.id;
                        const camera = cameras.find(c => c.id === cameraId);
                        if (camera) {
                            setSelectedCamera(camera);
                        }
                    }
                });

                // Change cursor on hover
                mapInstance.on('mouseenter', 'cameras-path', () => {
                    mapInstance.getCanvas().style.cursor = 'pointer';
                });
                mapInstance.on('mouseleave', 'cameras-path', () => {
                    mapInstance.getCanvas().style.cursor = '';
                });
                
                mapInstance.on('mouseenter', 'cameras-icon', () => {
                    mapInstance.getCanvas().style.cursor = 'pointer';
                });
                mapInstance.on('mouseleave', 'cameras-icon', () => {
                    mapInstance.getCanvas().style.cursor = '';
                });
            }

            // Add user reports layer
            mapInstance.addLayer({
                id: 'user-reports-circle',
                type: 'circle',
                source: 'user-reports',
                paint: {
                    'circle-radius': [
                        'case',
                        ['==', ['get', 'severity'], 'high'], 12,
                        ['==', ['get', 'severity'], 'medium'], 10,
                        8
                    ],
                    'circle-color': [
                        'case',
                        ['==', ['get', 'type'], 'flood'], '#3b82f6',
                        ['==', ['get', 'type'], 'outage'], '#ef4444',
                        '#6b7280'
                    ],
                    'circle-stroke-width': 3,
                    'circle-stroke-color': '#ffffff',
                    'circle-opacity': 0.85
                }
            });

            // Add pulse animation layer for high severity reports
            mapInstance.addLayer({
                id: 'user-reports-pulse',
                type: 'circle',
                source: 'user-reports',
                filter: ['==', ['get', 'severity'], 'high'],
                paint: {
                    'circle-radius': 20,
                    'circle-color': '#ef4444',
                    'circle-opacity': 0.3,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ef4444',
                    'circle-stroke-opacity': 0.5
                }
            });

            setMap(mapInstance);
        });

        return () => {
            mapInstance.remove();
        };
    }, [isMounted]);

    // Add hover interactions
    useEffect(() => {
        if (!map) return;

        const handleFloodHover = (e: any) => {
            map.getCanvas().style.cursor = 'pointer';
            if (e.features && e.features.length > 0) {
                const feature = e.features[0];
                const zone = zones.find(z => z.id === feature.properties.id);
                if (zone) {
                    // Clear any pending hide timeout
                    if (hoverTimeoutRef.current) {
                        clearTimeout(hoverTimeoutRef.current);
                        hoverTimeoutRef.current = null;
                    }
                    setHoveredZone(zone);
                    setPopupPosition({ x: e.point.x, y: e.point.y });
                }
            }
        };

        const handleOutageHover = (e: any) => {
            map.getCanvas().style.cursor = 'pointer';
            if (e.features && e.features.length > 0) {
                const feature = e.features[0];
                const zone = zones.find(z => z.id === feature.properties.id);
                if (zone) {
                    // Clear any pending hide timeout
                    if (hoverTimeoutRef.current) {
                        clearTimeout(hoverTimeoutRef.current);
                        hoverTimeoutRef.current = null;
                    }
                    setHoveredZone(zone);
                    setPopupPosition({ x: e.point.x, y: e.point.y });
                }
            }
        };

        const handleLineHover = (e: any) => {
            map.getCanvas().style.cursor = 'pointer';
            if (e.features && e.features.length > 0) {
                const feature = e.features[0];
                const zone = zones.find(z => z.id === feature.properties.id);
                if (zone) {
                    // Clear any pending hide timeout
                    if (hoverTimeoutRef.current) {
                        clearTimeout(hoverTimeoutRef.current);
                        hoverTimeoutRef.current = null;
                    }
                    setHoveredZone(zone);
                    setPopupPosition({ x: e.point.x, y: e.point.y });
                }
            }
        };

        const handleLeave = () => {
            map.getCanvas().style.cursor = '';
            // Delay hiding to allow mouse to move to popup
            hoverTimeoutRef.current = setTimeout(() => {
                setHoveredZone(null);
                setPopupPosition(null);
            }, 200);
        };

        map.on('mousemove', 'flood-zones', handleFloodHover);
        map.on('mousemove', 'outage-zones', handleOutageHover);
        map.on('mousemove', 'zones-lines', handleLineHover);
        map.on('mouseleave', 'flood-zones', handleLeave);
        map.on('mouseleave', 'outage-zones', handleLeave);
        map.on('mouseleave', 'zones-lines', handleLeave);

        return () => {
            map.off('mousemove', 'flood-zones', handleFloodHover);
            map.off('mousemove', 'outage-zones', handleOutageHover);
            map.off('mousemove', 'zones-lines', handleLineHover);
            map.off('mouseleave', 'flood-zones', handleLeave);
            map.off('mouseleave', 'outage-zones', handleLeave);
            map.off('mouseleave', 'zones-lines', handleLeave);
        };
    }, [map, zones]);

    // Add click handler for user reports
    useEffect(() => {
        if (!map) return;

        const handleReportClick = (e: any) => {
            if (!e.features || e.features.length === 0) return;
            
            const feature = e.features[0];
            const props = feature.properties;
            
            const popup = new (window as any).maplibregl.Popup({ offset: 25 })
                .setLngLat(feature.geometry.coordinates)
                .setHTML(`
                    <div class="p-3 min-w-[250px]">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-2xl">
                                ${props.type === 'flood' ? '🌊' : props.type === 'outage' ? '⚡' : '⚠️'}
                            </span>
                            <div class="flex-1">
                                <div class="font-bold text-gray-800">
                                    ${props.type === 'flood' ? 'Báo Cáo Lũ Lụt' : props.type === 'outage' ? 'Báo Cáo Mất Điện' : 'Báo Cáo Khác'}
                                </div>
                                <div class="text-xs text-gray-500">
                                    ${new Date(props.createdAt).toLocaleString('vi-VN')}
                                </div>
                            </div>
                        </div>
                        <div class="mb-2">
                            <span class="inline-block px-2 py-1 rounded-full text-xs font-bold ${
                                props.severity === 'high' 
                                    ? 'bg-red-100 text-red-700' 
                                    : props.severity === 'medium' 
                                    ? 'bg-orange-100 text-orange-700' 
                                    : 'bg-yellow-100 text-yellow-700'
                            }">
                                ${props.severity === 'high' ? '🔴 Nghiêm Trọng' : props.severity === 'medium' ? '🟠 Trung Bình' : '🟡 Nhẹ'}
                            </span>
                        </div>
                        <p class="text-sm text-gray-700 mb-2">${props.description}</p>
                        <div class="text-xs text-gray-500 border-t pt-2">
                            Người báo cáo: <strong>${props.reporterName}</strong>
                        </div>
                    </div>
                `)
                .addTo(map);
        };

        const handleReportHover = () => {
            map.getCanvas().style.cursor = 'pointer';
        };

        const handleReportLeave = () => {
            map.getCanvas().style.cursor = '';
        };

        map.on('click', 'user-reports-circle', handleReportClick);
        map.on('mouseenter', 'user-reports-circle', handleReportHover);
        map.on('mouseleave', 'user-reports-circle', handleReportLeave);

        return () => {
            map.off('click', 'user-reports-circle', handleReportClick);
            map.off('mouseenter', 'user-reports-circle', handleReportHover);
            map.off('mouseleave', 'user-reports-circle', handleReportLeave);
        };
    }, [map, userReports]);

    // Handle zone drawing and camera path drawing
    useEffect(() => {
        if (!map || (!isDrawing && !isDrawingCameraPath)) return;

        let centerPoint: number[] | null = drawingCenter;
        let currentRadius = drawingRadius;
        let linePoints: number[][] = isDrawingCameraPath ? [] : [...drawingPoints];

        const handleMapClick = (e: any) => {
            const { lng, lat } = e.lngLat;
            
            // Handle camera path selection (same pattern as zone line drawing)
            if (isDrawingCameraPath) {
                linePoints.push([lng, lat]);
                setCameraPathPoints(linePoints as [number, number][]);
                updateLineDrawingLayer(linePoints);
                return;
            }
            
            if (drawingShape === 'circle') {
                if (!centerPoint) {
                    // First click: set center
                    centerPoint = [lng, lat];
                    setDrawingCenter([lng, lat]);
                } else {
                    // Second click: finish circle
                    const finalRadius = currentRadius > 0 ? currentRadius : 100;
                    const newZone: Zone = {
                        id: `zone-${Date.now()}`,
                        type: drawingType!,
                        shape: 'circle',
                        center: centerPoint,
                        radius: finalRadius
                    };

                    saveZoneWithDialog(newZone);
                    cancelDrawing();
                }
            } else {
                // Line mode: add point
                linePoints.push([lng, lat]);
                setDrawingPoints(linePoints);
                updateLineDrawingLayer(linePoints);
            }
        };

        const handleMouseMove = (e: any) => {
            const { lng, lat } = e.lngLat;
            
            // Camera path preview (same as zone line)
            if (isDrawingCameraPath && linePoints.length > 0) {
                updateLineDrawingLayer([...linePoints, [lng, lat]]);
                return;
            }
            
            if (drawingShape === 'circle' && centerPoint) {
                const radius = calculateDistance(centerPoint, [lng, lat]);
                currentRadius = radius;
                setDrawingRadius(radius);
                updateDrawingLayer(centerPoint, radius);
            } else if (drawingShape === 'line' && linePoints.length > 0) {
                updateLineDrawingLayer([...linePoints, [lng, lat]]);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (isDrawingCameraPath) {
                    cancelCameraPathDrawing();
                } else {
                    cancelDrawing();
                }
            } else if (e.key === 'Enter') {
                if (isDrawingCameraPath && linePoints.length >= 2) {
                    // Finish camera path drawing - pass linePoints directly
                    if (cameraPathCallback) {
                        cameraPathCallback(linePoints as [number, number][]);
                    }
                    setIsDrawingCameraPath(false);
                    setCameraPathPoints([]);
                    setCameraPathCallback(null);
                    if (map) {
                        map.getCanvas().style.cursor = '';
                        map.dragRotate.enable();
                        map.touchZoomRotate.enableRotation();
                        if (map.getSource('drawing-temp')) {
                            (map.getSource('drawing-temp') as any).setData({
                                type: 'FeatureCollection',
                                features: []
                            });
                        }
                        if (map.getSource('drawing-markers')) {
                            (map.getSource('drawing-markers') as any).setData({
                                type: 'FeatureCollection',
                                features: []
                            });
                        }
                    }
                } else if (drawingShape === 'line' && linePoints.length >= 2) {
                    // Finish zone line drawing
                    const newZone: Zone = {
                        id: `zone-${Date.now()}`,
                        type: drawingType!,
                        shape: 'line',
                        coordinates: linePoints
                    };

                    saveZoneWithDialog(newZone);
                    cancelDrawing();
                }
            }
        };

        const handleDblClick = () => {
            if (drawingShape === 'line' && linePoints.length >= 2) {
                const newZone: Zone = {
                    id: `zone-${Date.now()}`,
                    type: drawingType!,
                    shape: 'line',
                    coordinates: linePoints
                };

                saveZoneWithDialog(newZone);
                cancelDrawing();
            }
        };

        map.on('click', handleMapClick);
        map.on('mousemove', handleMouseMove);
        map.on('dblclick', handleDblClick);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            map.off('click', handleMapClick);
            map.off('mousemove', handleMouseMove);
            map.off('dblclick', handleDblClick);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [map, isDrawing, isDrawingCameraPath, zones, drawingType, drawingShape]);

    const calculateDistance = (coord1: number[], coord2: number[]): number => {
        const R = 6371e3; // Earth radius in meters
        const φ1 = coord1[1] * Math.PI / 180;
        const φ2 = coord2[1] * Math.PI / 180;
        const Δφ = (coord2[1] - coord1[1]) * Math.PI / 180;
        const Δλ = (coord2[0] - coord1[0]) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    };

    const createCircleCoordinates = (center: number[], radius: number): number[][] => {
        const points = 64;
        const coords: number[][] = [];
        const distanceX = radius / (111320 * Math.cos(center[1] * Math.PI / 180));
        const distanceY = radius / 110540;

        for (let i = 0; i < points; i++) {
            const angle = (i / points) * 2 * Math.PI;
            const dx = distanceX * Math.cos(angle);
            const dy = distanceY * Math.sin(angle);
            coords.push([center[0] + dx, center[1] + dy]);
        }
        coords.push(coords[0]); // Close the circle
        return coords;
    };

    const updateDrawingLayer = (center: number[], radius: number) => {
        if (!map || !center) return;

        const circleCoords = createCircleCoordinates(center, radius);

        const source = map.getSource('drawing-temp') as any;
        if (source) {
            source.setData({
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    geometry: {
                        type: 'Polygon',
                        coordinates: [circleCoords]
                    },
                    properties: {}
                }]
            });
        } else {
            initDrawingLayers();
            updateDrawingLayer(center, radius);
        }

        // Update center marker
        const markerSource = map.getSource('drawing-markers') as any;
        if (markerSource) {
            markerSource.setData({
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: center
                    },
                    properties: {
                        label: '🎯 Tâm'
                    }
                }]
            });
        }
    };

    const updateLineDrawingLayer = (points: number[][]) => {
        if (!map || points.length === 0) return;

        const source = map.getSource('drawing-temp') as any;
        if (source) {
            source.setData({
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: points
                    },
                    properties: {}
                }]
            });
        } else {
            initDrawingLayers();
            updateLineDrawingLayer(points);
        }

        // Update point markers
        const markerSource = map.getSource('drawing-markers') as any;
        if (markerSource) {
            markerSource.setData({
                type: 'FeatureCollection',
                features: points.map((point, index) => ({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: point
                    },
                    properties: {
                        label: index === 0 ? '🟢 Bắt đầu' : index === points.length - 1 ? '🔴 Kết thúc' : `${index + 1}`
                    }
                }))
            });
        }
    };

    const initDrawingLayers = () => {
        if (!map || map.getSource('drawing-temp')) return;

        // Main drawing layer (lines/polygons)
        map.addSource('drawing-temp', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: []
            }
        });

        map.addLayer({
            id: 'drawing-temp-fill',
            type: 'fill',
            source: 'drawing-temp',
            paint: {
                'fill-color': drawingType === 'flood' ? '#3b82f6' : '#ef4444',
                'fill-opacity': 0.3
            }
        });

        map.addLayer({
            id: 'drawing-temp-line',
            type: 'line',
            source: 'drawing-temp',
            paint: {
                'line-color': drawingType === 'flood' ? '#2563eb' : '#dc2626',
                'line-width': 6,
                'line-opacity': 0.6,
                'line-dasharray': [2, 2]
            }
        });

        // Markers layer for points
        map.addSource('drawing-markers', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: []
            }
        });

        map.addLayer({
            id: 'drawing-markers-circle',
            type: 'circle',
            source: 'drawing-markers',
            paint: {
                'circle-radius': 8,
                'circle-color': '#ffffff',
                'circle-stroke-width': 3,
                'circle-stroke-color': drawingType === 'flood' ? '#2563eb' : '#dc2626',
                'circle-opacity': 1
            }
        });

        map.addLayer({
            id: 'drawing-markers-label',
            type: 'symbol',
            source: 'drawing-markers',
            layout: {
                'text-field': ['get', 'label'],
                'text-size': 12,
                'text-offset': [0, -1.5],
                'text-anchor': 'bottom'
            },
            paint: {
                'text-color': '#ffffff',
                'text-halo-color': drawingType === 'flood' ? '#2563eb' : '#dc2626',
                'text-halo-width': 2
            }
        });
    };

    const finishDrawing = () => {
        if (!drawingCenter) {
            alert('Vui lòng đặt điểm trung tâm trước');
            return;
        }
        
        const finalRadius = drawingRadius > 0 ? drawingRadius : 100; // Default 100m if no radius

        const newZone: Zone = {
            id: `zone-${Date.now()}`,
            type: drawingType!,
            shape: 'circle',
            center: drawingCenter,
            radius: finalRadius
        };

        setZones(prev => [...prev, newZone]);
        updateZonesOnMap([...zones, newZone]);
        cancelDrawing();
    };

    const cancelDrawing = () => {
        setIsDrawing(false);
        setDrawingType(null);
        setDrawingCenter(null);
        setDrawingRadius(0);
        setDrawingPoints([]);
        
        if (map && map.getSource('drawing-temp')) {
            map.removeLayer('drawing-temp-fill');
            map.removeLayer('drawing-temp-line');
            map.removeSource('drawing-temp');
        }
        
        if (map && map.getSource('drawing-markers')) {
            map.removeLayer('drawing-markers-circle');
            map.removeLayer('drawing-markers-label');
            map.removeSource('drawing-markers');
        }
    };

    const startCameraPathDrawing = (callback: (path: [number, number][]) => void) => {
        setIsDrawingCameraPath(true);
        setCameraPathPoints([]);
        setCameraPathCallback(() => callback);
        if (map) {
            map.getCanvas().style.cursor = 'crosshair';
            // Disable map rotation and pitch during drawing
            map.dragRotate.disable();
            map.touchZoomRotate.disableRotation();
        }
    };

    const completeCameraPathDrawing = () => {
        if (cameraPathPoints.length >= 2 && cameraPathCallback) {
            cameraPathCallback(cameraPathPoints);
        }
        setIsDrawingCameraPath(false);
        setCameraPathPoints([]);
        setCameraPathCallback(null);
        if (map) {
            map.getCanvas().style.cursor = '';
            // Re-enable map interactions
            map.dragRotate.enable();
            map.touchZoomRotate.enableRotation();
            // Clear drawing layers
            if (map.getSource('drawing-temp')) {
                (map.getSource('drawing-temp') as any).setData({
                    type: 'FeatureCollection',
                    features: []
                });
            }
            if (map.getSource('drawing-markers')) {
                (map.getSource('drawing-markers') as any).setData({
                    type: 'FeatureCollection',
                    features: []
                });
            }
        }
    };

    const cancelCameraPathDrawing = () => {
        setIsDrawingCameraPath(false);
        setCameraPathPoints([]);
        setCameraPathCallback(null);
        if (map) {
            map.getCanvas().style.cursor = '';
            // Re-enable map interactions
            map.dragRotate.enable();
            map.touchZoomRotate.enableRotation();
            // Clear drawing layers
            if (map.getSource('drawing-temp')) {
                (map.getSource('drawing-temp') as any).setData({
                    type: 'FeatureCollection',
                    features: []
                });
            }
            if (map.getSource('drawing-markers')) {
                (map.getSource('drawing-markers') as any).setData({
                    type: 'FeatureCollection',
                    features: []
                });
            }
        }
    };

    const updateZonesOnMap = (zonesData: Zone[]) => {
        if (!map) return;

        const features = zonesData.map(zone => {
            if (zone.shape === 'circle' && zone.center && zone.radius) {
                const circleCoords = createCircleCoordinates(zone.center, zone.radius);
                return {
                    type: 'Feature' as const,
                    geometry: {
                        type: 'Polygon' as const,
                        coordinates: [circleCoords]
                    },
                    properties: {
                        id: zone.id,
                        type: zone.type,
                        shape: zone.shape,
                        riskLevel: zone.riskLevel || 50,
                        title: zone.title || 'Chưa đặt tên',
                        description: zone.description || ''
                    }
                };
            } else if (zone.shape === 'line' && zone.coordinates) {
                return {
                    type: 'Feature' as const,
                    geometry: {
                        type: 'LineString' as const,
                        coordinates: zone.coordinates
                    },
                    properties: {
                        id: zone.id,
                        type: zone.type,
                        shape: zone.shape,
                        riskLevel: zone.riskLevel || 50,
                        title: zone.title || 'Chưa đặt tên',
                        description: zone.description || ''
                    }
                };
            }
            return null;
        }).filter(f => f !== null);

        const source = map.getSource('zones') as any;
        if (source) {
            source.setData({
                type: 'FeatureCollection',
                features
            });
        }
    };

    const updateSensorsOnMap = (sensorsData: Sensor[]) => {
        if (!map || !isAdmin) return;

        const features = sensorsData.map(sensor => ({
            type: 'Feature' as const,
            geometry: {
                type: 'Point' as const,
                coordinates: sensor.location
            },
            properties: {
                id: sensor.id,
                name: sensor.name,
                type: sensor.type,
                threshold: sensor.threshold,
                actionType: sensor.actionType
            }
        }));

        const source = map.getSource('sensors') as any;
        if (source) {
            source.setData({
                type: 'FeatureCollection',
                features
            });
        }
    };

    const updateUserReportsOnMap = (reportsData: UserReport[]) => {
        if (!map) return;

        const features = reportsData.map(report => ({
            type: 'Feature' as const,
            geometry: {
                type: 'Point' as const,
                coordinates: report.location
            },
            properties: {
                id: report.id,
                type: report.type,
                severity: report.severity,
                description: report.description,
                reporterName: report.reporterName || 'Ẩn danh',
                status: report.status,
                createdAt: report.createdAt
            }
        }));

        const source = map.getSource('user-reports') as any;
        if (source) {
            source.setData({
                type: 'FeatureCollection',
                features
            });
        }
    };

    const updateCamerasOnMap = (camerasData: any[]) => {
        if (!map || !isAdmin) return;

        const features = camerasData.map(camera => {
            const totalCount = camera.currentCounts?.total || 0;
            const isCrowded = totalCount >= camera.threshold;
            
            return {
                type: 'Feature' as const,
                geometry: {
                    type: 'LineString' as const,
                    coordinates: camera.path // Array of [lng, lat] points
                },
                properties: {
                    id: camera.id,
                    name: camera.name,
                    status: camera.status,
                    threshold: camera.threshold,
                    isCrowded,
                    totalCount,
                    carCount: camera.currentCounts?.car || 0,
                    motorcycleCount: camera.currentCounts?.motorcycle || 0,
                    lastUpdate: camera.stats?.lastUpdate || 0
                }
            };
        });

        const source = map.getSource('cameras') as any;
        if (source) {
            source.setData({
                type: 'FeatureCollection',
                features
            });
        }
    };

    const saveZoneWithDialog = (zone: Zone) => {
        setPendingZone(zone);
        setShowTitleDialog(true);
    };

    const confirmZoneSave = () => {
        if (!pendingZone) return;
        
        const zoneToSave = {
            ...pendingZone,
            title: zoneForm.title || 'Khu Vực Chưa Đặt Tên',
            description: zoneForm.description
        };

        fetch('/api/zones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(zoneToSave)
        }).then(() => {
            setZones(prev => [...prev, zoneToSave]);
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'zone_created',
                    zone: zoneToSave
                }));
            }
        }).catch(err => console.error('Failed to save zone:', err));

        setShowTitleDialog(false);
        setPendingZone(null);
        setZoneForm({ title: '', description: '' });
    };

    const cancelZoneSave = () => {
        setShowTitleDialog(false);
        setPendingZone(null);
        setZoneForm({ title: '', description: '' });
    };

    const handleDeleteZone = (zoneId: string) => {
        if (!confirm('Xóa khu vực này?')) return;
        
        fetch(`/api/zones/${zoneId}`, { method: 'DELETE' })
            .then(() => {
                setZones(prev => prev.filter(z => z.id !== zoneId));
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: 'zone_deleted',
                        zoneId
                    }));
                }
                setHoveredZone(null);
            })
            .catch(err => console.error('Failed to delete zone:', err));
    };

    const handleDrawZone = (type: 'flood' | 'outage', shape: 'circle' | 'line') => {
        if (isDrawing) {
            cancelDrawing();
        }
        setIsDrawing(true);
        setDrawingType(type);
        setDrawingShape(shape);
        setDrawingCenter(null);
        setDrawingRadius(0);
        setDrawingPoints([]);
    };

    const handleClearZones = () => {
        if (confirm('Bạn có chắc chắn muốn xóa tất cả các khu vực?')) {
            fetch('/api/zones', { method: 'DELETE' })
                .then(() => {
                    setZones([]);
                    updateZonesOnMap([]);
                    // Broadcast to WebSocket
                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify({
                            type: 'zones_cleared'
                        }));
                    }
                })
                .catch(err => console.error('Failed to clear zones:', err));
        }
    };

    // Update zones when they change
    useEffect(() => {
        if (map && zones.length > 0) {
            updateZonesOnMap(zones);
        }
    }, [zones, map]);

    if (!isMounted) {
        return <div style={{ width: '100vw', height: '100vh', backgroundColor: '#f0f0f0' }} />;
    }

    return (
        <>
            <div id="map" ref={mapContainerRef} style={{ width: '100vw', height: '100vh' }} />
            
            {/* Hover Popup */}
            {hoveredZone && popupPosition && (
                <div 
                    className="fixed z-50 bg-white rounded-lg shadow-xl p-4 min-w-64 max-w-sm pointer-events-auto"
                    style={{ 
                        left: `${popupPosition.x + 10}px`, 
                        top: `${popupPosition.y + 10}px` 
                    }}
                    onMouseEnter={() => {
                        // Clear timeout when mouse enters popup
                        if (hoverTimeoutRef.current) {
                            clearTimeout(hoverTimeoutRef.current);
                            hoverTimeoutRef.current = null;
                        }
                    }}
                    onMouseLeave={() => {
                        setHoveredZone(null);
                        setPopupPosition(null);
                    }}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                            <h3 className="font-bold text-lg mb-1">{hoveredZone.title || 'Untitled Zone'}</h3>
                            <p className="text-sm text-gray-600 mb-2">
                                <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                                    hoveredZone.type === 'flood' 
                                        ? 'bg-blue-100 text-blue-700' 
                                        : 'bg-red-100 text-red-700'
                                }`}>
                                    {hoveredZone.type === 'flood' ? '🌊 Flood Risk' : '⚡ Nguy Cơ Tắc Đường'}
                                </span>
                                <span className="ml-2 text-xs text-gray-500">
                                    {hoveredZone.shape === 'circle' ? '● Zone' : '━ Route'}
                                </span>
                            </p>
                            {hoveredZone.description && (
                                <p className="text-sm text-gray-700">{hoveredZone.description}</p>
                            )}
                        </div>
                    </div>
                    {isAdmin && (
                        <button
                            onClick={() => handleDeleteZone(hoveredZone.id)}
                            className="mt-3 w-full p-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                        >
                            Xóa Khu Vực
                        </button>
                    )}
                </div>
            )}

            {/* Title/Description Dialog */}
            {showTitleDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-96">
                        <h3 className="text-xl font-bold mb-4">Add Zone Details</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Title
                                </label>
                                <input
                                    type="text"
                                    value={zoneForm.title}
                                    onChange={(e) => setZoneForm({ ...zoneForm, title: e.target.value })}
                                    placeholder="e.g., Main Street Flood Zone"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description (optional)
                                </label>
                                <textarea
                                    value={zoneForm.description}
                                    onChange={(e) => setZoneForm({ ...zoneForm, description: e.target.value })}
                                    placeholder="Add details about this zone..."
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={confirmZoneSave}
                                className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                            >
                                Save Zone
                            </button>
                            <button
                                onClick={cancelZoneSave}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isAdmin && (
                <>
                    <AdminPanel 
                        map={map}
                        onDrawZone={handleDrawZone}
                        onClearZones={handleClearZones}
                        onStartCameraPathDrawing={startCameraPathDrawing}
                        onCompleteCameraPathDrawing={completeCameraPathDrawing}
                        onCancelCameraPathDrawing={cancelCameraPathDrawing}
                        onOpenCamera={(camera) => setSelectedCamera(camera)}
                    />
                    {(isDrawing || isDrawingCameraPath) && (
                        <div className="fixed top-4 right-4 z-50 space-y-3">
                            {/* Main instruction card */}
                            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 py-4 rounded-xl shadow-2xl border-2 border-yellow-300 animate-pulse">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                                        {isDrawingCameraPath ? '📹' : (drawingShape === 'circle' ? '⭕' : '📍')}
                                    </div>
                                    <div className="font-bold text-lg">
                                        {isDrawingCameraPath ? 'Chọn Đường Camera' : (drawingShape === 'circle' ? 'Vẽ Khu Vực Tròn' : 'Vẽ Tuyến Đường')}
                                    </div>
                                </div>
                                <div className="text-sm space-y-1 bg-white/10 rounded-lg p-3">
                                    {isDrawingCameraPath ? (
                                        <>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-lg">🖱️</span>
                                                <span>Click để thêm điểm</span>
                                                <span className="bg-white/20 rounded px-2 py-0.5 ml-auto">
                                                    {cameraPathPoints.length} điểm
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">✅</span>
                                                <span>Enter để hoàn thành (tối thiểu 2 điểm)</span>
                                            </div>
                                        </>
                                    ) : drawingShape === 'circle' ? (
                                        !drawingCenter ? (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg">🖱️</span>
                                                    <span className="font-semibold">Bước 1/2:</span>
                                                    <span>Click vào bản đồ để đặt tâm</span>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-lg">✅</span>
                                                    <span className="font-semibold">Bước 2/2:</span>
                                                    <span>Click lần nữa để hoàn thành</span>
                                                </div>
                                                <div className="bg-white/20 rounded px-2 py-1 text-center font-bold">
                                                    Bán kính: {Math.round(drawingRadius)}m
                                                </div>
                                            </>
                                        )
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-lg">🖱️</span>
                                                <span>Click để thêm điểm</span>
                                                <span className="bg-white/20 rounded px-2 py-0.5 ml-auto">
                                                    {drawingPoints.length} điểm
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">✅</span>
                                                <span>Double-click hoặc Enter để hoàn thành</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            
                            {/* Quick actions */}
                            <div className="bg-white rounded-lg shadow-xl p-3 space-y-2">
                                <div className="text-xs text-gray-600 font-semibold mb-2">Phím tắt:</div>
                                <div className="flex items-center gap-2 text-sm">
                                    <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">ESC</kbd>
                                    <span className="text-gray-700">Hủy bỏ</span>
                                </div>
                                {((drawingShape === 'line' && drawingPoints.length >= 2) || (isDrawingCameraPath && cameraPathPoints.length >= 2)) && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">Enter</kbd>
                                        <span className="text-gray-700">Hoàn thành</span>
                                    </div>
                                )}
                                <button
                                    onClick={isDrawingCameraPath ? cancelCameraPathDrawing : cancelDrawing}
                                    className="w-full mt-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition-colors"
                                >
                                    ❌ Hủy Vẽ
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {/* Crosshair cursor overlay */}
                    {(isDrawing || isDrawingCameraPath) && (
                        <style>{`
                            .mapboxgl-canvas-container.mapboxgl-interactive {
                                cursor: crosshair !important;
                            }
                        `}</style>
                    )}
                </>
            )}

            {/* User Report Button - Always visible for all users */}
            {!isAdmin && <UserReportButton map={map} />}

            {/* Weather Overlay - Only for non-admin users */}
            {!isAdmin && viewMode === 'weather' && map && (
                <WeatherPanel 
                    location={map.getCenter() ? [map.getCenter().lng, map.getCenter().lat] : undefined}
                    map={map}
                />
            )}

            {/* View Mode Switcher - Only for non-admin users */}
            {!isAdmin && (
                <div className="fixed top-4 right-4 z-50 flex gap-2">
                    <button
                        onClick={() => setViewMode('map')}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all shadow-lg ${
                            viewMode === 'map'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                        <FontAwesomeIcon icon={faMap} className="mr-2" />
                        Bản Đồ
                    </button>
                    <button
                        onClick={() => setViewMode('weather')}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all shadow-lg ${
                            viewMode === 'weather'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                        <FontAwesomeIcon icon={faCloudSun} className="mr-2" />
                        Thời Tiết
                    </button>
                </div>
            )}

            {/* Camera Viewer Modal */}
            {selectedCamera && (
                <CameraViewer
                    cameraId={selectedCamera.id}
                    cameraName={selectedCamera.name}
                    onClose={() => setSelectedCamera(null)}
                />
            )}
        </>
    );
}