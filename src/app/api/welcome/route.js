import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSiteUrl, sendTransactionalEmail } from '@/lib/email';

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
        const { userId, email, displayName, extraData = {} } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        // --- Server-side profile upsert using service_role to bypass client-side RLS limits ---
        const profilePayload = {
            id: userId,
            email: email || null,
            display_name: displayName || email?.split('@')[0] || 'User',
            gender: extraData.gender || null,
            looking_for: extraData.lookingFor || null,
            age: extraData.age || null,
            location: extraData.location || '',
            interests: extraData.interests || [],
            hobbies: extraData.hobbies || [],
            is_public: extraData.isPublic !== false,
            updated_at: new Date().toISOString(),
        };

        // Fetch existing user to merge fields if exists
        try {
            const { data: existingProfile } = await supabaseAdmin
                .from('users')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (existingProfile) {
                if (!profilePayload.email && existingProfile.email) profilePayload.email = existingProfile.email;
                if (!profilePayload.display_name && existingProfile.display_name) profilePayload.display_name = existingProfile.display_name;
                if (!profilePayload.gender && existingProfile.gender) profilePayload.gender = existingProfile.gender;
                if (!profilePayload.looking_for && existingProfile.looking_for) profilePayload.looking_for = existingProfile.looking_for;
                if (!profilePayload.age && existingProfile.age) profilePayload.age = existingProfile.age;
                if (!profilePayload.location && existingProfile.location) profilePayload.location = existingProfile.location;
                if ((!profilePayload.interests || profilePayload.interests.length === 0) && existingProfile.interests) profilePayload.interests = existingProfile.interests;
                if ((!profilePayload.hobbies || profilePayload.hobbies.length === 0) && existingProfile.hobbies) profilePayload.hobbies = existingProfile.hobbies;
            }
        } catch (mergeErr) {
            console.warn('[Welcome API] Profile merge failed, continuing with upsert:', mergeErr.message);
        }

        let { error: profileError } = await supabaseAdmin
            .from('users')
            .upsert(profilePayload);

        if (profileError && (
            profileError.message?.includes('hobbies') || 
            profileError.code === 'PGRST100' || 
            profileError.code === '42703'
        )) {
            console.warn('[Welcome API] hobbies column missing on upsert, retrying without it...');
            const fallbackPayload = { ...profilePayload };
            delete fallbackPayload.hobbies;
            const retry = await supabaseAdmin
                .from('users')
                .upsert(fallbackPayload);
            profileError = retry.error;
        }

        if (profileError) {
            console.error('[Welcome API] Server-side profile upsert error:', profileError.message);
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

        // 1. Send in-app activity notification (will show under Notifications, clickable)
        const { data, error } = await supabaseAdmin
            .from('notifications')
            .insert({
                user_id: userId,
                type: 'welcome',
                sender: 'GS Admin',
                sender_image: '/gs-logo.png',
                title: WELCOME_TITLE,
                body: "Welcome to Genuine Sugar Mummies! Tap here to explore matches and browse profiles on our Discover page.",
                is_read: false,
                created_at: new Date().toISOString(),
            })
            .select()
            .single();

        // 1b. Send actual welcome message to user's chat (opens like SMS!)
        await sendAdminChatMessage(supabaseAdmin, userId, welcomeBody, 'Admin Mary G', '/gs-logo.png').catch(() => {});

        // 2. Send physical welcome email via Resend when RESEND_API_KEY is configured.
        try {
            const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.getUserById(userId);
            const userEmail = authUser?.user?.email || email;
            if (userEmail && !authErr) {
                await sendTransactionalEmail({
                    to: userEmail,
                    subject: 'Welcome to Genuine Sugar Mummies',
                    title: `Welcome, ${name}!`,
                    preview: 'Your Genuine Sugar Mummies account is ready.',
                    bodyHtml: `
                        <p>We are thrilled to welcome you to <strong>Genuine Sugar Mummies</strong>, Kenya's trusted platform for premium matchmaking.</p>
                        <div style="background:#fff5f5;border-left:4px solid #e03131;padding:14px 18px;border-radius:10px;margin:18px 0;">
                            <p style="margin:0 0 8px;font-weight:800;color:#c92a2a;">Getting started</p>
                            <ul style="margin:0;padding-left:20px;">
                                <li>Complete your profile and upload clear photos.</li>
                                <li>Browse Discover and Members to find matches.</li>
                                <li>Activate a package after admin approval to unlock premium features.</li>
                            </ul>
                        </div>
                        <p>Need support? Email <a href="mailto:admin@genuinesugarmummies.co.ke" style="color:#e03131;font-weight:700;">admin@genuinesugarmummies.co.ke</a>.</p>
                    `,
                    ctaLabel: 'Open Genuine Sugar Mummies',
                    ctaUrl: `${getSiteUrl()}/discover`,
                });
            }
        } catch (emailErr) {
            console.error('[Welcome Email API] Failed to send welcome email:', emailErr.message);
        }

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

async function sendAdminChatMessage(supabase, userId, content, senderName = 'Admin Mary G', senderImage = '/gs-logo.png') {
    try {
        let { data: conv } = await supabase
            .from('conversations')
            .select('*')
            .eq('user_id', userId)
            .eq('match_wp_id', 0)
            .maybeSingle();

        if (!conv) {
            const { data: newConv, error: createErr } = await supabase
                .from('conversations')
                .insert({
                    user_id: userId,
                    match_wp_id: 0,
                    match_name: senderName,
                    match_image: senderImage,
                    unread_count: 0
                })
                .select()
                .single();
            if (createErr) throw createErr;
            conv = newConv;
        } else {
            if (conv.match_name !== senderName || conv.match_image !== senderImage) {
                await supabase
                    .from('conversations')
                    .update({ match_name: senderName, match_image: senderImage })
                    .eq('id', conv.id);
            }
        }

        const { data: msg, error: msgErr } = await supabase
            .from('messages')
            .insert({
                conversation_id: conv.id,
                sender_id: null,
                sender_name: senderName,
                content: content,
                is_read: false
            })
            .select()
            .single();

        if (msgErr) throw msgErr;

        await supabase
            .from('conversations')
            .update({
                last_message: content,
                last_message_at: new Date().toISOString(),
                unread_count: (conv.unread_count || 0) + 1
            })
            .eq('id', conv.id);

        return { success: true, conversationId: conv.id };
    } catch (err) {
        console.error('Failed to send admin chat message:', err);
        return { success: false, error: err.message };
    }
}
