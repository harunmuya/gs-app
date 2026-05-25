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

        // 2. Send physical welcome email via Resend if API Key is configured
        if (process.env.RESEND_API_KEY) {
            try {
                // Fetch the user's email address from auth system
                const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.getUserById(userId);
                const userEmail = authUser?.user?.email;

                if (userEmail && !authErr) {
                    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
                    const htmlBody = `
                      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 30px; border: 1px solid #f1f3f5; border-radius: 16px; background-color: #ffffff; color: #212529;">
                        <div style="text-align: center; margin-bottom: 25px;">
                          <img src="https://genuine-sugarmummies-app.vercel.app/genuine-logo.png" alt="Genuine Sugar Mummies" style="height: 38px; object-fit: contain;" />
                        </div>
                        <h2 style="color: #E03131; font-size: 22px; font-weight: 700; margin-top: 0; margin-bottom: 16px; text-align: center;">Welcome, ${name}!</h2>
                        <p style="font-size: 15px; line-height: 1.6; color: #495057; margin-bottom: 20px;">
                          We are thrilled to welcome you to <strong>Genuine Sugar Mummies</strong>, Kenya's most trusted and secure platform for premium matchmaking.
                        </p>
                        
                        <div style="background-color: #fff5f5; border-left: 4px solid #E03131; padding: 15px 20px; border-radius: 8px; margin-bottom: 24px;">
                          <h3 style="margin-top: 0; margin-bottom: 8px; font-size: 14px; color: #C92A2A; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Getting Started</h3>
                          <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6; color: #495057;">
                            <li><strong>Complete your profile:</strong> Fill in your details and upload clear photos to stand out.</li>
                            <li><strong>Explore matches:</strong> Visit the Discover feed to swipe and find connections.</li>
                            <li><strong>Activate VIP:</strong> Upgrade your account to unlock unlimited messaging and direct calls.</li>
                          </ul>
                        </div>
                        
                        <p style="font-size: 14px; line-height: 1.5; color: #495057; margin-bottom: 24px;">
                          Need support? Connect with our administration team at <a href="mailto:admin@genuinesugarmummies.co.ke" style="color: #E03131; text-decoration: none; font-weight: 600;">admin@genuinesugarmummies.co.ke</a> or message Mary G directly on Telegram at <a href="https://t.me/GSADMINMARYGAGENCY" style="color: #E03131; text-decoration: none; font-weight: 600;">@GSADMINMARYGAGENCY</a>.
                        </p>
                        
                        <hr style="border: 0; border-top: 1px solid #e9ecef; margin: 25px 0;" />
                        <p style="font-size: 11px; color: #868e96; text-align: center; margin: 0; line-height: 1.4;">
                          Genuine Sugar Mummies App &copy; 2026. All rights reserved.<br/>
                          This email was sent to ${userEmail} as a welcome notice for your registration.
                        </p>
                      </div>
                    `;

                    const emailRes = await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
                        },
                        body: JSON.stringify({
                            from: fromEmail,
                            to: [userEmail],
                            subject: 'Welcome to Genuine Sugar Mummies!',
                            html: htmlBody
                        })
                    });

                    if (!emailRes.ok) {
                        const errTxt = await emailRes.text();
                        console.error('[Welcome Email API] Resend call failed:', errTxt);
                    } else {
                        console.log('[Welcome Email API] Welcome email sent successfully to', userEmail);
                    }
                }
            } catch (emailErr) {
                console.error('[Welcome Email API] Failed to send welcome email:', emailErr.message);
            }
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
