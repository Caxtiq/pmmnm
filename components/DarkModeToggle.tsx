'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons';
import { useTheme } from '@/lib/themeContext';

export default function DarkModeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-4 bg-white dark:bg-gray-800 rounded-full shadow-2xl hover:shadow-xl transition-all border-2 border-gray-200 dark:border-gray-700"
      title={theme === 'light' ? 'Chế độ tối' : 'Chế độ sáng'}
    >
      <FontAwesomeIcon 
        icon={theme === 'light' ? faMoon : faSun} 
        className="text-xl text-gray-700 dark:text-yellow-400" 
      />
    </button>
  );
}
