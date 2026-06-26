import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

// POST: Follow a user
export async function POST(request) {
    try {
        const { followerId, followingId } = await request.json();
        if (!followerId || !followingId) {
            return NextResponse.json({ error: 'Missing followerId or followingId' }, { status: 400 });
        }
        if (followerId === followingId) {
            return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('follows')
            .upsert({ follower_id: followerId, following_id: followingId }, { onConflict: 'follower_id,following_id' })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, follow: data });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE: Unfollow a user
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const followerId = searchParams.get('followerId');
        const followingId = searchParams.get('followingId');

        if (!followerId || !followingId) {
            return NextResponse.json({ error: 'Missing params' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('follows')
            .delete()
            .eq('follower_id', followerId)
            .eq('following_id', followingId);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// GET: Get follow data for a user
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const targetId = searchParams.get('targetId'); // optional: check if userId follows targetId

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        // Get counts
        const [followersRes, followingRes] = await Promise.all([
            supabaseAdmin.from('follows').select('follower_id', { count: 'exact' }).eq('following_id', userId),
            supabaseAdmin.from('follows').select('following_id', { count: 'exact' }).eq('follower_id', userId),
        ]);

        const result = {
            followers_count: followersRes.count || 0,
            following_count: followingRes.count || 0,
        };

        // If targetId provided, check if userId follows targetId
        if (targetId) {
            const { data } = await supabaseAdmin
                .from('follows')
                .select('id')
                .eq('follower_id', userId)
                .eq('following_id', targetId)
                .maybeSingle();
            result.is_following = !!data;
        }

        // Get list of users that userId follows
        const { data: followingList } = await supabaseAdmin
            .from('follows')
            .select('following_id')
            .eq('follower_id', userId);

        result.following_ids = (followingList || []).map(f => f.following_id);

        return NextResponse.json(result);
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
