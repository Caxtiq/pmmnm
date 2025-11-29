import { NextRequest, NextResponse } from 'next/server';
import { deleteZone, updateZone, Zone } from '@/lib/db/zones';

// PATCH /api/zones/[id] - Update a zone
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const updates: Partial<Zone> = await request.json();
        await updateZone(id, updates);
        return NextResponse.json({ message: 'Zone updated' });
    } catch (error) {
        console.error('Failed to update zone:', error);
        return NextResponse.json({ error: 'Failed to update zone' }, { status: 500 });
    }
}

// DELETE /api/zones/[id] - Delete a zone
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await deleteZone(id);
        return NextResponse.json({ message: 'Zone deleted' });
    } catch (error) {
        console.error('Failed to delete zone:', error);
        return NextResponse.json({ error: 'Failed to delete zone' }, { status: 500 });
    }
}
