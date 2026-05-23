import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Admin client — bypasses RLS entirely
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

const WELCOME_TITLE = 'Welcome to Genuine Sugarmummies!';

export async function POST(req) {
    try {
        const { userId, displayName } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        // --- Safety check: Don't send welcome twice ---
        try {
            const { data: existing } = await supabaseAdmin
                .from('notifications')
                .select('id')
                .eq('user_id', userId)
                .ilike('title', '%welcome%')
                .limit(1)
                .single();

            if (existing?.id) {
                return NextResponse.json({ success: true, skipped: true, reason: 'Welcome message already sent' });
            }
        } catch {
            // If the check fails (e.g. no rows), proceed to insert
        }

        const name = displayName || 'there';
        const welcomeBody = `Hi ${name}! 👋 Welcome to Genuine Sugar Mummies — Kenya's most trusted connection platform!\n\nHere's how to get started:\n• Complete your profile for better matches\n• Browse and like profiles on the Discover page\n• Upgrade to a premium plan to unlock unlimited messages and matches\n\nNeed help? Reach our official admin team at admin@genuinesugarmummies.co.ke or connect with Mary G directly on Telegram @GSADMINMARYGAGENCY.\n\nEnjoy connecting! 💛`;

        const { data, error } = await supabaseAdmin
            .from('notifications')
            .insert({
                user_id: userId,
                type: 'gs_support',
                sender: 'GS Admin',
                sender_image: '/gs-logo.png',
                title: WELCOME_TITLE,
                body: welcomeBody,
                is_read: false,
                created_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error('[Welcome API] Failed to insert welcome notification:', error.message);

            // Graceful fallback: store welcome flag in app_settings so we can track it
            // even if the notifications table has RLS issues
            try {
                const ledgerRes = await supabaseAdmin.from('app_settings').select('*').eq('key', 'fallback_ledger').single();
                let ledger = { custom_badges: {}, user_plans: {}, transactions: [], welcomed_users: [] };
                let ledgerId = null;

                if (ledgerRes.data) {
                    ledgerId = ledgerRes.data.id;
                    ledger = typeof ledgerRes.data.value === 'string' ? JSON.parse(ledgerRes.data.value) : ledgerRes.data.value;
                }

                if (!ledger.welcomed_users) ledger.welcomed_users = [];
                if (!ledger.welcomed_users.includes(userId)) {
                    ledger.welcomed_users.push(userId);
                    if (ledgerId) {
                        await supabaseAdmin.from('app_settings').update({ value: ledger, updated_at: new Date().toISOString() }).eq('id', ledgerId);
                    } else {
                        await supabaseAdmin.from('app_settings').insert({ key: 'fallback_ledger', value: ledger });
                    }
                }
            } catch (fallbackErr) {
                console.warn('[Welcome API] Fallback ledger update failed:', fallbackErr.message);
            }

            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, notification: data });
    } catch (err) {
        console.error('[Welcome API] Unexpected error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
