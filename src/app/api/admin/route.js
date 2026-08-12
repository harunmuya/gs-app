import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseAdmin';
import { emailHtml, sendAndLogEmail } from '@/lib/email';
import { hashEmail } from '@/lib/security';
import {
    ADMIN_COOKIE,
    adminAuthConfigured,
    adminCookieOptions,
    adminSessionFromRequest,
    clearLoginFailures,
    issueAdminSession,
    loginThrottled,
    recordLoginFailure,
    verifyAdminCredentials,
} from '@/lib/adminSession';
import { allDefaultPackageTiers, getPackageTier, normalizeTierId } from '@/lib/packageAccess';
import { ADMIN_ENV_MISSING } from '@/lib/copy';

const PACKAGE_TIERS = Object.fromEntries(allDefaultPackageTiers().map((tier) => [tier.id, {
    name: tier.name,
    price: tier.price_ksh,
    phoneReveal: Boolean(tier.phone_reveal),
    startingCredits: Number(tier.starting_credits || 0),
}]));

function isAuthed(request) {
    return Boolean(adminSessionFromRequest(request));
}

function clientKey(request) {
    return (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
        || request.headers.get('x-real-ip')
        || 'unknown';
}

function jsonError(message, status = 500) {
    return NextResponse.json({ error: message }, { status });
}

function clean(value, fallback = '') {
    return String(value || fallback).trim();
}

function planName(tier) {
    return PACKAGE_TIERS[normalizeTierId(tier)]?.name || 'Free';
}

function planFor(tier, fallback = 'free') {
    const normalized = normalizeTierId(tier || fallback);
    return { tier: normalized, plan: PACKAGE_TIERS[normalized] || PACKAGE_TIERS.free };
}

async function packagePlanDetails(supabase, tier, fallbackPlan = {}) {
    const row = await getPackageTier(supabase, tier);
    return {
        name: row?.name || fallbackPlan.name || planName(tier),
        price: Number(row?.price_ksh ?? fallbackPlan.price ?? 0),
        phoneReveal: Boolean(row?.phone_reveal ?? fallbackPlan.phoneReveal),
        startingCredits: Number(row?.starting_credits ?? fallbackPlan.startingCredits ?? 0),
    };
}

async function safeSelect(supabase, table, select, options = {}) {
    let query = supabase.from(table).select(select, options.count ? { count: 'exact' } : undefined);
    // Restrict to a set of ids. Without this an `in` option passed by a caller
    // is silently ignored and the whole table comes back — which is exactly the
    // failure the verification-image query below is trying to avoid.
    if (options.in?.column && Array.isArray(options.in.values)) {
        if (!options.in.values.length) return { data: [], count: 0, error: null };
        query = query.in(options.in.column, options.in.values);
    }
    if (options.order) query = query.order(options.order.column, { ascending: options.order.ascending ?? false });
    if (options.limit) query = query.limit(options.limit);
    const result = await query;
    if (result.error) return { data: [], count: 0, error: result.error.message };
    return { data: result.data || [], count: result.count || (result.data || []).length, error: null };
}

async function writeLog(supabase, action, details = {}) {
    try { await supabase.from('admin_logs').insert({ action, details }); } catch {}
}

async function queueUserNotification(supabase, payload) {
    try { await supabase.from('user_notifications').insert(payload); } catch {}
}

async function queueEmail(supabase, payload) {
    return sendAndLogEmail(supabase, {
        to: payload.to || payload.to_email,
        subject: payload.subject,
        text: payload.body || payload.text || '',
        html: payload.html || emailHtml(payload.subject || 'Genuine Sugar Mummies', payload.body || payload.text || ''),
    });
}

async function grantPackageStartingCredits(supabase, userId, tier, plan = {}) {
    const normalizedTier = normalizeTierId(tier);
    const amount = Math.max(0, Number(plan.startingCredits ?? plan.starting_credits ?? 0));
    if (!userId || normalizedTier === 'free' || !amount) return { granted: false, amount: 0 };
    const reference = `package:${normalizedTier}`;
    const existing = await supabase
        .from('wallet_transactions')
        .select('id, balance_after')
        .eq('user_id', userId)
        .eq('wallet_type', 'credit')
        .eq('source', 'package_starting_credits')
        .eq('reference', reference)
        .limit(1)
        .maybeSingle();
    if (existing.data?.id) return { granted: false, alreadyGranted: true, amount, balanceAfter: existing.data.balance_after ?? null };
    if (existing.error && existing.error.code !== 'PGRST116') {
        return { granted: false, amount, error: existing.error.message };
    }

    await supabase.from('credit_wallet').upsert({ user_id: userId }, { onConflict: 'user_id' });
    const { data: wallet } = await supabase.from('credit_wallet').select('credits').eq('user_id', userId).maybeSingle();
    const current = Number(wallet?.credits || 0);
    const next = current + amount;
    const walletUpdate = await supabase.from('credit_wallet').update({ credits: next, updated_at: new Date().toISOString() }).eq('user_id', userId);
    if (walletUpdate.error) return { granted: false, amount, error: walletUpdate.error.message };

    const payload = {
        user_id: userId,
        wallet_type: 'credit',
        direction: 'credit',
        amount,
        balance_after: next,
        source: 'package_starting_credits',
        status: 'posted',
        reference,
        admin_note: `${plan.name || planName(normalizedTier)} starter credits`,
        metadata: { tier: normalizedTier },
    };
    let tx = await supabase.from('wallet_transactions').insert(payload).select('id').maybeSingle();
    if (tx.error && ['42703', 'PGRST204'].includes(tx.error.code)) {
        const fallbackPayload = { ...payload };
        delete fallbackPayload.metadata;
        tx = await supabase.from('wallet_transactions').insert(fallbackPayload).select('id').maybeSingle();
    }
    if (tx.error) return { granted: false, amount, balanceAfter: next, error: tx.error.message };
    return { granted: true, amount, balanceAfter: next, transactionId: tx.data?.id || null };
}

async function safeInsertMany(supabase, table, rows) {
    if (!rows?.length) return;
    try { await supabase.from(table).insert(rows); } catch {}
}

async function safeDeleteByColumn(supabase, table, column, value) {
    if (!value) return;
    try { await supabase.from(table).delete().eq(column, value); } catch {}
}

async function rememberDeletedAccount(supabase, { email, userId }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) return false;
    try {
        const result = await supabase.from('account_deletions').upsert({
            email_hash: hashEmail(cleanEmail),
            user_id: userId || null,
            deleted_at: new Date().toISOString(),
        }, { onConflict: 'email_hash' });
        return !result.error;
    } catch {
        return false;
    }
}

