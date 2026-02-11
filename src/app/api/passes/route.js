import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(request) {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { profileWpId } = body;

        if (!profileWpId) {
            return NextResponse.json({ error: 'Missing profileWpId' }, { status: 400 });
        }

        // Prevent duplicates
        const { data: existing } = await supabase
            .from('passes')
            .select('id')
            .eq('user_id', user.id)
            .eq('profile_wp_id', profileWpId)
            .single();

        if (existing) {
            return NextResponse.json({ message: 'Already passed', duplicate: true });
        }

        const { error } = await supabase.from('passes').insert({
            user_id: user.id,
            profile_wp_id: profileWpId,
        });

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Pass API error:', error);
        return NextResponse.json(
            { error: 'Failed to record pass' },
            { status: 500 }
        );
    }
}
