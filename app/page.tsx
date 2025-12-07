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

import { useState, useEffect } from 'react';
import Maps from '@/components/Maps/Maps';
import LoginForm from '@/components/LoginForm';
import NotificationCenter from '@/components/NotificationCenter';
import ScreenshotButton from '@/components/ScreenshotButton';
import ActivityFeed from '@/components/ActivityFeed';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSignOutAlt, faUser } from '@fortawesome/free-solid-svg-icons';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUser(data.user);
        }
      })
      .catch(err => console.error('Failed to get user:', err))
      .finally(() => setIsLoading(false));
  }, []);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-700">
        <div className="text-white text-2xl font-bold">Đang tải...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <>
      <Maps isAdmin={user.role === 'admin'} />
      
      {/* Top right controls */}
      {user.role === 'admin' && <ActivityFeed />}
      
      {/* Bottom right controls */}
      <div className="fixed bottom-4 right-4 z-40 flex gap-3">
        <ScreenshotButton />
        <NotificationCenter userId={user.id} />
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white p-4 rounded-full shadow-2xl transition-all hover:shadow-xl"
          title="Đăng xuất"
        >
          <FontAwesomeIcon icon={faSignOutAlt} size="lg" />
        </button>
        <button
          className={`${user.role === 'admin' ? 'bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-800' : 'bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800'} text-white p-4 rounded-full shadow-2xl transition-all hover:shadow-xl`}
          title={`${user.username} - ${user.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}`}
        >
          <FontAwesomeIcon icon={faUser} size="lg" />
        </button>
      </div>
    </>
  );
}
