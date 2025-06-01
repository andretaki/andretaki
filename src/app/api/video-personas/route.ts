import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { videoPersonas } from '../../../../lib/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
    try {
        const personas = await db.select({
            id: videoPersonas.id,
            name: videoPersonas.name,
            description: videoPersonas.description,
        })
        .from(videoPersonas)
        .orderBy(desc(videoPersonas.createdAt));

        return NextResponse.json({ success: true, personas });
    } catch (error) {
        console.error('Error fetching video personas:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch video personas' },
            { status: 500 }
        );
    }
} 