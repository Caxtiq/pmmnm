import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { COLLECTIONS } from '@/lib/db/collections';

export async function GET() {
  try {
    const db = await getDatabase();
    const users = await db
      .collection(COLLECTIONS.USERS)
      .find({})
      .project({ password: 0 }) // Exclude password field
      .toArray();

    return NextResponse.json({
      users: users.map(u => ({
        id: u._id.toString(),
        username: u.username,
        role: u.role,
        createdAt: u.createdAt
      }))
    });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
