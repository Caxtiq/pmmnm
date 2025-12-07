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

import { getDatabase } from '../mongodb';

const COLLECTION = 'user_reports';

export interface UserReport {
    id?: string;
    type: 'flood' | 'outage' | 'other';
    location: [number, number]; // [lng, lat]
    coordinates?: number[][]; // for line reports
    description: string;
    severity: 'low' | 'medium' | 'high';
    reporterName?: string;
    reporterContact?: string;
    reporterId?: string; // user ID
    status: 'new' | 'investigating' | 'resolved';
    createdAt: number;
    updatedAt?: number;
    images?: string[]; // GCS URLs
    upvotes?: string[]; // user IDs who upvoted
    downvotes?: string[]; // user IDs who downvoted
    voteScore?: number; // upvotes - downvotes
    zoneCreated?: boolean; // auto-zone already created
    adminApproved?: boolean; // approved by admin to create zone
}

// Create a new user report
export async function createUserReport(report: Omit<UserReport, 'id' | 'createdAt' | 'status'>): Promise<UserReport> {
    const db = await getDatabase();
    const collection = db.collection(COLLECTION);
    
    const newReport: UserReport = {
        ...report,
        id: `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        status: 'new',
        createdAt: Date.now(),
    };
    
    await collection.insertOne(newReport as any);
    return newReport;
}

// Get recent user reports
export async function getRecentUserReports(limit: number = 100): Promise<UserReport[]> {
    const db = await getDatabase();
    const reports = await db.collection(COLLECTION)
        .find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
    
    return reports.map(r => ({ ...r, _id: undefined } as any));
}

// Get user reports by type
export async function getUserReportsByType(type: string, limit: number = 100): Promise<UserReport[]> {
    const db = await getDatabase();
    const reports = await db.collection(COLLECTION)
        .find({ type })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
    
    return reports.map(r => ({ ...r, _id: undefined } as any));
}

// Get user reports by status
export async function getUserReportsByStatus(status: string): Promise<UserReport[]> {
    const db = await getDatabase();
    const reports = await db.collection(COLLECTION)
        .find({ status })
        .sort({ createdAt: -1 })
        .toArray();
    
    return reports.map(r => ({ ...r, _id: undefined } as any));
}

// Update report status
export async function updateReportStatus(reportId: string, status: 'new' | 'investigating' | 'resolved'): Promise<void> {
    const db = await getDatabase();
    await db.collection(COLLECTION).updateOne(
        { id: reportId },
        { $set: { status, updatedAt: Date.now() } }
    );
}

// Vote on a report
export async function voteOnReport(reportId: string, userId: string, voteType: 'up' | 'down'): Promise<{ success: boolean; voteScore: number }> {
    const db = await getDatabase();
    const collection = db.collection(COLLECTION);
    
    const report = await collection.findOne({ id: reportId });
    if (!report) {
        return { success: false, voteScore: 0 };
    }
    
    const upvotes = report.upvotes || [];
    const downvotes = report.downvotes || [];
    
    // Remove user from both arrays first
    const newUpvotes = upvotes.filter((id: string) => id !== userId);
    const newDownvotes = downvotes.filter((id: string) => id !== userId);
    
    // Add to appropriate array
    if (voteType === 'up') {
        newUpvotes.push(userId);
    } else {
        newDownvotes.push(userId);
    }
    
    const voteScore = newUpvotes.length - newDownvotes.length;
    
    await collection.updateOne(
        { id: reportId },
        { 
            $set: { 
                upvotes: newUpvotes,
                downvotes: newDownvotes,
                voteScore,
                updatedAt: Date.now()
            }
        }
    );
    
    return { success: true, voteScore };
}

// Remove vote from a report
export async function removeVote(reportId: string, userId: string): Promise<{ success: boolean; voteScore: number }> {
    const db = await getDatabase();
    const collection = db.collection(COLLECTION);
    
    const report = await collection.findOne({ id: reportId });
    if (!report) {
        return { success: false, voteScore: 0 };
    }
    
    const upvotes = (report.upvotes || []).filter((id: string) => id !== userId);
    const downvotes = (report.downvotes || []).filter((id: string) => id !== userId);
    const voteScore = upvotes.length - downvotes.length;
    
    await collection.updateOne(
        { id: reportId },
        { 
            $set: { 
                upvotes,
                downvotes,
                voteScore,
                updatedAt: Date.now()
            }
        }
    );
    
    return { success: true, voteScore };
}

// Get a single report by ID
export async function getReportById(reportId: string): Promise<UserReport | null> {
    const db = await getDatabase();
    const report = await db.collection(COLLECTION).findOne({ id: reportId });
    if (!report) return null;
    return { ...report, _id: undefined } as any;
}

// Delete a report
export async function deleteUserReport(reportId: string): Promise<void> {
    const db = await getDatabase();
    await db.collection(COLLECTION).deleteOne({ id: reportId });
}
