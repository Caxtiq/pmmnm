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
import SearchBox from './SearchBox';
import RoutePanel from './RoutePanel';
import AICrawlerButton from './AICrawlerButton';
import CommunityFeed from './CommunityFeed';
import LayerControls from '../LayerControls';
import CameraViewer from '../CameraViewer';
import AITrafficAlerts from '../AITrafficAlerts';
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
    const routeClickHandlerRef = useRef<((e: any) => void) | null>(null);
    const [cameras, setCameras] = useState<any[]>([]);
    const [selectedCamera, setSelectedCamera] = useState<any | null>(null);
    const [isDrawingCameraPath, setIsDrawingCameraPath] = useState(false);
    const [cameraPathPoints, setCameraPathPoints] = useState<[number, number][]>([]);
    const [cameraPathCallback, setCameraPathCallback] = useState<((path: [number, number][]) => void) | null>(null);
    const [showAITrafficAlerts, setShowAITrafficAlerts] = useState(false);
    const [layerVisibility, setLayerVisibility] = useState({
        floodZones: true,
        outageZones: true,
        userReports: true,
        safeZones: true,
        routes: true,
        heatmap: false,
    });
    const [heatmapTimeFilter, setHeatmapTimeFilter] = useState<'24h' | '7d' | '30d' | 'all'>('7d');

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Handle layer visibility changes
    const handleToggleLayer = (layer: string, visible: boolean) => {
        if (!map) return;

        const layerMap: Record<string, string[]> = {
            floodZones: ['flood-zones', 'zones-outline'],
            outageZones: ['outage-zones', 'zones-outline'],
            userReports: ['user-reports-circle', 'user-reports-pulse'],
            safeZones: ['safe-zones-circle', 'safe-zones-pulse', 'safe-zones-label'],
            routes: ['zones-lines', 'route-line', 'route-outline'],
            heatmap: ['heatmap-layer'],
        };

        const layers = layerMap[layer] || [];
        layers.forEach(layerId => {
            if (map.getLayer(layerId)) {
                map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
            }
        });

        // Update heatmap data when toggling
        if (layer === 'heatmap' && visible) {
            updateHeatmapData();
        }
    };

    // Update heatmap based on time filter
    const updateHeatmapData = () => {
        if (!map || !map.getSource('heatmap-source')) return;

        const now = Date.now();
        const timeFilterMs: Record<typeof heatmapTimeFilter, number> = {
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
            '30d': 30 * 24 * 60 * 60 * 1000,
            'all': Infinity,
        };

        const cutoffTime = now - timeFilterMs[heatmapTimeFilter];
        const filteredReports = userReports.filter(report => report.createdAt >= cutoffTime);

        // Create heatmap features with weight based on severity
        const features = filteredReports.map(report => {
            const weight = report.severity === 'high' ? 3 : report.severity === 'medium' ? 2 : 1;
            return {
                type: 'Feature' as const,
                geometry: {
                    type: 'Point' as const,
                    coordinates: report.location
                },
                properties: {
                    weight
                }
            };
        });

        const source = map.getSource('heatmap-source') as any;
        if (source) {
            source.setData({
                type: 'FeatureCollection',
                features
            });
        }
    };

    // Function to fetch zones from API
    const fetchZones = () => {
        fetch('/api/zones')
            .then(res => res.json())
            .then(data => {
                if (data.zones) {
                    setZones(data.zones);
                }
            })
            .catch(err => console.error('Failed to load zones:', err));
    };

    // Load safe zones on map
    useEffect(() => {
        if (!map) return;

        import('@/lib/safeZones').then(({ safeZones }) => {
            const features = safeZones.map(zone => ({
                type: 'Feature' as const,
                geometry: {
                    type: 'Point' as const,
                    coordinates: zone.location
                },
                properties: {
                    id: zone.id,
                    name: zone.name,
                    type: zone.type,
                    address: zone.address,
                    capacity: zone.capacity,
                    phone: zone.phone
                }
            }));

            const source = map.getSource('safe-zones');
            if (source) {
                (source as any).setData({
                    type: 'FeatureCollection',
                    features
                });
            }
        });
    }, [map]);

    // Load zones, sensors, and user reports from database on mount
    useEffect(() => {
        fetchZones();
        
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
                    if (data.cameras) {
                        setCameras(data.cameras);
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

    // Update heatmap when reports or time filter changes
    useEffect(() => {
        if (map && map.getSource('heatmap-source')) {
            updateHeatmapData();
        }
    }, [userReports, heatmapTimeFilter, map]);

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
            }

            // Add source for user reports
            mapInstance.addSource('user-reports', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: []
                }
            });

            // Add source for safe zones
            mapInstance.addSource('safe-zones', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: []
                }
            });

            // Add source for heatmap
            mapInstance.addSource('heatmap-source', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: []
                }
            });

            // Add source for cameras (admin only)
            if (isAdmin) {
                // Camera lines (paths)
                mapInstance.addSource('camera-lines', {
                    type: 'geojson',
                    data: {
                        type: 'FeatureCollection',
                        features: []
                    }
                });
                
                // Camera points (first point of path)
                mapInstance.addSource('cameras', {
                    type: 'geojson',
                    data: {
                        type: 'FeatureCollection',
                        features: []
                    }
                });
            }

            // Add heatmap layer (hidden by default)
            mapInstance.addLayer({
                id: 'heatmap-layer',
                type: 'heatmap',
                source: 'heatmap-source',
                layout: {
                    visibility: 'none'
                },
                paint: {
                    // Increase weight as diameter increases
                    'heatmap-weight': [
                        'interpolate',
                        ['linear'],
                        ['get', 'weight'],
                        0, 0,
                        6, 1
                    ],
                    // Increase intensity as zoom level increases
                    'heatmap-intensity': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        0, 1,
                        15, 3
                    ],
                    // Color ramp for heatmap - blue to red
                    'heatmap-color': [
                        'interpolate',
                        ['linear'],
                        ['heatmap-density'],
                        0, 'rgba(33,102,172,0)',
                        0.2, 'rgb(103,169,207)',
                        0.4, 'rgb(209,229,240)',
                        0.6, 'rgb(253,219,199)',
                        0.8, 'rgb(239,138,98)',
                        1, 'rgb(178,24,43)'
                    ],
                    // Adjust the heatmap radius by zoom level
                    'heatmap-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        0, 2,
                        15, 20
                    ],
                    // Transition from heatmap to circle layer by zoom level
                    'heatmap-opacity': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        7, 1,
                        15, 0.5
                    ]
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
            }

            // User reports line layer removed - lines only show when selected in community feed

            // Add user reports circle layer (for point reports and line endpoints)
            mapInstance.addLayer({
                id: 'user-reports-circle',
                type: 'circle',
                source: 'user-reports',
                filter: ['!=', ['get', 'isLine'], true],
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
                filter: ['all', ['!=', ['get', 'isLine'], true], ['==', ['get', 'severity'], 'high']],
                paint: {
                    'circle-radius': 20,
                    'circle-color': '#ef4444',
                    'circle-opacity': 0.3,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ef4444',
                    'circle-stroke-opacity': 0.5
                }
            });

            // Add safe zones layer
            mapInstance.addLayer({
                id: 'safe-zones-circle',
                type: 'circle',
                source: 'safe-zones',
                paint: {
                    'circle-radius': 12,
                    'circle-color': [
                        'match',
                        ['get', 'type'],
                        'hospital', '#ef4444',
                        'shelter', '#3b82f6',
                        'high_ground', '#10b981',
                        'government', '#8b5cf6',
                        '#6b7280'
                    ],
                    'circle-stroke-width': 3,
                    'circle-stroke-color': '#ffffff',
                    'circle-opacity': 0.8
                }
            });

            // Add safe zones pulse
            mapInstance.addLayer({
                id: 'safe-zones-pulse',
                type: 'circle',
                source: 'safe-zones',
                paint: {
                    'circle-radius': 24,
                    'circle-color': [
                        'match',
                        ['get', 'type'],
                        'hospital', '#ef4444',
                        'shelter', '#3b82f6',
                        'high_ground', '#10b981',
                        'government', '#8b5cf6',
                        '#6b7280'
                    ],
                    'circle-opacity': 0.2
                }
            });

            // Add safe zones label
            mapInstance.addLayer({
                id: 'safe-zones-label',
                type: 'symbol',
                source: 'safe-zones',
                layout: {
                    'text-field': ['get', 'name'],
                    'text-size': 12,
                    'text-offset': [0, 1.8],
                    'text-anchor': 'top',
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold']
                },
                paint: {
                    'text-color': '#000000',
                    'text-halo-color': '#ffffff',
                    'text-halo-width': 2
                }
            });

            // Add camera layers for admin
            if (isAdmin) {
                // Camera path lines
                mapInstance.addLayer({
                    id: 'camera-lines',
                    type: 'line',
                    source: 'camera-lines',
                    paint: {
                        'line-color': '#8b5cf6',
                        'line-width': 3,
                        'line-opacity': 0.8
                    }
                });

                mapInstance.addLayer({
                    id: 'cameras-circle',
                    type: 'circle',
                    source: 'cameras',
                    paint: {
                        'circle-radius': 10,
                        'circle-color': '#8b5cf6',
                        'circle-stroke-width': 3,
                        'circle-stroke-color': '#ffffff',
                        'circle-opacity': 0.9
                    }
                });

                mapInstance.addLayer({
                    id: 'cameras-label',
                    type: 'symbol',
                    source: 'cameras',
                    layout: {
                        'text-field': ['get', 'name'],
                        'text-size': 11,
                        'text-offset': [0, 1.5],
                        'text-anchor': 'top',
                        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold']
                    },
                    paint: {
                        'text-color': '#8b5cf6',
                        'text-halo-color': '#ffffff',
                        'text-halo-width': 2
                    }
                });
            }

            setMap(mapInstance);
        });

        return () => {
            mapInstance.remove();
        };
    }, [isMounted, isAdmin]);

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

        const handleSafeZoneClick = (e: any) => {
            if (!e.features || e.features.length === 0) return;
            const feature = e.features[0];
            const props = feature.properties;
            
            const popup = new vietmapgl.Popup({ offset: 25, closeButton: true, closeOnClick: false })
                .setLngLat(e.lngLat)
                .setHTML(`
                    <div style="min-width: 200px;">
                        <h3 style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">${props.name}</h3>
                        <p style="margin: 4px 0; font-size: 12px; color: #4b5563;"><strong>Loại:</strong> ${
                            props.type === 'hospital' ? '🏥 Bệnh viện' :
                            props.type === 'shelter' ? '🏢 Nơi trú ẩn' :
                            props.type === 'high_ground' ? '⛰️ Vị trí cao' :
                            props.type === 'government' ? '🏛️ Cơ quan chính phủ' : 'Khác'
                        }</p>
                        <p style="margin: 4px 0; font-size: 12px; color: #4b5563;"><strong>Địa chỉ:</strong> ${props.address}</p>
                        ${props.capacity ? `<p style="margin: 4px 0; font-size: 12px; color: #4b5563;"><strong>Sức chứa:</strong> ${props.capacity} người</p>` : ''}
                        ${props.phone ? `<p style="margin: 4px 0; font-size: 12px; color: #4b5563;"><strong>Điện thoại:</strong> ${props.phone}</p>` : ''}
                    </div>
                `)
                .addTo(map);
        };

        map.on('mousemove', 'flood-zones', handleFloodHover);
        map.on('mousemove', 'outage-zones', handleOutageHover);
        map.on('mousemove', 'zones-lines', handleLineHover);
        map.on('mouseleave', 'flood-zones', handleLeave);
        map.on('mouseleave', 'outage-zones', handleLeave);
        map.on('mouseleave', 'zones-lines', handleLeave);
        map.on('click', 'safe-zones-circle', handleSafeZoneClick);
        map.on('mouseenter', 'safe-zones-circle', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'safe-zones-circle', () => { map.getCanvas().style.cursor = ''; });

        return () => {
            map.off('mousemove', 'flood-zones', handleFloodHover);
            map.off('mousemove', 'outage-zones', handleOutageHover);
            map.off('mousemove', 'zones-lines', handleLineHover);
            map.off('mouseleave', 'flood-zones', handleLeave);
            map.off('mouseleave', 'outage-zones', handleLeave);
            map.off('mouseleave', 'zones-lines', handleLeave);
            map.off('click', 'safe-zones-circle', handleSafeZoneClick);
            map.off('mouseenter', 'safe-zones-circle', () => { map.getCanvas().style.cursor = 'pointer'; });
            map.off('mouseleave', 'safe-zones-circle', () => { map.getCanvas().style.cursor = ''; });
        };
    }, [map, zones]);

    // Add click handler for user reports
    useEffect(() => {
        if (!map) return;

        const handleReportClick = (e: any) => {
            if (!e.features || e.features.length === 0) return;
            
            const feature = e.features[0];
            const props = feature.properties;
            
            const popup = new vietmapgl.Popup({ offset: 25, closeButton: true, closeOnClick: false })
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

        // Add camera click handlers for admin
        if (isAdmin) {
            let cameraPopup: any = null;

            const handleCameraClick = (e: any) => {
                if (!e.features || e.features.length === 0) return;
                const feature = e.features[0];
                const cameraId = feature.properties.id;
                const camera = cameras.find(c => c.id === cameraId);
                if (camera) {
                    setSelectedCamera(camera);
                }
            };

            const handleCameraHover = (e: any) => {
                if (!e.features || e.features.length === 0) return;
                map.getCanvas().style.cursor = 'pointer';
                
                const feature = e.features[0];
                const props = feature.properties;
                
                // Remove existing popup if any
                if (cameraPopup) {
                    cameraPopup.remove();
                }
                
                // Create a global function to open camera viewer
                (window as any).openCameraViewer = (cameraId: string) => {
                    const camera = cameras.find(c => c.id === cameraId);
                    if (camera) {
                        setSelectedCamera(camera);
                    }
                };
                
                cameraPopup = new vietmapgl.Popup({ 
                    offset: 25, 
                    closeButton: false, 
                    closeOnClick: false 
                })
                    .setLngLat(e.lngLat)
                    .setHTML(`
                        <div style="min-width: 180px;">
                            <h3 style="font-weight: bold; font-size: 14px; margin-bottom: 8px;">📹 ${props.name}</h3>
                            <button 
                                onclick="window.openCameraViewer('${props.id}')"
                                style="
                                    width: 100%;
                                    padding: 6px 12px;
                                    background-color: #8b5cf6;
                                    color: white;
                                    border: none;
                                    border-radius: 6px;
                                    font-size: 12px;
                                    font-weight: 600;
                                    cursor: pointer;
                                    transition: background-color 0.2s;
                                "
                                onmouseover="this.style.backgroundColor='#7c3aed'"
                                onmouseout="this.style.backgroundColor='#8b5cf6'"
                            >
                                👁️ Xem Camera
                            </button>
                        </div>
                    `)
                    .addTo(map);
            };

            const handleCameraLeave = () => {
                map.getCanvas().style.cursor = '';
                if (cameraPopup) {
                    cameraPopup.remove();
                    cameraPopup = null;
                }
            };

            map.on('click', 'cameras-circle', handleCameraClick);
            map.on('mouseenter', 'cameras-circle', handleCameraHover);
            map.on('mouseleave', 'cameras-circle', handleCameraLeave);
        }

        return () => {
            map.off('click', 'user-reports-circle', handleReportClick);
            map.off('mouseenter', 'user-reports-circle', handleReportHover);
            map.off('mouseleave', 'user-reports-circle', handleReportLeave);

            if (isAdmin) {
                map.off('click', 'cameras-circle', () => {});
                map.off('mouseenter', 'cameras-circle', () => {});
                map.off('mouseleave', 'cameras-circle', () => {});
            }
        };
    }, [map, userReports, isAdmin, cameras, setSelectedCamera]);

    // Handle route point selection
    useEffect(() => {
        if (!map) return;

        const handleClick = (e: any) => {
            if (routeClickHandlerRef.current) {
                routeClickHandlerRef.current(e);
            }
        };

        map.on('click', handleClick);

        return () => {
            map.off('click', handleClick);
        };
    }, [map]);

    // Handle zone drawing and camera path drawing
    useEffect(() => {
        if (!map || (!isDrawing && !isDrawingCameraPath)) return;
        if (isDrawing && routeClickHandlerRef.current) return;

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
                        map.dragPan.enable();
                    }
                } else if (drawingShape === 'line' && linePoints.length >= 2) {
                    // Finish line drawing
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

        map.addSource('drawing-temp', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: []
            }
        });

        map.addSource('drawing-markers', {
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

        // Add marker circles
        map.addLayer({
            id: 'drawing-markers-circle',
            type: 'circle',
            source: 'drawing-markers',
            paint: {
                'circle-radius': 8,
                'circle-color': '#ffffff',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#000000'
            }
        });

        // Add marker labels
        map.addLayer({
            id: 'drawing-markers-label',
            type: 'symbol',
            source: 'drawing-markers',
            layout: {
                'text-field': ['get', 'label'],
                'text-size': 12,
                'text-offset': [0, -1.5],
                'text-anchor': 'top'
            },
            paint: {
                'text-color': '#000000',
                'text-halo-color': '#ffffff',
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

    const updateCamerasOnMap = (camerasData: any[]) => {
        if (!map || !isAdmin) return;

        // Create features for camera paths (lines)
        const lineFeatures = camerasData.map(camera => ({
            type: 'Feature' as const,
            geometry: {
                type: 'LineString' as const,
                coordinates: camera.path // Array of [lng, lat] points
            },
            properties: {
                id: camera.id,
                name: camera.name,
                status: camera.status || 'offline',
                streamUrl: camera.streamUrl
            }
        }));

        // Create features for camera markers (first point of path)
        const pointFeatures = camerasData.map(camera => ({
            type: 'Feature' as const,
            geometry: {
                type: 'Point' as const,
                coordinates: camera.path[0] // First point of the path
            },
            properties: {
                id: camera.id,
                name: camera.name,
                status: camera.status || 'offline',
                streamUrl: camera.streamUrl
            }
        }));

        // Update camera lines
        const lineSource = map.getSource('camera-lines') as any;
        if (lineSource) {
            lineSource.setData({
                type: 'FeatureCollection',
                features: lineFeatures
            });
        }

        // Update camera points
        const pointSource = map.getSource('cameras') as any;
        if (pointSource) {
            pointSource.setData({
                type: 'FeatureCollection',
                features: pointFeatures
            });
        }
    };

    const updateUserReportsOnMap = (reportsData: UserReport[]) => {
        if (!map) return;

        const features = reportsData.flatMap(report => {
            const props = {
                id: report.id,
                type: report.type,
                severity: report.severity,
                description: report.description,
                reporterName: report.reporterName || 'Ẩn danh',
                status: report.status,
                createdAt: report.createdAt
            };

            // Check if report has multiple coordinates (line report)
            if ((report as any).coordinates && (report as any).coordinates.length > 1) {
                // Line reports don't show on map by default - only when selected in community feed
                return [];
            }

            // Single point report
            return [{
                type: 'Feature' as const,
                geometry: {
                    type: 'Point' as const,
                    coordinates: report.location
                },
                properties: props
            }];
        });

        const source = map.getSource('user-reports') as any;
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

    const handleSelectLocation = async (refId: string, display: string) => {
        try {
            const apiKey = process.env.NEXT_PUBLIC_VIETMAP_API_KEY;
            const response = await fetch(`https://maps.vietmap.vn/api/place/v4?apikey=${apiKey}&refid=${encodeURIComponent(refId)}`);
            const data = await response.json();
            
            if (data && data.lat && data.lng) {
                // Smooth animated transition to location
                map?.flyTo({
                    center: [data.lng, data.lat],
                    zoom: 16,
                    duration: 2500, // Increased duration for smoother feel
                    essential: true, // Animation will complete even if user interacts
                    easing: (t) => t * (2 - t) // Ease-out quadratic for smooth deceleration
                });
                
                // Create popup HTML with navigation button
                const popupContent = `
                    <div class="p-3">
                        <strong class="text-sm block mb-3">${display}</strong>
                        <button 
                            onclick="window.navigateToLocation(${data.lng}, ${data.lat}, '${display.replace(/'/g, "\\'")}')"
                            class="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576 6.636 10.07Zm6.787-8.201L1.591 6.602l4.339 2.76 7.494-7.493Z"/>
                            </svg>
                            Đi
                        </button>
                    </div>
                `;
                
                // Set up global navigation function
                (window as any).navigateToLocation = (lng: number, lat: number, locationName: string) => {
                    // Dispatch event to open RoutePanel with destination
                    window.dispatchEvent(new CustomEvent('openRoutePanel', {
                        detail: {
                            destination: [lng, lat],
                            destinationName: locationName
                        }
                    }));
                };
                
                // Add a temporary marker with navigation popup
                const marker = new vietmapgl.Marker({ color: '#3b82f6' })
                    .setLngLat([data.lng, data.lat])
                    .setPopup(
                        new vietmapgl.Popup({ 
                            offset: 25, 
                            closeButton: true, 
                            closeOnClick: false,
                            maxWidth: '280px'
                        })
                            .setHTML(popupContent)
                    )
                    .addTo(map!);
                
                // Open popup after a brief delay for better UX
                setTimeout(() => {
                    marker.togglePopup();
                }, 2600);
            }
        } catch (error) {
            console.error('Failed to get place details:', error);
        }
    };

    const startCameraPathDrawing = (callback: (path: [number, number][]) => void) => {
        setIsDrawingCameraPath(true);
        setCameraPathPoints([]);
        setCameraPathCallback(() => callback);
        if (map) {
            map.getCanvas().style.cursor = 'crosshair';
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
        }
    };

    const cancelCameraPathDrawing = () => {
        setIsDrawingCameraPath(false);
        setCameraPathPoints([]);
        setCameraPathCallback(null);
        if (map) {
            map.getCanvas().style.cursor = '';
        }
    };

    if (!isMounted) {
        return <div style={{ width: '100vw', height: '100vh', backgroundColor: '#f0f0f0' }} />;
    }

    return (
        <>
            <div id="map" ref={mapContainerRef} style={{ width: '100vw', height: '100vh' }} />
            
            {/* Search Box - Top center for all users */}
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-30">
                <SearchBox 
                    onSelectLocation={handleSelectLocation}
                    mapCenter={map ? [map.getCenter().lng, map.getCenter().lat] : undefined}
                />
            </div>
            
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
                    <div className="fixed top-4 right-4 z-[60]">
                        <AICrawlerButton onClick={() => setShowAITrafficAlerts(true)} />
                    </div>
                    {showAITrafficAlerts && (
                        <AITrafficAlerts
                            onClose={() => setShowAITrafficAlerts(false)}
                            onIssueClick={(issue) => {
                                if (issue.coordinates && issue.coordinates.length > 0) {
                                    const bounds = new vietmapgl.LngLatBounds();
                                    issue.coordinates.forEach(coord => bounds.extend(coord as [number, number]));
                                    map?.fitBounds(bounds, { padding: 50 });
                                }
                            }}
                        />
                    )}
                    {(isDrawing || isDrawingCameraPath) && (
                        <div className="fixed top-20 right-4 z-50 space-y-3">
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
                                                    {cameraPathPoints.length === 0 ? 'Bắt đầu' : `${cameraPathPoints.length} điểm`}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">⌨️</span>
                                                <span>Nhấn Enter để hoàn thành</span>
                                            </div>
                                        </>
                                    ) : drawingShape === 'circle' ? (
                                        <>
                                            <div>🖱️ {!drawingCenter ? 'Click để đặt tâm' : `Bán kính: ${Math.round(drawingRadius)}m`}</div>
                                            <div>🖱️ {!drawingCenter ? '' : 'Click lần nữa để hoàn thành'}</div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">🖱️</span>
                                                <span>Click để thêm điểm</span>
                                                <span className="bg-white/20 rounded px-2 py-0.5 ml-auto">
                                                    {drawingPoints.length} điểm
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">🖱️</span>
                                                <span>Double-click hoặc Enter để hoàn thành</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="mt-3 pt-3 border-t border-white/20 space-y-2">
                                    <div className="text-xs text-white/80 font-semibold mb-2">Phím tắt:</div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <kbd className="px-2 py-1 bg-white/20 border border-white/30 rounded text-xs font-mono">ESC</kbd>
                                        <span>Hủy bỏ</span>
                                    </div>
                                    {((drawingShape === 'line' && drawingPoints.length >= 2) || (isDrawingCameraPath && cameraPathPoints.length >= 2)) && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <kbd className="px-2 py-1 bg-white/20 border border-white/30 rounded text-xs font-mono">Enter</kbd>
                                            <span>Hoàn thành</span>
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={isDrawingCameraPath ? cancelCameraPathDrawing : cancelDrawing}
                                    className="w-full mt-3 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition-colors"
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

            {/* Community Feed - Always visible on left for non-admin users */}
            {!isAdmin && <CommunityFeed map={map} />}
            
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
                <div className="fixed top-4 left-4 z-40 flex gap-2">
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

            {/* Layer Controls */}
            <LayerControls 
                onToggleLayer={handleToggleLayer}
                heatmapTimeFilter={heatmapTimeFilter}
                onHeatmapTimeFilterChange={setHeatmapTimeFilter}
            />

            {/* Route Panel - Available for all users */}
            {!isAdmin && <RoutePanel map={map} zones={zones} onMapClick={(handler) => { routeClickHandlerRef.current = handler; }} />}

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