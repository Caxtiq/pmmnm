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

import { NextRequest, NextResponse } from 'next/server';
import { createUserReport, getRecentUserReports, updateReportStatus, deleteUserReport } from '@/lib/db/user-reports';

// GET /api/user-reports - Get recent user reports
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const limit = parseInt(searchParams.get('limit') || '100');
        
        const reports = await getRecentUserReports(limit);
        return NextResponse.json({ reports, count: reports.length });
    } catch (error) {
        console.error('Failed to get user reports:', error);
        return NextResponse.json({ error: 'Failed to get user reports' }, { status: 500 });
    }
}

// POST /api/user-reports - Create a new user report
export async function POST(request: NextRequest) {
    try {
        const data = await request.json();
        
        // Validate required fields
        if (!data.type || !data.location || !data.description || !data.severity) {
            return NextResponse.json(
                { 
                    error: 'Missing required fields',
                    required: ['type', 'location', 'description', 'severity'],
                    example: {
                        type: 'flood',
                        location: [106.6297, 10.8231],
                        description: 'Severe flooding on Main Street',
                        severity: 'high',
                        reporterName: 'John Doe',
                        reporterContact: '0123456789'
                    }
                },
                { status: 400 }
            );
        }

        // Validate type
        if (!['flood', 'outage', 'other'].includes(data.type)) {
            return NextResponse.json(
                { error: 'Invalid type. Must be: flood, outage, or other' },
                { status: 400 }
            );
        }

        // Validate severity
        if (!['low', 'medium', 'high'].includes(data.severity)) {
            return NextResponse.json(
                { error: 'Invalid severity. Must be: low, medium, or high' },
                { status: 400 }
            );
        }

        // Create the report
        const report = await createUserReport({
            type: data.type,
            location: data.location,
            coordinates: data.coordinates, // Include coordinates for line reports
            description: data.description,
            severity: data.severity,
            reporterName: data.reporterName,
            reporterContact: data.reporterContact,
            images: data.images || []
        });

        // Broadcast to WebSocket clients if available
        const globalAny = global as any;
        if (globalAny.wss) {
            globalAny.wss.clients.forEach((client: any) => {
                if (client.readyState === 1) { // WebSocket.OPEN
                    client.send(JSON.stringify({
                        type: 'user_report_created',
                        report
                    }));
                }
            });
        }

        return NextResponse.json({ 
            success: true,
            report,
            message: 'Báo cáo đã được gửi thành công. Cảm ơn bạn đã góp phần giúp cộng đồng!'
        }, { status: 201 });
    } catch (error) {
        console.error('Failed to create user report:', error);
        return NextResponse.json({ error: 'Failed to create user report' }, { status: 500 });
    }
}

// PATCH /api/user-reports - Update report status (admin only)
export async function PATCH(request: NextRequest) {
    try {
        const { reportId, status } = await request.json();
        
        if (!reportId || !status) {
            return NextResponse.json(
                { error: 'Missing reportId or status' },
                { status: 400 }
            );
        }

        if (!['new', 'investigating', 'resolved'].includes(status)) {
            return NextResponse.json(
                { error: 'Invalid status. Must be: new, investigating, or resolved' },
                { status: 400 }
            );
        }

        await updateReportStatus(reportId, status);
        
        return NextResponse.json({ success: true, message: 'Report status updated' });
    } catch (error) {
        console.error('Failed to update report status:', error);
        return NextResponse.json({ error: 'Failed to update report status' }, { status: 500 });
    }
}

// DELETE /api/user-reports - Delete a report (admin only)
export async function DELETE(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const reportId = searchParams.get('id');
        
        if (!reportId) {
            return NextResponse.json({ error: 'Missing report ID' }, { status: 400 });
        }

        await deleteUserReport(reportId);
        
        return NextResponse.json({ success: true, message: 'Report deleted' });
    } catch (error) {
        console.error('Failed to delete report:', error);
        return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 });
    }
}