async function findAuthUserByEmail(supabase, email) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) return null;
    try {
        for (let page = 1; page <= 20; page++) {
            const result = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
            if (result.error) return null;
            const found = (result.data?.users || []).find((user) => String(user.email || '').trim().toLowerCase() === cleanEmail);
            if (found) return found;
            if ((result.data?.users || []).length < 1000) break;
        }
    } catch {}
    return null;
}

async function deleteAuthUserForAccount(supabase, account = {}) {
    if (account.auth_user_id) {
        try { await supabase.auth.admin.deleteUser(account.auth_user_id); return account.auth_user_id; } catch {}
    }
    const authUser = await findAuthUserByEmail(supabase, account.email);
    if (authUser?.id) {
        try { await supabase.auth.admin.deleteUser(authUser.id); return authUser.id; } catch {}
    }
    return null;
}

async function getUserById(supabase, userId) {
    if (!userId) return null;
    const { data } = await supabase.from('users').select('id, email, display_name, subscription_tier').eq('id', userId).maybeSingle();
    return data || null;
}

async function getPackageRequest(supabase, requestId) {
    if (!requestId) return null;
    const { data } = await supabase.from('package_requests').select('id, user_id, email, display_name, tier, amount_ksh, payment_reference').eq('id', requestId).maybeSingle();
    return data || null;
}

async function updateUser(supabase, userId, patch, select = 'id, display_name, email, verified, verification_status, admin_approved, subscription_tier, package_locked, show_in_public, is_suspended, is_banned') {
    const { data, error } = await supabase.from('users').update(patch).eq('id', userId).select(select).maybeSingle();
    if (error) return { error };
    return { data };
}

async function getVerificationCandidate(supabase, userId) {
    if (!userId) return null;
    const { data } = await supabase
        .from('users')
        .select('id, avatar_url, photos, verification_selfie_url, verification_document_url, verification_phone, phone, phone_number')
        .eq('id', userId)
        .maybeSingle();
    return data || null;
}

async function notifyUser(supabase, userId, { type = 'admin', title, body, emailSubject }) {
    const user = await getUserById(supabase, userId);
    if (!user) return { user: null, email: null };
    await queueUserNotification(supabase, { user_id: user.id, type, title, body });
    const email = user.email ? await queueEmail(supabase, { to_email: user.email, subject: emailSubject || title, body }) : null;
    return { user, email };
}

async function resolveRequestUser(supabase, request) {
    if (request?.user_id) return request.user_id;
    if (!request?.email) return null;
    const { data } = await supabase.from('users').select('id').eq('email', request.email).maybeSingle();
    return data?.id || null;
}

async function sendManyEmails(supabase, recipients, { subject, body }) {
    const results = await Promise.allSettled(
        recipients.filter((user) => user.email).map((user) => queueEmail(supabase, { to_email: user.email, subject, body }))
    );
    return results.filter((item) => item.status === 'fulfilled' && item.value?.ok).length;
}

