import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        }
    }
);

function maskPhone(phone) {
    if (!phone) return null;
    // e.g. "+254 712345678" → "+254 7** *** ***"
    const parts = phone.split(' ');
    if (parts.length < 2) return phone.substring(0, 4) + ' *** *** ***';
    const code = parts[0];
    const num = parts[1] || '';
    return `${code} ${num.charAt(0)}** *** ***`;
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId') || '';

        const { data, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(500);

        if (error) {
            console.error('[API /members] Supabase error:', error);
            return NextResponse.json({ members: [], error: error.message }, { status: 500 });
        }

        // Filter out the requesting user
        const filteredMembers = (data || []).filter(m => m.id !== userId);

        // Fetch verification statuses and subscriptions for all members in parallel
        const memberIds = filteredMembers.map(m => m.id);
        const noneArr = ['__none__'];

        const [verifRes, subRes, followersRes, followingRes, userFollowsRes] = await Promise.all([
            supabaseAdmin
                .from('verification_requests')
                .select('user_id, status')
                .in('user_id', memberIds.length > 0 ? memberIds : noneArr),
            supabaseAdmin
                .from('subscriptions')
                .select('user_id, plan')
                .in('user_id', memberIds.length > 0 ? memberIds : noneArr),
            // Count followers for each member
            supabaseAdmin
                .from('follows')
                .select('following_id')
                .in('following_id', memberIds.length > 0 ? memberIds : noneArr),
            // Count following for each member
            supabaseAdmin
                .from('follows')
                .select('follower_id')
                .in('follower_id', memberIds.length > 0 ? memberIds : noneArr),
            // Check which members the current user follows
            userId ? supabaseAdmin
                .from('follows')
                .select('following_id')
                .eq('follower_id', userId) : { data: [] },
        ]);

        // Build lookup maps
        const verifMap = {};
        (verifRes.data || []).forEach(v => { verifMap[v.user_id] = v.status; });

        const subMap = {};
        (subRes.data || []).forEach(s => { subMap[s.user_id] = s.plan; });

        // Followers count map
        const followersCountMap = {};
        (followersRes.data || []).forEach(f => {
            followersCountMap[f.following_id] = (followersCountMap[f.following_id] || 0) + 1;
        });

        // Following count map
        const followingCountMap = {};
        (followingRes.data || []).forEach(f => {
            followingCountMap[f.follower_id] = (followingCountMap[f.follower_id] || 0) + 1;
        });

        // Set of IDs the current user follows
        const userFollowsSet = new Set((userFollowsRes.data || []).map(f => f.following_id));

        // Enrich members with badge data
        const members = filteredMembers.map(m => ({
            ...m,
            verification_status: verifMap[m.id] || null,
            subscription_plan: subMap[m.id] || 'free',
            followers_count: followersCountMap[m.id] || 0,
            following_count: followingCountMap[m.id] || 0,
            is_followed_by_user: userFollowsSet.has(m.id),
            // Seed users: always show masked phone
            // Real users: only show if phone_visible is true AND they have a number
            phone_masked: m.is_seed
                ? maskPhone(m.phone_number)
                : (m.phone_visible && (m.phone_number || m.phone))
                    ? maskPhone(m.phone_number || m.phone)
                    : null,
            // Never expose actual phone number to client
            phone_number: undefined,
            phone: undefined,
        }));

        return NextResponse.json({ members });
    } catch (err) {
        console.error('[API /members] Error:', err);
        return NextResponse.json({ members: [], error: err.message }, { status: 500 });
    }
}
