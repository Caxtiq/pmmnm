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

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

/**
 * Convert degrees to radians
 */
function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Format distance for display
 * @param km Distance in kilometers
 * @returns Formatted string (e.g., "1.5 km" or "500 m")
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

/**
 * Get user's current location
 * @returns Promise with coordinates [longitude, latitude] or null if denied
 */
export function getCurrentLocation(): Promise<[number, number] | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve([position.coords.longitude, position.coords.latitude]);
      },
      (error) => {
        console.warn('Geolocation error:', error.message);
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 300000, // Cache for 5 minutes
      }
    );
  });
}

/**
 * Calculate distance from user's location to a point
 * @param userLocation User's coordinates [lon, lat]
 * @param targetLocation Target coordinates [lon, lat]
 * @returns Distance in kilometers or null if user location not available
 */
export function getDistanceFromUser(
  userLocation: [number, number] | null,
  targetLocation: [number, number]
): number | null {
  if (!userLocation) return null;
  
  return calculateDistance(
    userLocation[1],
    userLocation[0],
    targetLocation[1],
    targetLocation[0]
  );
}

/**
 * Sort items by distance from user location (nearest first)
 */
export function sortByDistance<T extends { location: [number, number] }>(
  items: T[],
  userLocation: [number, number] | null
): T[] {
  if (!userLocation) return items;

  return [...items].sort((a, b) => {
    const distA = getDistanceFromUser(userLocation, a.location);
    const distB = getDistanceFromUser(userLocation, b.location);
    
    if (distA === null) return 1;
    if (distB === null) return -1;
    
    return distA - distB;
  });
}
