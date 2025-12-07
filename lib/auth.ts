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

import { cookies } from 'next/headers';
import { findUserByUsername, findUserById, createUser, sanitizeUser, type SafeUser, ensureUserIndexes } from './db/users';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;
const SESSION_COOKIE = 'session';

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

export async function register(username: string, password: string, role: 'admin' | 'user' = 'user'): Promise<SafeUser | { error: string }> {
  try {
    if (!username || username.length < 3) {
      return { error: 'Tên đăng nhập phải có ít nhất 3 ký tự' };
    }
    
    if (!password || password.length < 6) {
      return { error: 'Mật khẩu phải có ít nhất 6 ký tự' };
    }

    await ensureUserIndexes();

    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      return { error: 'Tên đăng nhập đã tồn tại' };
    }

    const hashedPassword = await hashPassword(password);
    const userId = await createUser({
      username,
      password: hashedPassword,
      role,
    });

    const user = await findUserById(userId);
    if (!user) {
      return { error: 'Không thể tạo người dùng' };
    }

    return sanitizeUser(user);
  } catch (error) {
    console.error('Registration error:', error);
    return { error: 'Lỗi hệ thống, vui lòng thử lại' };
  }
}

export async function login(username: string, password: string): Promise<SafeUser | null> {
  try {
    const user = await findUserByUsername(username);
    
    if (!user) {
      return null;
    }

    const isValid = await verifyPassword(password, user.password);
    
    if (!isValid) {
      return null;
    }

    return sanitizeUser(user);
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE);
    
    if (!sessionCookie?.value) {
      return null;
    }

    const userId = sessionCookie.value;
    const user = await findUserById(userId);
    
    if (!user) {
      return null;
    }

    return sanitizeUser(user);
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

export async function setSession(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
