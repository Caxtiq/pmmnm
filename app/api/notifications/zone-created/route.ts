import { NextRequest, NextResponse } from 'next/server';
import { notifyNearbyUsers } from '@/lib/websocket-server';

export async function POST(request: NextRequest) {
  try {
    const { zoneId, location, type, severity, description } = await request.json();

    if (!zoneId || !location || !type || !severity) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create notification data
    const notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: `⚠️ Vùng nguy hiểm mới: ${type === 'flood' ? 'Ngập lụt' : 'Mất điện'}`,
      body: description.substring(0, 100),
      type: 'zone' as const,
      severity: severity as 'high' | 'medium' | 'low',
      location: location as [number, number],
      timestamp: new Date(),
      read: false,
      url: '/'
    };

    // Send to nearby users (within 5km)
    notifyNearbyUsers(location, 5, notification);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notification error:', error);
    return NextResponse.json(
      { error: 'Failed to send notifications' },
      { status: 500 }
    );
  }
}
