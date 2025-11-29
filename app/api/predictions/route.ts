import { NextRequest, NextResponse } from 'next/server';
import { insertPrediction, getActivePredictions, deleteExpiredPredictions, Prediction } from '@/lib/db/predictions';

// GET /api/predictions - Get active predictions
export async function GET() {
    try {
        // Clean up expired predictions first
        await deleteExpiredPredictions();
        
        const predictions = await getActivePredictions();
        return NextResponse.json({ predictions });
    } catch (error) {
        console.error('Failed to get predictions:', error);
        return NextResponse.json({ error: 'Failed to get predictions' }, { status: 500 });
    }
}

// POST /api/predictions - Insert prediction
export async function POST(request: NextRequest) {
    try {
        const prediction: Prediction = await request.json();
        const id = await insertPrediction(prediction);
        return NextResponse.json({ id }, { status: 201 });
    } catch (error) {
        console.error('Failed to insert prediction:', error);
        return NextResponse.json({ error: 'Failed to insert prediction' }, { status: 500 });
    }
}
