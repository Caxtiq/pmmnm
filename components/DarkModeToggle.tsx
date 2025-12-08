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

"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMoon, faSun } from "@fortawesome/free-solid-svg-icons";
import { useTheme } from "@/lib/themeContext";

export default function DarkModeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-4 bg-white dark:bg-gray-800 rounded-full shadow-2xl hover:shadow-xl transition-all border-2 border-gray-200 dark:border-gray-700"
      title={theme === "light" ? "Chế độ tối" : "Chế độ sáng"}
    >
      <FontAwesomeIcon
        icon={theme === "light" ? faMoon : faSun}
        className="text-xl text-gray-700 dark:text-yellow-400"
      />
    </button>
  );
}
