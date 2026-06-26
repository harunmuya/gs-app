import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    }
);

function isActivePremium(sub) {
    if (!sub) return false;
    const plan = String(sub.plan || '').toLowerCase();
    if (!['silver', 'gold'].includes(plan)) return false;
    if (!sub.expires_at) return true;
    return new Date(sub.expires_at).getTime() > Date.now();
}

async function loadFallbackPlan(userId) {
    try {
        const { data } = await supabaseAdmin
            .from('app_settings')
            .select('value')
            .eq('key', 'fallback_ledger')
            .maybeSingle();
        const ledger = typeof data?.value === 'string' ? JSON.parse(data.value) : data?.value;
        return ledger?.user_plans?.[userId] || null;
    } catch {
        return null;
    }
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const memberId = searchParams.get('memberId');

        if (!userId || !memberId) {
            return NextResponse.json({ error: 'Missing userId or memberId' }, { status: 400 });
        }

        const { data: sub } = await supabaseAdmin
            .from('subscriptions')
            .select('plan, expires_at')
            .eq('user_id', userId)
            .maybeSingle();

        const fallbackPlan = await loadFallbackPlan(userId);
        if (!isActivePremium(sub) && !isActivePremium(fallbackPlan)) {
            return NextResponse.json({ error: 'Package upgrade required', upgradeRequired: true }, { status: 402 });
        }

        const { data: member, error } = await supabaseAdmin
            .from('users')
            .select('id, phone_number, phone, phone_visible, is_seed')
            .eq('id', memberId)
            .maybeSingle();

        if (error) throw error;
        if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

        const phone = member.phone_number || member.phone;
        if (!phone || (!member.is_seed && !member.phone_visible)) {
            return NextResponse.json({ error: 'Phone number is not available' }, { status: 404 });
        }

        await supabaseAdmin.from('activity').insert({
            user_id: userId,
            type: 'phone_reveal',
            title: 'Phone number revealed',
            message: `A member phone number was revealed from your package.`,
            profile_id: memberId,
            created_at: new Date().toISOString(),
        }).catch(() => {});

        return NextResponse.json({ success: true, phone });
    } catch (err) {
        console.error('[API /members/reveal] Error:', err);
        return NextResponse.json({ error: err.message || 'Failed to reveal phone' }, { status: 500 });
    }
}
