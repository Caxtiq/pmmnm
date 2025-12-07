import { NextRequest, NextResponse } from 'next/server';
import { getReportById } from '@/lib/db/user-reports';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const { reportId } = await request.json();

    if (!reportId) {
      return NextResponse.json(
        { error: 'Report ID required' },
        { status: 400 }
      );
    }

    const report = await getReportById(reportId);
    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    // Don't create zone if already created
    if (report.zoneCreated) {
      return NextResponse.json({ 
        success: false, 
        message: 'Zone already created for this report' 
      });
    }

    // Create zone from report
    const zoneData = {
      id: `zone-admin-${Date.now()}`,
      type: report.type === 'flood' ? 'flood' : 'outage',
      shape: report.coordinates && report.coordinates.length > 1 ? 'line' : 'circle',
      center: report.location,
      coordinates: report.coordinates,
      radius: 500,
      riskLevel: report.severity === 'high' ? 9 : report.severity === 'medium' ? 6 : 4,
      title: `✅ Admin: ${report.description.substring(0, 50)}`,
      description: `Được phê duyệt bởi quản trị viên`
    };

    await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/zones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zoneData)
    });

    // Mark report as zone created and admin approved
    await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/user-reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zoneCreated: true, adminApproved: true })
    });

    return NextResponse.json({
      success: true,
      message: 'Zone created successfully'
    });
  } catch (error) {
    console.error('Approve report error:', error);
    return NextResponse.json(
      { error: 'Failed to approve report' },
      { status: 500 }
    );
  }
}
