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

export interface Sensor {
  id: string;
  name: string;
  location: [number, number]; // [lng, lat]
  type: "water_level" | "temperature" | "humidity";
  threshold: number;
  actionType: "flood" | "outage";
  actionTarget?: string; // zone/route ID to activate
  createdAt?: number;
}

export interface SensorRule {
  id: string;
  name: string;
  type: "1-sensor" | "2-sensor";
  sensors: string[]; // sensor IDs
  operator?: "AND" | "OR"; // for 2-sensor rules
  actionType: "flood" | "outage";
  actionShape: "circle" | "line";
  actionCoordinates?: number[][] | number[]; // for line or circle center
  actionRadius?: number; // for circle
  enabled: boolean;
  createdAt?: number;
}
