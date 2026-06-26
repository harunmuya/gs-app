import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

// POST: Record a view or reaction
export async function POST(request) {
    try {
        const body = await request.json();
        const { action, statusId, userId, reaction } = body;

        if (!statusId || !userId) {
            return NextResponse.json({ error: 'statusId and userId required' }, { status: 400 });
        }

        if (action === 'view') {
            // Record view
            const { error } = await supabaseAdmin
                .from('status_views')
                .upsert({ status_id: statusId, viewer_id: userId }, { onConflict: 'status_id,viewer_id' });

            if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
                return NextResponse.json({ success: false, needsSetup: true });
            }

            // Update view count
            const { count } = await supabaseAdmin
                .from('status_views')
                .select('id', { count: 'exact', head: true })
                .eq('status_id', statusId);

            await supabaseAdmin.from('member_statuses').update({ view_count: count || 0 }).eq('id', statusId);

            return NextResponse.json({ success: true, viewCount: count || 0 });

        } else if (action === 'react') {
            // Toggle reaction
            const { data: existing } = await supabaseAdmin
                .from('status_reactions')
                .select('id')
                .eq('status_id', statusId)
                .eq('user_id', userId)
                .maybeSingle();

            if (existing) {
                await supabaseAdmin.from('status_reactions').delete().eq('id', existing.id);
                return NextResponse.json({ success: true, reacted: false });
            } else {
                await supabaseAdmin.from('status_reactions').insert({
                    status_id: statusId,
                    user_id: userId,
                    reaction: reaction || 'like',
                });
                return NextResponse.json({ success: true, reacted: true });
            }
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (err) {
        console.error('[API /statuses/interact]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// GET: Get views and reactions for a status
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const statusId = searchParams.get('statusId');
        const userId = searchParams.get('userId');

        if (!statusId) {
            return NextResponse.json({ error: 'statusId required' }, { status: 400 });
        }

        // Get views with user info
        let views = [];
        try {
            const { data: viewsData } = await supabaseAdmin
                .from('status_views')
                .select('*, viewer:users!status_views_viewer_id_fkey(id, display_name, avatar_url)')
                .eq('status_id', statusId)
                .order('viewed_at', { ascending: false });
            views = viewsData || [];
        } catch {}

        // Fallback: if foreign key doesn't exist, fetch separately
        if (views.length === 0) {
            try {
                const { data: rawViews } = await supabaseAdmin
                    .from('status_views')
                    .select('*')
                    .eq('status_id', statusId);

                if (rawViews && rawViews.length > 0) {
                    const viewerIds = rawViews.map(v => v.viewer_id);
                    const { data: users } = await supabaseAdmin
                        .from('users')
                        .select('id, display_name, avatar_url')
                        .in('id', viewerIds);
                    const usersMap = {};
                    (users || []).forEach(u => { usersMap[u.id] = u; });
                    views = rawViews.map(v => ({ ...v, viewer: usersMap[v.viewer_id] || { display_name: 'User' } }));
                }
            } catch {}
        }

        // Get reactions with user info
        let reactions = [];
        try {
            const { data: reactionsData } = await supabaseAdmin
                .from('status_reactions')
                .select('*')
                .eq('status_id', statusId);

            if (reactionsData && reactionsData.length > 0) {
                const reactorIds = reactionsData.map(r => r.user_id);
                const { data: users } = await supabaseAdmin
                    .from('users')
                    .select('id, display_name, avatar_url')
                    .in('id', reactorIds);
                const usersMap = {};
                (users || []).forEach(u => { usersMap[u.id] = u; });
                reactions = reactionsData.map(r => ({ ...r, user: usersMap[r.user_id] || { display_name: 'User' } }));
            }
        } catch {}

        return NextResponse.json({ views, reactions, viewCount: views.length, reactionCount: reactions.length });
    } catch (err) {
        console.error('[API /statuses/interact GET]', err);
        return NextResponse.json({ views: [], reactions: [], viewCount: 0, reactionCount: 0, error: err.message }, { status: 500 });
    }
}
