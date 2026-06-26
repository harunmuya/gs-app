import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function normalizeCode(code) {
    return String(code || '').replace(/\D/g, '').slice(0, 6);
}

function hashOtp(email, code) {
    const pepper = process.env.SUPABASE_SERVICE_ROLE_KEY || 'gsm-reset';
    return crypto.createHash('sha256').update(`${email}:${code}:${pepper}`).digest('hex');
}

export async function POST(request) {
    try {
        const { email, code, password } = await request.json();
        const normalizedEmail = normalizeEmail(email);
        const normalizedCode = normalizeCode(code);

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
        }
        if (!/^\d{6}$/.test(normalizedCode)) {
            return NextResponse.json({ error: 'Enter the 6-digit reset code' }, { status: 400 });
        }
        if (!password || String(password).length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
        }

        const { data: otp, error: otpError } = await supabaseAdmin
            .from('password_reset_otps')
            .select('*')
            .eq('email', normalizedEmail)
            .is('used_at', null)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (otpError) throw otpError;
        if (!otp) {
            return NextResponse.json({ error: 'Reset code has expired. Request a new code.' }, { status: 400 });
        }

        if ((otp.attempts || 0) >= 5) {
            await supabaseAdmin.from('password_reset_otps').update({ used_at: new Date().toISOString() }).eq('id', otp.id);
            return NextResponse.json({ error: 'Too many attempts. Request a new code.' }, { status: 429 });
        }

        const expectedHash = hashOtp(normalizedEmail, normalizedCode);
        const valid = crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(otp.code_hash));

        if (!valid) {
            const attempts = (otp.attempts || 0) + 1;
            await supabaseAdmin
                .from('password_reset_otps')
                .update({
                    attempts,
                    used_at: attempts >= 5 ? new Date().toISOString() : null,
                })
                .eq('id', otp.id);
            return NextResponse.json({ error: attempts >= 5 ? 'Too many attempts. Request a new code.' : 'Invalid reset code' }, { status: 400 });
        }

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(otp.user_id, {
            password,
            email_confirm: true,
        });
        if (updateError) throw updateError;

        await supabaseAdmin
            .from('password_reset_otps')
            .update({ used_at: new Date().toISOString(), attempts: (otp.attempts || 0) + 1 })
            .eq('id', otp.id);

        await supabaseAdmin.from('activity').insert({
            user_id: otp.user_id,
            type: 'security',
            title: 'Password reset',
            message: 'Your password was reset using an email OTP.',
            created_at: new Date().toISOString(),
        }).catch(() => {});

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[Password Reset OTP] Verify error:', err);
        return NextResponse.json({ error: err.message || 'Failed to reset password' }, { status: 500 });
    }
}
