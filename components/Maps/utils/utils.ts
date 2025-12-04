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

export const calculateDistance = (
  coord1: number[],
  coord2: number[],
): number => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (coord1[1] * Math.PI) / 180;
  const φ2 = (coord2[1] * Math.PI) / 180;
  const Δφ = ((coord2[1] - coord1[1]) * Math.PI) / 180;
  const Δλ = ((coord2[0] - coord1[0]) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export const createCircleCoordinates = (
  center: number[],
  radius: number,
): number[][] => {
  const points = 64;
  const coords: number[][] = [];
  const distanceX = radius / (111320 * Math.cos((center[1] * Math.PI) / 180));
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
