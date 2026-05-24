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

        // 1. Send in-app notification alert
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
