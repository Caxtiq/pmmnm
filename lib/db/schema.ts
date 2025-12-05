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

// This file is kept for backward compatibility but no longer used
// Database operations now use MongoDB directly
// See lib/mongodb.ts and individual db/*.ts files

export default {
  zones: {
    read: () => [],
    write: () => {},
  },
  sensors: {
    read: () => [],
    write: () => {},
  },
  predictions: {
    read: () => [],
    write: () => {},
  },
};
