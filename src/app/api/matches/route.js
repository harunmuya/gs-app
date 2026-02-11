import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function GET() {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: matches, error } = await supabase
            .from('matches')
            .select('*')
            .eq('user_id', user.id)
            .order('score', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ matches: matches || [] });
    } catch (error) {
        console.error('Matches API error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch matches' },
            { status: 500 }
        );
    }
}
