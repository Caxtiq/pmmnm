import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

export async function GET() {
  try {
    const db = await getDatabase();
    
    // Get recent reports
    const recentReports = await db.collection('user_reports')
      .find()
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    // Get recent zones
    const recentZones = await db.collection('zones')
      .find()
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    // Combine and format activities
    const activities = [
      ...recentReports.map(report => ({
        id: `report-${report._id}`,
        type: 'report' as const,
        action: `Báo cáo mới: ${report.type === 'flood' ? 'Ngập lụt' : 'Mất điện'}`,
        description: report.description,
        timestamp: new Date(report.createdAt),
        icon: report.type === 'flood' ? '🌊' : '⚡',
        color: report.severity === 'high' ? 'text-red-500' : report.severity === 'medium' ? 'text-orange-500' : 'text-yellow-500'
      })),
      ...recentZones.map(zone => ({
        id: `zone-${zone._id}`,
        type: 'zone' as const,
        action: zone.autoCreated ? 'Vùng tự động được tạo' : 'Vùng mới được thêm',
        description: zone.title || zone.description || 'Không có mô tả',
        timestamp: new Date(zone.createdAt || Date.now()),
        icon: zone.type === 'flood' ? '🌊' : '⚡',
        color: 'text-blue-500'
      }))
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10);

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('Activities error:', error);
    return NextResponse.json({ activities: [] });
  }
}