export async function POST(request) {
    const body = await request.json().catch(() => ({}));

    if (body.action === 'login') {
        if (!adminAuthConfigured()) {
            // Fail closed. Previously this fell back to a password committed to source.
            return jsonError('Admin login is not configured on this deployment. Set ADMIN_EMAIL and ADMIN_PASSWORD_HASH.', 503);
        }

        const throttleKey = clientKey(request);
        if (loginThrottled(throttleKey)) {
            return jsonError('Too many failed attempts. Try again later.', 429);
        }

        if (!verifyAdminCredentials(body.email, body.password)) {
            recordLoginFailure(throttleKey);
            return jsonError('Invalid admin credentials.', 401);
        }

        const session = issueAdminSession();
        if (!session) return jsonError('Admin session secret is not configured.', 503);

        clearLoginFailures(throttleKey);
        // Token goes in an httpOnly cookie so page scripts cannot read it.
        const response = NextResponse.json({ ok: true, expiresIn: session.maxAge });
        response.cookies.set(ADMIN_COOKIE, session.token, adminCookieOptions(session.maxAge));
        return response;
    }

    if (body.action === 'logout') {
        const response = NextResponse.json({ ok: true });
        response.cookies.set(ADMIN_COOKIE, '', adminCookieOptions(0));
        return response;
    }

    if (!isAuthed(request)) return jsonError('Unauthorized.', 401);
    const supabase = createServerSupabaseClient({ admin: true });
    if (!supabase) return jsonError(ADMIN_ENV_MISSING, 503);

    const userId = body.userId;

    if (body.action === 'test_email') {
        const to = clean(body.to || 'principlessmart@gmail.com');
        const result = await queueEmail(supabase, {
            to_email: to,
            subject: body.subject || 'Hello World',
            body: body.message || 'Congrats on sending your first Genuine Sugar Mummies email.',
        });
        await writeLog(supabase, 'test_email', { to, ok: result.ok, error: result.error || null });
        if (!result.ok) return jsonError(result.error || 'Email failed.', 500);
        return NextResponse.json({ ok: true, email: result });
    }

    if (body.action === 'approve_user') {
        const { tier, plan: fallbackPlan } = planFor(body.subscriptionTier || body.tier, 'basic');
        const plan = await packagePlanDetails(supabase, tier, fallbackPlan);
        const result = await updateUser(supabase, userId, {
            verified: true,
            verification_status: 'verified',
            admin_approved: true,
            subscription_tier: tier,
            package_locked: false,
            package_expires_at: body.packageExpiresAt || null,
            show_in_public: true,
            is_suspended: false,
            is_banned: false,
        });
        if (result.error) return jsonError(result.error.message);
        const creditGrant = await grantPackageStartingCredits(supabase, userId, tier, plan);
        await notifyUser(supabase, userId, {
            type: 'verification',
            title: 'Profile approved',
            body: `Your profile has been manually approved. Your ${plan.name} access is active after admin approval. Paid package messages are unlimited.${creditGrant.granted ? ` ${creditGrant.amount} GS Credits were added to your wallet.` : ''}`,
        });
        await writeLog(supabase, 'approve_user', { userId, tier, creditGrant });
        return NextResponse.json({ ok: true, user: result.data, plan, creditGrant });
    }

    if (body.action === 'approve_profile') {
        const result = await updateUser(supabase, userId, {
            show_in_public: true,
            is_suspended: false,
            is_banned: false,
        });
        if (result.error) return jsonError(result.error.message);
        await notifyUser(supabase, userId, {
            type: 'account',
            title: 'Profile is visible',
            body: 'Admin has allowed your completed profile to appear in the members section.',
        });
        await writeLog(supabase, 'approve_profile', { userId });
        return NextResponse.json({ ok: true, user: result.data });
    }

    if (body.action === 'approve_verification') {
        const candidate = await getVerificationCandidate(supabase, userId);
        const hasProfilePhoto = Boolean(candidate?.avatar_url || (Array.isArray(candidate?.photos) && candidate.photos[0]));
        const hasSubmission = Boolean(candidate?.verification_selfie_url && candidate?.verification_document_url && (candidate?.verification_phone || candidate?.phone || candidate?.phone_number));
        if (!hasProfilePhoto) return jsonError('Cannot approve badge. User must upload a profile picture first.', 400);
        if (!hasSubmission) return jsonError('Cannot approve badge. Selfie, ID/passport, and phone are required.', 400);
        const result = await updateUser(supabase, userId, {
            verified: true,
            verification_status: 'verified',
            verification_rejection_reason: '',
        });
        if (result.error) return jsonError(result.error.message);
        await notifyUser(supabase, userId, {
            type: 'verification',
            title: 'Verification approved',
            body: 'Admin Mary G has manually approved your selfie, ID/passport, and phone details. Your blue badge is active.',
        });
        await writeLog(supabase, 'approve_verification', { userId });
        return NextResponse.json({ ok: true, user: result.data });
    }

    if (body.action === 'reject_verification') {
        const reason = body.reason || 'Please upload clearer verification documents.';
        const result = await updateUser(supabase, userId, {
            verified: false,
            verification_status: 'rejected',
            verification_rejection_reason: reason,
            verification_selfie_url: '',
            verification_document_url: '',
            verification_document_type: '',
            verification_submitted_at: null,
        });
        if (result.error) return jsonError(result.error.message);
        await notifyUser(supabase, userId, { type: 'verification', title: 'Verification rejected', body: reason });
        await writeLog(supabase, 'reject_verification', { userId, reason });
        return NextResponse.json({ ok: true, user: result.data });
    }

    if (body.action === 'revoke_verification') {
        const result = await updateUser(supabase, userId, { verified: false, verification_status: 'reverify_required' });
        if (result.error) return jsonError(result.error.message);
        await notifyUser(supabase, userId, { type: 'verification', title: 'Verification revoked', body: 'Admin has revoked your verification. Please submit a new selfie, ID/passport, and phone number.' });
        await writeLog(supabase, 'revoke_verification', { userId });
        return NextResponse.json({ ok: true, user: result.data });
    }

    if (body.action === 'set_package') {
        const { tier, plan: fallbackPlan } = planFor(body.tier, 'free');
        const plan = await packagePlanDetails(supabase, tier, fallbackPlan);
        const locked = tier === 'free' ? false : body.locked === true;
        const result = await updateUser(supabase, userId, {
            subscription_tier: tier,
            admin_approved: true,
            package_locked: locked,
            phone_reveal_plan: plan.phoneReveal ? tier : 'silver',
            package_expires_at: body.packageExpiresAt || null,
        });
        if (result.error) return jsonError(result.error.message);
        const isFree = tier === 'free';
        const creditGrant = !locked ? await grantPackageStartingCredits(supabase, userId, tier, plan) : { granted: false, amount: 0 };
        await notifyUser(supabase, userId, {
            type: 'package',
            title: isFree ? 'Free account active' : `${plan.name} package ${locked ? 'locked' : 'updated'}`,
            body: isFree
                ? 'Your free account is active and visible after your profile is complete.'
                : (locked
                    ? 'Your package is locked by admin.'
                    : `Your ${plan.name} package is now active. Messages are unlimited on paid packages.${creditGrant.granted ? ` ${creditGrant.amount} GS Credits were added to your wallet.` : ''}`),
        });
        await writeLog(supabase, 'set_package', { userId, tier, locked, creditGrant });
        return NextResponse.json({ ok: true, user: result.data, plan, creditGrant });
    }

    if (body.action === 'lock_package' || body.action === 'unlock_package') {
        const locked = body.action === 'lock_package';
        const result = await updateUser(supabase, userId, { package_locked: locked });
        if (result.error) return jsonError(result.error.message);
        const tier = normalizeTierId(result.data?.subscription_tier);
        const plan = await packagePlanDetails(supabase, tier, PACKAGE_TIERS[tier]);
        const creditGrant = !locked ? await grantPackageStartingCredits(supabase, userId, tier, plan) : { granted: false, amount: 0 };
        await notifyUser(supabase, userId, {
            type: 'package',
            title: locked ? 'Package locked' : 'Package unlocked',
            body: locked
                ? 'Admin has locked your package access.'
                : `Admin has unlocked your package access. Paid package messages are unlimited.${creditGrant.granted ? ` ${creditGrant.amount} GS Credits were added to your wallet.` : ''}`,
        });
        await writeLog(supabase, body.action, { userId, tier, creditGrant });
        return NextResponse.json({ ok: true, user: result.data, plan, creditGrant });
    }

    if (body.action === 'show_user' || body.action === 'hide_user') {
        const show = body.action === 'show_user';
        const result = await updateUser(supabase, userId, { show_in_public: show });
        if (result.error) return jsonError(result.error.message);
        await writeLog(supabase, body.action, { userId });
        return NextResponse.json({ ok: true, user: result.data });
    }

    if (body.action === 'suspend_user' || body.action === 'ban_user') {
        const banned = body.action === 'ban_user';
        const result = await updateUser(supabase, userId, { is_suspended: true, is_banned: banned, show_in_public: false });
        if (result.error) return jsonError(result.error.message);
        await notifyUser(supabase, userId, { type: 'account', title: banned ? 'Account banned' : 'Account suspended', body: banned ? 'Your account has been banned by admin.' : 'Your account has been suspended by admin.' });
        await writeLog(supabase, body.action, { userId });
        return NextResponse.json({ ok: true, user: result.data });
    }

    if (body.action === 'restore_user' || body.action === 'unban_user') {
        const result = await updateUser(supabase, userId, { is_suspended: false, is_banned: false, show_in_public: true });
        if (result.error) return jsonError(result.error.message);
        await notifyUser(supabase, userId, { type: 'account', title: 'Account restored', body: 'Admin has restored your account access.' });
        await writeLog(supabase, body.action, { userId });
        return NextResponse.json({ ok: true, user: result.data });
    }

    if (body.action === 'delete_user_forever') {
        if (!userId) return jsonError('User id is required.', 400);
        let accountResult = await supabase.from('users').select('id, email, auth_user_id').eq('id', userId).maybeSingle();
        if (accountResult.error && ['42703', 'PGRST204'].includes(accountResult.error.code)) {
            accountResult = await supabase.from('users').select('id, email').eq('id', userId).maybeSingle();
        }
        if (accountResult.error) return jsonError(accountResult.error.message);
        if (!accountResult.data?.id) return NextResponse.json({ ok: true, deleted: false });
        const id = accountResult.data.id;
        const email = accountResult.data.email || '';
        await rememberDeletedAccount(supabase, { email, userId: id });
        await Promise.all([
            safeDeleteByColumn(supabase, 'user_settings', 'user_id', id),
            safeDeleteByColumn(supabase, 'user_notifications', 'user_id', id),
            safeDeleteByColumn(supabase, 'password_reset_codes', 'user_id', id),
            safeDeleteByColumn(supabase, 'password_reset_codes', 'email', email),
            safeDeleteByColumn(supabase, 'package_requests', 'user_id', id),
            safeDeleteByColumn(supabase, 'support_tickets', 'user_id', id),
            safeDeleteByColumn(supabase, 'ticket_responses', 'user_id', id),
            safeDeleteByColumn(supabase, 'user_daily_usage', 'user_id', id),
            safeDeleteByColumn(supabase, 'profile_views', 'viewed_id', id),
            safeDeleteByColumn(supabase, 'profile_views', 'viewer_id', id),
            safeDeleteByColumn(supabase, 'profile_boosts', 'user_id', id),
            safeDeleteByColumn(supabase, 'user_stories', 'user_id', id),
            safeDeleteByColumn(supabase, 'story_views', 'viewer_id', id),
            safeDeleteByColumn(supabase, 'story_likes', 'user_id', id),
            safeDeleteByColumn(supabase, 'member_likes', 'liker_id', id),
            safeDeleteByColumn(supabase, 'member_likes', 'liked_id', id),
            safeDeleteByColumn(supabase, 'user_follows', 'follower_id', id),
            safeDeleteByColumn(supabase, 'user_follows', 'following_id', id),
            safeDeleteByColumn(supabase, 'messages', 'sender_id', id),
            safeDeleteByColumn(supabase, 'messages', 'receiver_id', id),
            safeDeleteByColumn(supabase, 'message_attachments', 'owner_id', id),
            safeDeleteByColumn(supabase, 'voice_notes', 'owner_id', id),
            safeDeleteByColumn(supabase, 'conversations', 'user_one_id', id),
            safeDeleteByColumn(supabase, 'conversations', 'user_two_id', id),
            safeDeleteByColumn(supabase, 'call_sessions', 'caller_id', id),
            safeDeleteByColumn(supabase, 'call_sessions', 'receiver_id', id),
            safeDeleteByColumn(supabase, 'call_signals', 'sender_id', id),
            safeDeleteByColumn(supabase, 'call_events', 'actor_id', id),
            safeDeleteByColumn(supabase, 'live_streams', 'user_id', id),
            safeDeleteByColumn(supabase, 'live_viewers', 'user_id', id),
            safeDeleteByColumn(supabase, 'live_comments', 'user_id', id),
            safeDeleteByColumn(supabase, 'live_gifts', 'user_id', id),
            safeDeleteByColumn(supabase, 'wallet_transactions', 'user_id', id),
            safeDeleteByColumn(supabase, 'credit_wallet', 'user_id', id),
            safeDeleteByColumn(supabase, 'gift_wallet', 'user_id', id),
            safeDeleteByColumn(supabase, 'user_gift_inventory', 'user_id', id),
        ]);
        const deleted = await supabase.from('users').delete().eq('id', id);
        if (deleted.error) return jsonError(deleted.error.message);
        const deletedAuthUserId = await deleteAuthUserForAccount(supabase, { ...accountResult.data, email });
        await writeLog(supabase, 'delete_user_forever', { userId: id, emailHash: hashEmail(email), deletedAuthUserId });
        return NextResponse.json({ ok: true, deleted: true });
    }

    if (body.action === 'approve_package_request') {
        const requestRow = await getPackageRequest(supabase, body.requestId);
        const { tier, plan: fallbackPlan } = planFor(body.tier || body.subscriptionTier || requestRow?.tier, 'silver');
        const plan = await packagePlanDetails(supabase, tier, fallbackPlan);
        const targetUserId = userId || await resolveRequestUser(supabase, requestRow);
        let creditGrant = { granted: false, amount: 0 };
        if (targetUserId) {
            const result = await updateUser(supabase, targetUserId, {
                subscription_tier: tier,
                admin_approved: true,
                package_locked: false,
                phone_reveal_plan: plan.phoneReveal ? tier : 'silver',
                package_expires_at: body.packageExpiresAt || null,
            });
            if (result.error) return jsonError(result.error.message);
            creditGrant = await grantPackageStartingCredits(supabase, targetUserId, tier, plan);
            await notifyUser(supabase, targetUserId, {
                type: 'package',
                title: `${plan.name} package approved`,
                body: `Your KSh ${plan.price} payment has been approved. ${plan.name} package features are active with unlimited messages.${creditGrant.granted ? ` ${creditGrant.amount} GS Credits were added to your wallet.` : ''}`,
            });
        }
        if (body.requestId) {
            await supabase.from('package_requests').update({ status: 'approved', reviewed_at: new Date().toISOString(), admin_note: body.note || '' }).eq('id', body.requestId);
        }
        await writeLog(supabase, 'approve_package_request', { userId: targetUserId, requestId: body.requestId, tier, creditGrant });
        return NextResponse.json({ ok: true, userId: targetUserId, plan, creditGrant });
    }

    if (body.action === 'approve_wallet_transaction') {
        const txId = body.transactionId;
        if (!txId) return jsonError('Transaction id is required.', 400);
        const { data: tx, error: txError } = await supabase.from('wallet_transactions').select('*').eq('id', txId).maybeSingle();
        if (txError) return jsonError(txError.message);
        if (!tx?.id) return jsonError('Wallet transaction not found.', 404);
        if (tx.status === 'posted') return NextResponse.json({ ok: true, transaction: tx });
        const walletTable = tx.wallet_type === 'money' ? 'money_wallet' : 'credit_wallet';
        const balanceColumn = tx.wallet_type === 'money' ? 'balance_ksh' : 'credits';
        await supabase.from(walletTable).upsert({ user_id: tx.user_id }, { onConflict: 'user_id' });
        const { data: wallet } = await supabase.from(walletTable).select(balanceColumn).eq('user_id', tx.user_id).maybeSingle();
        const current = wallet?.[balanceColumn] || 0;
        const next = tx.direction === 'debit' ? Math.max(0, current - tx.amount) : current + tx.amount;
        await supabase.from(walletTable).update({ [balanceColumn]: next, updated_at: new Date().toISOString() }).eq('user_id', tx.user_id);
        const { data, error } = await supabase.from('wallet_transactions').update({ status: 'posted', balance_after: next, admin_note: body.note || tx.admin_note || '' }).eq('id', tx.id).select('*').maybeSingle();
        if (error) return jsonError(error.message);
        await notifyUser(supabase, tx.user_id, { type: 'wallet', title: 'Wallet top-up approved', body: `Your ${tx.wallet_type} wallet has been updated. New balance: ${next}.` });
        await writeLog(supabase, 'approve_wallet_transaction', { transactionId: tx.id, userId: tx.user_id, walletType: tx.wallet_type, amount: tx.amount, balanceAfter: next });
        return NextResponse.json({ ok: true, transaction: data });
    }

    if (body.action === 'reject_wallet_transaction') {
        const txId = body.transactionId;
        if (!txId) return jsonError('Transaction id is required.', 400);
        const { data, error } = await supabase.from('wallet_transactions').update({ status: 'rejected', admin_note: body.note || 'Rejected by admin.' }).eq('id', txId).select('*').maybeSingle();
        if (error) return jsonError(error.message);
        if (data?.user_id) await notifyUser(supabase, data.user_id, { type: 'wallet', title: 'Wallet top-up rejected', body: data.admin_note || 'Your wallet top-up request was rejected.' });
        await writeLog(supabase, 'reject_wallet_transaction', { transactionId: txId });
        return NextResponse.json({ ok: true, transaction: data });
    }

    if (body.action === 'adjust_wallet') {
        const targetUserId = userId;
        const walletType = String(body.walletType || 'credit');
        const amount = Math.max(0, Number(body.amount || 0));
        const direction = body.direction === 'debit' ? 'debit' : 'credit';
        if (!targetUserId || !amount) return jsonError('User and amount are required.', 400);
        const walletTable = walletType === 'money' ? 'money_wallet' : 'credit_wallet';
        const balanceColumn = walletType === 'money' ? 'balance_ksh' : 'credits';
        await supabase.from(walletTable).upsert({ user_id: targetUserId }, { onConflict: 'user_id' });
        const { data: wallet } = await supabase.from(walletTable).select(balanceColumn).eq('user_id', targetUserId).maybeSingle();
        const current = wallet?.[balanceColumn] || 0;
        const next = direction === 'debit' ? Math.max(0, current - amount) : current + amount;
        await supabase.from(walletTable).update({ [balanceColumn]: next, updated_at: new Date().toISOString() }).eq('user_id', targetUserId);
        const { data, error } = await supabase.from('wallet_transactions').insert({
            user_id: targetUserId,
            wallet_type: walletType,
            direction,
            amount,
            balance_after: next,
            source: 'admin_adjustment',
            status: 'posted',
            reference: body.reference || '',
            admin_note: body.note || '',
        }).select('*').maybeSingle();
        if (error) return jsonError(error.message);
        await notifyUser(supabase, targetUserId, { type: 'wallet', title: 'Wallet updated', body: `Admin updated your ${walletType} wallet. New balance: ${next}.` });
        await writeLog(supabase, 'adjust_wallet', { userId: targetUserId, walletType, direction, amount, balanceAfter: next });
        return NextResponse.json({ ok: true, transaction: data });
    }

    if (body.action === 'reject_package_request') {
        const requestRow = await getPackageRequest(supabase, body.requestId);
        const targetUserId = await resolveRequestUser(supabase, requestRow);
        await supabase.from('package_requests').update({ status: 'rejected', reviewed_at: new Date().toISOString(), admin_note: body.note || '' }).eq('id', body.requestId);
        if (targetUserId) await notifyUser(supabase, targetUserId, { type: 'package', title: 'Package payment rejected', body: body.note || 'Your payment reference could not be approved. Please contact admin for help.' });
        await writeLog(supabase, 'reject_package_request', { requestId: body.requestId, userId: targetUserId });
        return NextResponse.json({ ok: true });
    }

    if (body.action === 'create_broadcast') {
        const title = clean(body.title).slice(0, 140);
        const messageBody = clean(body.body).slice(0, 1200);
        if (!title || !messageBody) return jsonError('Broadcast title and message are required.', 400);
        const targetSegment = body.targetSegment || 'all';
        const { data: broadcastRow, error } = await supabase.from('broadcasts').insert({
            title,
            body: messageBody,
            target_segment: targetSegment,
            status: body.status || 'sent',
        }).select('id, title, body').maybeSingle();
        if (error) return jsonError(error.message);

        const { data: users } = await supabase.from('users').select('id, email, display_name, subscription_tier, profile_label, is_suspended, is_banned').limit(2000);
        const recipients = (users || []).filter((user) => !user.is_suspended && !user.is_banned && (targetSegment === 'all' || user.subscription_tier === targetSegment || user.profile_label === targetSegment));
        await safeInsertMany(supabase, 'user_notifications', recipients.map((user) => ({
            user_id: user.id,
            type: 'broadcast',
            title,
            body: messageBody,
            metadata: { broadcast_id: broadcastRow?.id || null, target_segment: targetSegment },
        })));
        const emailsSent = await sendManyEmails(supabase, recipients, { subject: title, body: messageBody });
        await writeLog(supabase, 'create_broadcast', { title, targetSegment, recipients: recipients.length, emailsSent });
        return NextResponse.json({ ok: true, recipients: recipients.length, emailsSent });
    }

    if (body.action === 'email_user') {
        const target = await getUserById(supabase, userId);
        if (!target?.email) return jsonError('User has no email address.', 400);
        const subject = clean(body.subject || 'Message from Genuine Sugar Mummies').slice(0, 160);
        const message = clean(body.message || body.body || 'Admin sent you a message.').slice(0, 1200);
        await queueUserNotification(supabase, { user_id: target.id, type: 'admin_email', title: subject, body: message });
        const email = await queueEmail(supabase, { to_email: target.email, subject, body: message });
        await writeLog(supabase, 'email_user', { userId, subject, ok: email.ok });
        if (!email.ok) return jsonError(email.error || 'Email failed.', 500);
        return NextResponse.json({ ok: true, email });
    }

    if (body.action === 'send_subscription_reminders') {
        const { data: users } = await supabase.from('users').select('id, email, display_name, subscription_tier, admin_approved, package_locked').limit(2000);
        const recipients = (users || []).filter((user) => user.email && (!user.admin_approved || user.package_locked || String(user.subscription_tier || 'free') === 'free'));
        await safeInsertMany(supabase, 'user_notifications', recipients.map((user) => ({
            user_id: user.id,
            type: 'subscription_reminder',
            title: 'Unlock premium access',
            body: 'Choose Basic, Silver, or Gold package and submit your payment reference for admin approval.',
        })));
        const emailsSent = await sendManyEmails(supabase, recipients, {
            subject: 'Unlock your Genuine Sugar Mummies package',
            body: 'Choose Basic, Silver, or Gold package in the app, send payment, paste your transaction ID, and admin will approve your package.',
        });
        await writeLog(supabase, 'send_subscription_reminders', { recipients: recipients.length, emailsSent });
        return NextResponse.json({ ok: true, recipients: recipients.length, emailsSent });
    }

    if (body.action === 'create_ticket') {
        const { error } = await supabase.from('support_tickets').insert({
            user_id: userId || null,
            subject: clean(body.subject || 'Admin note').slice(0, 160),
            body: clean(body.body).slice(0, 1200),
            message: clean(body.body).slice(0, 1200),
            status: body.status || 'open',
            priority: body.priority || 'normal',
        });
        if (error) return jsonError(error.message);
        await writeLog(supabase, 'create_ticket', { userId, subject: body.subject || '' });
        return NextResponse.json({ ok: true });
    }

    if (body.action === 'respond_ticket') {
        const ticketId = body.ticketId;
        const responseBody = clean(body.message || body.body).slice(0, 1200);
        if (!ticketId || responseBody.length < 2) return jsonError('Ticket and response message are required.', 400);
        const { data: ticketRow } = await supabase.from('support_tickets').select('id, user_id, subject').eq('id', ticketId).maybeSingle();
        const { error } = await supabase.from('ticket_responses').insert({ ticket_id: ticketId, body: responseBody, responder: 'admin' });
        if (error) return jsonError(error.message);
        await supabase.from('support_tickets').update({ status: 'answered' }).eq('id', ticketId);
        if (ticketRow?.user_id) await notifyUser(supabase, ticketRow.user_id, { type: 'ticket', title: `Support reply: ${ticketRow.subject || 'Ticket'}`, body: responseBody });
        await writeLog(supabase, 'respond_ticket', { ticketId });
        return NextResponse.json({ ok: true });
    }

    if (body.action === 'close_ticket') {
        const { error } = await supabase.from('support_tickets').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', body.ticketId);
        if (error) return jsonError(error.message);
        await writeLog(supabase, 'close_ticket', { ticketId: body.ticketId });
        return NextResponse.json({ ok: true });
    }

    if (body.action === 'delete_ticket') {
        const { error } = await supabase.from('support_tickets').delete().eq('id', body.ticketId);
        if (error) return jsonError(error.message);
        await writeLog(supabase, 'delete_ticket', { ticketId: body.ticketId });
        return NextResponse.json({ ok: true });
    }

    /**
     * Edit a package tier. This writes to `package_tiers`, which is the table
     * lib/packageAccess actually reads, so a change here takes effect on the next
     * request — no deploy, no restart.
     *
     * The older `update_limits` action below writes to `app_limits`, a single
     * global row that nothing in the entitlement path has ever consulted. It is
     * kept only for the ads and photo-count settings that still live there.
     */
    if (body.action === 'update_package_tier') {
        const tierId = normalizeTierId(body.tierId);
        if (!tierId) return jsonError('A valid tier id is required.', 400);

        const intOrNull = (value) => {
            if (value === '' || value === null || value === undefined) return null;
            const n = Number(value);
            return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : null;
        };

        // Only these columns are writable. Anything else in the body is ignored,
        // so a crafted request cannot set arbitrary fields.
        const patch = {
            name: clean(body.name).slice(0, 80) || undefined,
            tagline: String(body.tagline ?? '').slice(0, 140),
            price_ksh: intOrNull(body.priceKsh),
            phone_reveal: Boolean(body.phoneReveal),
            daily_message_limit: intOrNull(body.dailyMessageLimit),
            daily_gift_limit: intOrNull(body.dailyGiftLimit),
            daily_like_limit: intOrNull(body.dailyLikeLimit),
            daily_super_like_limit: intOrNull(body.dailySuperLikeLimit),
            daily_swipe_limit: intOrNull(body.dailySwipeLimit),
            daily_profile_view_limit: intOrNull(body.dailyProfileViewLimit),
            priority_visibility: Boolean(body.priorityVisibility),
            international_access: Boolean(body.internationalAccess),
            voice_video_access: Boolean(body.voiceVideoAccess),
            can_see_who_liked: Boolean(body.canSeeWhoLiked),
            can_see_who_viewed: Boolean(body.canSeeWhoViewed),
            can_send_voice_notes: Boolean(body.canSendVoiceNotes),
            can_send_images: Boolean(body.canSendImages),
            can_go_live: Boolean(body.canGoLive),
            can_send_gifts: Boolean(body.canSendGifts),
            can_use_nearby: Boolean(body.canUseNearby),
            max_gift_tier: intOrNull(body.maxGiftTier),
            starting_credits: intOrNull(body.startingCredits),
            is_active: body.isActive !== false,
            updated_at: new Date().toISOString(),
        };
        Object.keys(patch).forEach((key) => patch[key] === undefined && delete patch[key]);

        const { error } = await supabase.from('package_tiers').update(patch).eq('id', tierId);
        if (error) return jsonError(error.message);
        await writeLog(supabase, 'update_package_tier', { tierId, patch });
        return NextResponse.json({ ok: true, tierId });
    }

    if (body.action === 'update_limits') {
        const { error } = await supabase.from('app_limits').upsert({
            id: body.limitId || 'global',
            daily_message_limit: Number(body.dailyMessageLimit || 5),
            daily_gift_limit: Number(body.dailyGiftLimit || 20),
            max_photos_per_user: Number(body.maxPhotosPerUser || 6),
            require_manual_verification: body.requireManualVerification !== false,
            ads_enabled: Boolean(body.adsEnabled),
            updated_at: new Date().toISOString(),
        });
        if (error) return jsonError(error.message);
        await writeLog(supabase, 'update_limits', { limitId: body.limitId || 'global' });
        return NextResponse.json({ ok: true });
    }

    if (body.action === 'mark_message_read') {
        const { error } = await supabase.from('member_messages').update({ is_read: true }).eq('id', body.messageId);
        if (error) return jsonError(error.message);
        return NextResponse.json({ ok: true });
    }

    if (body.action === 'approve_call_request' || body.action === 'reject_call_request') {
        const status = body.action === 'approve_call_request' ? 'approved' : 'rejected';
        const { data: callRow, error } = await supabase
            .from('call_requests')
            .update({ status, reviewed_at: new Date().toISOString() })
            .eq('id', body.callId)
            .select('id, member_id, requester_name, call_type')
            .maybeSingle();
        if (error) return jsonError(error.message);
        if (callRow?.member_id) {
            await notifyUser(supabase, callRow.member_id, {
                type: 'call_request',
                title: status === 'approved' ? 'Call request approved' : 'Call request rejected',
                body: status === 'approved'
                    ? `Admin approved a ${callRow.call_type || 'voice'} call request from ${callRow.requester_name || 'a member'}.`
                    : `Admin rejected a ${callRow.call_type || 'voice'} call request from ${callRow.requester_name || 'a member'}.`,
            });
        }
        await writeLog(supabase, body.action, { callId: body.callId, status });
        return NextResponse.json({ ok: true, call: callRow });
    }

    return jsonError('Unsupported action.', 400);
}

