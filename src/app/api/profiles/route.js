import { NextResponse } from 'next/server';
import { fetchProfiles, fetchSingleProfile } from '@/lib/wordpress';

export async function GET(request) {
    const { searchParams } = new URL(request.url);

    try {
        const id = searchParams.get('id');
        if (id) {
            const profile = await fetchSingleProfile(id);
            if (!profile) {
                return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
            }
            return NextResponse.json(
                { profiles: [profile] },
                {
                    headers: {
                        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
                    },
                }
            );
        }

        // Parse pagination with safe defaults
        const rawPage = parseInt(searchParams.get('page'));
        const rawPerPage = parseInt(searchParams.get('per_page'));
        const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
        const perPage = Number.isFinite(rawPerPage) && rawPerPage > 0 ? Math.min(rawPerPage, 100) : 25;

        const result = await fetchProfiles(page, perPage);

        return NextResponse.json(result, {
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            },
        });
    } catch (error) {
        console.error('[Profiles API] Error:', error.message);
        return NextResponse.json(
            { error: 'Failed to fetch profiles', profiles: [], totalPages: 0 },
            { status: 500 }
        );
    }
}
