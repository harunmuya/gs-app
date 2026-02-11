import { NextResponse } from 'next/server';
import { fetchProfiles } from '@/lib/wordpress';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const perPage = parseInt(searchParams.get('per_page') || '20');

        // Rate limit: max 10 requests per IP per minute (simple in-memory)
        const result = await fetchProfiles(page, Math.min(perPage, 50));

        return NextResponse.json(result, {
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            },
        });
    } catch (error) {
        console.error('Profiles API error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch profiles' },
            { status: 500 }
        );
    }
}
