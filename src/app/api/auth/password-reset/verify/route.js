import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { findActiveResetOtp, updateResetOtp } from '@/lib/passwordResetOtpStore';

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

        const storeState = await findActiveResetOtp(supabaseAdmin, normalizedEmail);
        const { otp } = storeState;

        if (!otp) {
            return NextResponse.json({ error: 'Reset code has expired. Request a new code.' }, { status: 400 });
        }

        if ((otp.attempts || 0) >= 5) {
            await updateResetOtp(supabaseAdmin, storeState, { used_at: new Date().toISOString() });
            return NextResponse.json({ error: 'Too many attempts. Request a new code.' }, { status: 429 });
        }

        const expectedHash = hashOtp(normalizedEmail, normalizedCode);
        const expectedBuffer = Buffer.from(expectedHash);
        const actualBuffer = Buffer.from(String(otp.code_hash || ''));
        const valid = expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);

        if (!valid) {
            const attempts = (otp.attempts || 0) + 1;
            await updateResetOtp(supabaseAdmin, storeState, {
                attempts,
                used_at: attempts >= 5 ? new Date().toISOString() : null,
            });
            return NextResponse.json({ error: attempts >= 5 ? 'Too many attempts. Request a new code.' : 'Invalid reset code' }, { status: 400 });
        }

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(otp.user_id, {
            password,
            email_confirm: true,
        });
        if (updateError) throw updateError;

        await updateResetOtp(supabaseAdmin, storeState, {
            used_at: new Date().toISOString(),
            attempts: (otp.attempts || 0) + 1,
        });

        try {
            await supabaseAdmin.from('activity').insert({
                user_id: otp.user_id,
                type: 'security',
                title: 'Password reset',
                message: 'Your password was reset using an email OTP.',
                created_at: new Date().toISOString(),
            });
        } catch (activityError) {
            console.warn('[Password Reset OTP] Activity log skipped:', activityError?.message || activityError);
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[Password Reset OTP] Verify error:', err);
        return NextResponse.json({ error: err.message || 'Failed to reset password' }, { status: 500 });
    }
}
