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

import { NextResponse } from 'next/server';
import { register } from '@/lib/auth';
import { findUserByUsername } from '@/lib/db/users';

export async function POST() {
  try {
    const existingAdmin = await findUserByUsername('admin');
    
    if (existingAdmin) {
      return NextResponse.json(
        { message: 'Admin đã tồn tại' },
        { status: 400 }
      );
    }

    const result = await register('admin', 'admin123', 'admin');

    if ('error' in result) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Tạo tài khoản admin thành công',
      username: 'admin',
      note: 'Mật khẩu mặc định: admin123 (Vui lòng đổi mật khẩu!)'
    });
  } catch (error) {
    console.error('Init error:', error);
    return NextResponse.json(
      { error: 'Lỗi máy chủ' },
      { status: 500 }
    );
  }
}
