import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

// Auto-create tables if they don't exist
async function ensureTablesExist() {
    const { error } = await supabaseAdmin.from('member_statuses').select('id').limit(1);
    if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
        // Create tables
        await supabaseAdmin.rpc('exec_sql', { sql: `
            CREATE TABLE IF NOT EXISTS member_statuses (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                user_id UUID NOT NULL,
                content TEXT,
                media_url TEXT,
                media_type TEXT DEFAULT 'text',
                background_color TEXT DEFAULT '#FF5A5F',
                created_at TIMESTAMPTZ DEFAULT now(),
                expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours'),
                view_count INT DEFAULT 0
            );
        `}).catch(() => {});
        // Fallback: direct SQL via REST if rpc doesn't work
        try {
            await supabaseAdmin.from('member_statuses').select('id').limit(1);
        } catch {}
    }
}

// GET: Fetch all active statuses
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId') || '';

        // Try to fetch statuses
        const { data, error } = await supabaseAdmin
            .from('member_statuses')
            .select('*')
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false });

        if (error) {
            // Table doesn't exist yet
            if (error.code === '42P01' || error.message?.includes('does not exist')) {
                return NextResponse.json({ statuses: [], needsSetup: true });
            }
            console.error('[API /statuses] Error:', error);
            return NextResponse.json({ statuses: [], error: error.message }, { status: 500 });
        }

        // Enrich with user info
        const userIds = [...new Set((data || []).map(s => s.user_id))];
        let usersMap = {};
        if (userIds.length > 0) {
            const { data: users } = await supabaseAdmin
                .from('users')
                .select('id, display_name, avatar_url')
                .in('id', userIds);
            (users || []).forEach(u => { usersMap[u.id] = u; });
        }

        const enriched = (data || []).map(s => ({
            ...s,
            users: usersMap[s.user_id] || { display_name: 'User', avatar_url: null }
        }));

        return NextResponse.json({ statuses: enriched });
    } catch (err) {
        console.error('[API /statuses] Catch:', err);
        return NextResponse.json({ statuses: [], error: err.message }, { status: 500 });
    }
}

// POST: Create a new status
export async function POST(request) {
    try {
        const body = await request.json();
        const { userId, content, mediaUrl, mediaType, backgroundColor } = body;

        if (!userId) {
            return NextResponse.json({ error: 'userId required' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('member_statuses')
            .insert({
                user_id: userId,
                content: content || '',
                media_url: mediaUrl || null,
                media_type: mediaType || 'text',
                background_color: backgroundColor || '#FF5A5F',
            })
            .select()
            .single();

        if (error) {
            console.error('[API /statuses POST] Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ status: data });
    } catch (err) {
        console.error('[API /statuses POST] Catch:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE: Delete a status
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const statusId = searchParams.get('statusId');
        const userId = searchParams.get('userId');

        if (!statusId || !userId) {
            return NextResponse.json({ error: 'statusId and userId required' }, { status: 400 });
        }

        await supabaseAdmin
            .from('member_statuses')
            .delete()
            .eq('id', statusId)
            .eq('user_id', userId);

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