export async function GET(request) {
    if (!isAuthed(request)) return jsonError('Unauthorized.', 401);
    const supabase = createServerSupabaseClient({ admin: true });
    if (!supabase) return jsonError(ADMIN_ENV_MISSING, 503);

    /*
      The users list, without the verification imagery.

      verification_selfie_url and verification_document_url were in this select,
      and they hold base64 data URLs rather than links: 296KB and 80KB
      respectively across 148 rows, which was 70% of a 538KB payload sent on
      every single panel load. Both belong to accounts that are already
      `verified`, so the images were being shipped to render a list that never
      displays them.

      They are still fetched for the verification queue below, where they are
      actually looked at, and that query is filtered to accounts awaiting review.
    */
    const usersFullSelect = 'id, username, email, display_name, avatar_url, photos, profile_label, member_category, looking_for, phone_number, phone, subscription_tier, package_locked, package_expires_at, verified, verification_status, verification_document_type, verification_phone, verification_submitted_at, verification_rejection_reason, admin_approved, show_in_public, is_seed_profile, is_live, latitude, longitude, geo_updated_at, is_suspended, is_banned, created_at, last_seen_at, followers_count, following_count, gifts_received_count, total_profile_views';
    let users = await safeSelect(supabase, 'users', usersFullSelect, { count: true, order: { column: 'created_at', ascending: false }, limit: 500 });
    if (users.error) {
        users = await safeSelect(supabase, 'users', 'id, email, display_name, avatar_url, profile_label, phone_number, subscription_tier, verified, verification_status, admin_approved, show_in_public, is_suspended, is_banned, created_at', { count: true, order: { column: 'created_at', ascending: false }, limit: 500 });
    }

    let messages = await safeSelect(supabase, 'member_messages', 'id, member_id, sender_key, sender_name, body, attachment_url, attachment_type, attachment_name, voice_url, is_read, created_at', { order: { column: 'created_at', ascending: false }, limit: 150 });
    if (messages.error) {
        messages = await safeSelect(supabase, 'member_messages', 'id, member_id, sender_key, sender_name, body, is_read, created_at', { order: { column: 'created_at', ascending: false }, limit: 150 });
    }
    const gifts = await safeSelect(supabase, 'member_gifts', 'id, member_id, sender_key, gift_name, emoji, message, created_at', { order: { column: 'created_at', ascending: false }, limit: 150 });
    const packageRequests = await safeSelect(supabase, 'package_requests', 'id, user_id, email, display_name, tier, amount_ksh, status, payment_reference, note, created_at, reviewed_at', { order: { column: 'created_at', ascending: false }, limit: 150 });
    let tickets = await safeSelect(supabase, 'support_tickets', 'id, user_id, subject, body, service, status, priority, created_at, closed_at', { order: { column: 'created_at', ascending: false }, limit: 150 });
    if (tickets.error) {
        tickets = await safeSelect(supabase, 'support_tickets', 'id, user_id, subject, body, status, priority, created_at, closed_at', { order: { column: 'created_at', ascending: false }, limit: 150 });
    }
    const broadcasts = await safeSelect(supabase, 'broadcasts', 'id, title, body, target_segment, status, created_at', { order: { column: 'created_at', ascending: false }, limit: 80 });
    const limits = await safeSelect(supabase, 'app_limits', 'id, daily_message_limit, daily_gift_limit, max_photos_per_user, require_manual_verification, ads_enabled, updated_at', { limit: 20 });
    const callRequests = await safeSelect(supabase, 'call_requests', 'id, member_id, requester_key, requester_name, call_type, status, note, created_at', { order: { column: 'created_at', ascending: false }, limit: 150 });
    const ticketResponses = await safeSelect(supabase, 'ticket_responses', 'id, ticket_id, responder, body, created_at', { order: { column: 'created_at', ascending: false }, limit: 150 });
    const notifications = await safeSelect(supabase, 'user_notifications', 'id, user_id, type, title, body, read, created_at', { order: { column: 'created_at', ascending: false }, limit: 150 });
    const emailOutbox = await safeSelect(supabase, 'email_outbox', 'id, to_email, subject, status, provider_response, created_at, sent_at', { order: { column: 'created_at', ascending: false }, limit: 150 });
    const walletTransactions = await safeSelect(supabase, 'wallet_transactions', 'id, user_id, wallet_type, direction, amount, balance_after, source, status, reference, admin_note, created_at', { order: { column: 'created_at', ascending: false }, limit: 150 });
    let giftCatalog = await safeSelect(supabase, 'gift_catalog', 'id, name, category, gif_url, icon_url, credit_cost, money_cost_ksh, tier, emoji, is_active, sort_order, created_at', { order: { column: 'sort_order', ascending: true }, limit: 150 });
    if (giftCatalog.error) {
        giftCatalog = await safeSelect(supabase, 'gift_catalog', 'id, name, category, gif_url, icon_url, credit_cost, money_cost_ksh, is_active, sort_order, created_at', { order: { column: 'sort_order', ascending: true }, limit: 150 });
    }
    const logs = await safeSelect(supabase, 'admin_logs', 'id, action, details, created_at', { order: { column: 'created_at', ascending: false }, limit: 150 });
    // The live entitlement configuration that lib/packageAccess reads.
    const packageTierResult = await safeSelect(supabase, 'package_tiers', '*', { order: { column: 'sort_order', ascending: true }, limit: 20 });
    const packageTierRows = packageTierResult.data || [];

    const rows = users.data || [];
    const accountSummary = (user = {}) => ({
        id: user.id || '',
        username: user.username || '',
        display_name: user.display_name || '',
        email: user.email || '',
        avatar_url: user.avatar_url || '',
        photos: Array.isArray(user.photos) ? user.photos : [],
        profile_label: user.profile_label || user.member_category || '',
        member_category: user.member_category || user.profile_label || '',
        looking_for: user.looking_for || '',
        phone_number: user.phone_number || user.phone || '',
        phone: user.phone || user.phone_number || '',
        subscription_tier: user.subscription_tier || 'free',
        package_locked: Boolean(user.package_locked),
        verified: Boolean(user.verified),
        verification_status: user.verification_status || '',
        is_suspended: Boolean(user.is_suspended),
        is_banned: Boolean(user.is_banned),
        show_in_public: user.show_in_public !== false,
        created_at: user.created_at || null,
        last_seen_at: user.last_seen_at || null,
    });
    const usersById = new Map(rows.map((user) => [user.id, user]));
    const usersByEmail = new Map(rows.filter((user) => user.email).map((user) => [String(user.email).toLowerCase(), user]));
    const findAccount = (item = {}) => {
        if (item.user_id && usersById.has(item.user_id)) return accountSummary(usersById.get(item.user_id));
        const email = String(item.email || item.to_email || '').toLowerCase();
        if (email && usersByEmail.has(email)) return accountSummary(usersByEmail.get(email));
        return null;
    };
    const now = Date.now();

    /*
      The verification queue, fetched separately with its imagery.

      The selfie and document columns hold base64 data URLs, so including them in
      the main users select meant shipping every stored image on every panel load
      — 376KB of it, for accounts that were already verified and would never be
      reviewed again. This query carries them for the handful of accounts that
      are actually waiting, which is the only place they are looked at.
    */
    const awaitingReview = rows.filter((u) => u.verification_status === 'pending_admin').map((u) => u.id);
    let verificationImages = new Map();
    if (awaitingReview.length) {
        const withImages = await safeSelect(supabase, 'users', 'id, verification_selfie_url, verification_document_url', { in: { column: 'id', values: awaitingReview }, limit: 100 });
        if (!withImages.error) verificationImages = new Map(withImages.data.map((u) => [u.id, u]));
    }
    const pendingVerificationRows = rows
        .filter((u) => u.verification_status === 'pending_admin')
        .map((u) => ({ ...u, ...(verificationImages.get(u.id) || {}) }))
        .filter((u) => u.verification_selfie_url || u.verification_document_url);
    const usersMissingPhotos = rows.filter((u) => !u.avatar_url && !(Array.isArray(u.photos) && u.photos[0]) && !u.is_banned && !u.is_suspended);
    const walletRows = walletTransactions.data.map((tx) => ({ ...tx, account: findAccount(tx) }));
    const pendingPackages = packageRequests.data.filter((r) => r.status === 'pending').map((request) => ({ ...request, account: findAccount(request) }));
    const pendingWalletTransactions = walletRows.filter((tx) => tx.status === 'pending');
    const openTickets = tickets.data.filter((ticket) => !['closed', 'deleted'].includes(String(ticket.status || '').toLowerCase())).map((ticket) => ({ ...ticket, account: findAccount(ticket) }));
    const unreadMessages = messages.data.filter((m) => !m.is_read);
    const pendingCalls = callRequests.data.filter((r) => r.status === 'pending');
    const newUsers = rows.filter((u) => !u.is_seed_profile && !String(u.email || '').startsWith('seed+') && u.created_at && now - new Date(u.created_at).getTime() < 7 * 24 * 60 * 60 * 1000);
    const missingUsernames = rows.filter((u) => !u.username);
    const tableIssueCount = [users, messages, gifts, packageRequests, tickets, broadcasts, limits, callRequests, ticketResponses, notifications, emailOutbox, walletTransactions, giftCatalog, logs].filter((result) => result.error).length;
    const seedProfiles = rows.filter((u) => u.is_seed_profile || String(u.email || '').startsWith('seed+'));
    const broadcastDrafts = broadcasts.data.filter((item) => String(item.status || '').toLowerCase() === 'draft');
    const limitsAttention = limits.error || !limits.data.length ? 1 : 0;
    const stats = {
        totalUsers: rows.length,
        newUsers: newUsers.length,
        missingUsernames: missingUsernames.length,
        seedProfiles: seedProfiles.length,
        pendingVerification: pendingVerificationRows.length,
        approvedUsers: rows.filter((u) => u.admin_approved || u.verified).length,
        suspendedUsers: rows.filter((u) => u.is_suspended || u.is_banned).length,
        bannedUsers: rows.filter((u) => u.is_banned).length,
        onlineUsers: rows.filter((u) => u.last_seen_at && now - new Date(u.last_seen_at).getTime() < 5 * 60 * 1000).length,
        offlineUsers: rows.filter((u) => !u.last_seen_at || now - new Date(u.last_seen_at).getTime() >= 5 * 60 * 1000).length,
        maleUsers: rows.filter((u) => ['sugar_daddy', 'toyboy'].includes(u.profile_label || u.member_category)).length,
        femaleUsers: rows.filter((u) => ['sugar_mummy', 'mistress'].includes(u.profile_label || u.member_category)).length,
        freeUsers: rows.filter((u) => !u.subscription_tier || u.subscription_tier === 'free').length,
        paidUsers: rows.filter((u) => ['basic', 'silver', 'gold', 'diamond'].includes(String(u.subscription_tier || '').toLowerCase())).length,
        unreadMessages: unreadMessages.length,
        pendingPackageRequests: pendingPackages.length,
        pendingWalletTransactions: pendingWalletTransactions.length,
        pendingCallRequests: pendingCalls.length,
        openTickets: openTickets.length,
        usersMissingPhotos: usersMissingPhotos.length,
        publicUsers: rows.filter((u) => u.show_in_public && !u.is_suspended && !u.is_banned).length,
        broadcastDrafts: broadcastDrafts.length,
        tableIssues: tableIssueCount,
    };
    const attentionItems = {
        users: stats.newUsers + stats.usersMissingPhotos + stats.missingUsernames + stats.suspendedUsers,
        seed: seedProfiles.length === 0 ? 1 : 0,
        verification: stats.pendingVerification,
        finance: stats.pendingPackageRequests + stats.pendingWalletTransactions,
        analytics: tableIssueCount,
        tickets: stats.openTickets,
        broadcast: broadcastDrafts.length,
        limits: limitsAttention,
        logs: stats.unreadMessages + stats.pendingCallRequests,
    };
    const attention = {
        ...attentionItems,
        total: Object.values(attentionItems).reduce((sum, value) => sum + Number(value || 0), 0),
    };

    return NextResponse.json({
        users: rows,
        stats,
        attention,
        // Built-in defaults, kept for the older read-only summaries below.
        packages: PACKAGE_TIERS,
        // The live, editable configuration. This is what enforcement reads, so it
        // is what the panel must show — the constant above is only a fallback and
        // showing it was why the panel appeared to display settings that had no
        // effect on the running product.
        packageTiers: packageTierRows,
        verificationRequests: pendingVerificationRows.map((user) => ({ ...user, account: accountSummary(user) })),
        messages: messages.data,
        gifts: gifts.data,
        packageRequests: pendingPackages,
        tickets: openTickets,
        broadcasts: broadcasts.data,
        limits: limits.data,
        callRequests: callRequests.data,
        ticketResponses: ticketResponses.data,
        notifications: notifications.data,
        emailOutbox: emailOutbox.data,
        walletTransactions: walletRows,
        giftCatalog: giftCatalog.data,
        logs: logs.data,
        tableErrors: {
            users: users.error,
            messages: messages.error,
            gifts: gifts.error,
            packageRequests: packageRequests.error,
            tickets: tickets.error,
            broadcasts: broadcasts.error,
            limits: limits.error,
            callRequests: callRequests.error,
            ticketResponses: ticketResponses.error,
            notifications: notifications.error,
            emailOutbox: emailOutbox.error,
            walletTransactions: walletTransactions.error,
            giftCatalog: giftCatalog.error,
            logs: logs.error,
        },
    });
}
