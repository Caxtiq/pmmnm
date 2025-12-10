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

import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTimes,
  faVideo,
  faVideoSlash,
  faSpinner,
  faCar,
  faMotorcycle,
  faTruck,
  faBus,
  faBicycle,
  faUser,
} from '@fortawesome/free-solid-svg-icons';

interface CameraViewerProps {
  cameraId: string;
  cameraName: string;
  onClose: () => void;
}

interface DetectionData {
  counts: {
    car: number;
    motorcycle: number;
    truck: number;
    bus: number;
    bicycle: number;
    person: number;
    total: number;
  };
  detections: Array<{
    class: string;
    confidence: number;
    bbox: [number, number, number, number];
    trackId: number;
  }>;
}

export default function CameraViewer({ cameraId, cameraName, onClose }: CameraViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectionData, setDetectionData] = useState<DetectionData | null>(null);

  useEffect(() => {
    connectToCamera();

    return () => {
      cleanup();
    };
  }, [cameraId]);

  // Draw detection overlays on canvas
  useEffect(() => {
    if (!detectionData || !canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Match canvas size to video
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw bounding boxes
    detectionData.detections.forEach((detection) => {
      const [x1, y1, x2, y2] = detection.bbox;
      const width = x2 - x1;
      const height = y2 - y1;

      // Color by class
      const colors: Record<string, string> = {
        car: '#3b82f6',
        motorcycle: '#f59e0b',
        truck: '#ef4444',
        bus: '#8b5cf6',
        bicycle: '#10b981',
        person: '#ec4899',
      };
      const color = colors[detection.class] || '#6b7280';

      // Draw box
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x1, y1, width, height);

      // Draw label
      ctx.fillStyle = color;
      ctx.fillRect(x1, y1 - 25, width, 25);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Arial';
      ctx.fillText(
        `${detection.class} ${(detection.confidence * 100).toFixed(0)}%`,
        x1 + 5,
        y1 - 7
      );
    });
  }, [detectionData]);

  async function connectToCamera() {
    try {
      setIsConnecting(true);
      setError(null);

      // Create WebSocket for signaling
      const ws = new WebSocket(`ws://localhost:3001/signaling?userId=${Math.random()}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Signaling connected');
        setupWebRTC();
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'camera-update' && data.cameraId === cameraId) {
          setDetectionData({
            counts: data.counts,
            detections: data.detections || [],
          });
        }

        if (data.type === 'answer' && pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
        }

        if (data.type === 'ice-candidate' && pcRef.current && data.candidate) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      };

      ws.onerror = () => {
        setError('Signaling connection failed');
        setIsConnecting(false);
      };

      ws.onclose = () => {
        console.log('Signaling disconnected');
        setIsConnected(false);
      };
    } catch (err) {
      console.error('Error connecting:', err);
      setError('Failed to connect to camera');
      setIsConnecting(false);
    }
  }

  async function setupWebRTC() {
    try {
      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      // Handle incoming video stream
      pc.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          setIsConnected(true);
          setIsConnecting(false);
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current) {
          wsRef.current.send(
            JSON.stringify({
              type: 'ice-candidate',
              cameraId,
              candidate: event.candidate,
            })
          );
        }
      };

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer to AI server via signaling
      if (wsRef.current) {
        wsRef.current.send(
          JSON.stringify({
            type: 'offer',
            cameraId,
            sdp: offer.sdp,
            peerId: Math.random().toString(),
          })
        );
      }
    } catch (err) {
      console.error('WebRTC setup error:', err);
      setError('Failed to setup video connection');
      setIsConnecting(false);
    }
  }

  function cleanup() {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }

  const getVehicleIcon = (type: string) => {
    const icons: Record<string, any> = {
      car: faCar,
      motorcycle: faMotorcycle,
      truck: faTruck,
      bus: faBus,
      bicycle: faBicycle,
      person: faUser,
    };
    return icons[type] || faCar;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FontAwesomeIcon icon={faVideo} />
              {cameraName}
            </h2>
            <p className="text-white/80 text-sm">Camera ID: {cameraId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Video Stream */}
          <div className="flex-1 bg-black relative">
            {isConnecting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <FontAwesomeIcon
                  icon={faSpinner}
                  className="text-white text-4xl mb-4 animate-spin"
                />
                <p className="text-white">Connecting to camera...</p>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <FontAwesomeIcon icon={faVideoSlash} className="text-red-500 text-4xl mb-4" />
                <p className="text-white mb-4">{error}</p>
                <button
                  onClick={connectToCamera}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
                >
                  Retry
                </button>
              </div>
            )}

            {!error && (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 w-full h-full pointer-events-none"
                />
              </>
            )}

            {/* Connection Status */}
            {isConnected && (
              <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                LIVE
              </div>
            )}
          </div>

          {/* Detection Stats */}
          <div className="w-80 bg-gray-50 dark:bg-gray-800 p-6 overflow-y-auto">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Phát Hiện Trực Tiếp</h3>

            {detectionData ? (
              <div className="space-y-3">
                {Object.entries(detectionData.counts).map(([type, count]) => (
                  <div
                    key={type}
                    className="flex items-center justify-between bg-white dark:bg-gray-700 p-3 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <FontAwesomeIcon
                        icon={getVehicleIcon(type)}
                        className="text-blue-600 dark:text-blue-400"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                        {type === 'total' ? 'Tổng' : type}
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                Đang chờ dữ liệu phát hiện...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
