import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSiteUrl, sendTransactionalEmail } from '@/lib/email';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function hashOtp(email, code) {
    const pepper = process.env.SUPABASE_SERVICE_ROLE_KEY || 'gsm-reset';
    return crypto.createHash('sha256').update(`${email}:${code}:${pepper}`).digest('hex');
}

function makeOtp() {
    return String(crypto.randomInt(100000, 1000000));
}

export async function POST(request) {
    try {
        const { email } = await request.json();
        const normalizedEmail = normalizeEmail(email);

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
        }

        const genericResponse = {
            success: true,
            message: 'If this email exists, a reset code has been sent.',
        };

        const { data: profile } = await supabaseAdmin
            .from('users')
            .select('id, email, display_name')
            .eq('email', normalizedEmail)
            .maybeSingle();

        // Avoid account enumeration: always return success even if no matching account exists.
        if (!profile?.id) {
            return NextResponse.json(genericResponse);
        }

        const code = makeOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        const forwardedFor = request.headers.get('x-forwarded-for') || '';
        const ipAddress = forwardedFor.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '';

        await supabaseAdmin
            .from('password_reset_otps')
            .update({ used_at: new Date().toISOString() })
            .eq('email', normalizedEmail)
            .is('used_at', null);

        const { error: insertError } = await supabaseAdmin
            .from('password_reset_otps')
            .insert({
                user_id: profile.id,
                email: normalizedEmail,
                code_hash: hashOtp(normalizedEmail, code),
                expires_at: expiresAt,
                ip_address: ipAddress,
                user_agent: request.headers.get('user-agent') || '',
            });

        if (insertError) {
            console.error('[Password Reset OTP] Insert failed:', insertError.message);
            return NextResponse.json({ error: 'Password reset is not configured. Run the OTP SQL migration.' }, { status: 500 });
        }

        const emailResult = await sendTransactionalEmail({
            to: normalizedEmail,
            subject: 'Your Genuine Sugar Mummies password reset code',
            title: 'Password Reset Code',
            preview: `Your reset code is ${code}. It expires in 10 minutes.`,
            bodyHtml: `
                <p>Hi ${profile.display_name || 'there'},</p>
                <p>Use this one-time code to reset your Genuine Sugar Mummies password:</p>
                <div style="text-align:center;margin:24px 0;">
                    <div style="display:inline-block;letter-spacing:8px;font-size:34px;font-weight:900;color:#e03131;background:#fff5f5;border:1px solid #ffc9c9;border-radius:16px;padding:16px 22px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">
                        ${code}
                    </div>
                </div>
                <p>This code expires in <strong>10 minutes</strong>. If you did not request it, you can safely ignore this email.</p>
                <p style="font-size:13px;color:#868e96;">For better delivery, add <strong>no-reply@genuinesugarmummies.co.ke</strong> to your contacts.</p>
            `,
            ctaLabel: 'Open Reset Page',
            ctaUrl: `${getSiteUrl()}/auth/login?reset=otp&email=${encodeURIComponent(normalizedEmail)}`,
        });

        if (emailResult?.skipped) {
            console.error('[Password Reset OTP] Email skipped:', emailResult.reason);
            return NextResponse.json({ error: 'Email sending is not configured. Add RESEND_API_KEY in Vercel.' }, { status: 500 });
        }

        return NextResponse.json(genericResponse);
    } catch (err) {
        console.error('[Password Reset OTP] Request error:', err);
        return NextResponse.json({ error: err.message || 'Failed to send reset code' }, { status: 500 });
    }
}
