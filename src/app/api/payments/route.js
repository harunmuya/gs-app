import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseAdmin';
import { requireMember } from '@/lib/authSession';
import { getPackageTier, normalizeTierId } from '@/lib/packageAccess';

/**
 * Manual payment submission for M-Pesa and Airtel Money.
 *
 * The member pays to the published till or number, then submits the code from
 * their SMS receipt. An administrator confirms it against the statement and the
 * existing approval action grants the package.
 *
 * Writes to `package_requests` — the table the admin panel already reviews.
 * A separate payments table would have drifted from the one administrators
 * actually use, and this codebase has been bitten by exactly that more than once.
 *
 * What this adds over the previous free-text box:
 *
 *  1. Codes are validated against each provider's real format, so a typo is
 *     caught in a second rather than costing a review cycle.
 *  2. Codes are unique platform-wide. One receipt activates one account — a
 *     forwarded SMS cannot be reused, which was the easiest way to cheat the old
 *     flow and required no skill at all.
 *  3. Every submission is a record with a status the member can see, instead of
 *     disappearing into a queue with no acknowledgement.
 *
 * The amount is read from `package_tiers`. A browser-supplied amount would let
 * someone pair a 50-shilling receipt with a Gold purchase and hand the reviewer
 * paperwork that looks internally consistent.
 */

export const dynamic = 'force-dynamic';

const PURCHASABLE = ['basic', 'silver', 'gold'];

/**
 * Receipt formats.
 *
 * M-Pesa: 10 alphanumerics, e.g. SFJ4K2L9MN.
 * Airtel: reference length varies by product, so 8-20 rather than a stricter
 *         guess that would reject genuine payments.
 *
 * These catch typos and junk. They are not proof of payment — only the check
 * against the till statement is that, and the UI does not pretend otherwise.
 */
const CODE_RULES = {
    mpesa: { pattern: /^[A-Z0-9]{10}$/, hint: 'M-Pesa codes are 10 characters, like SFJ4K2L9MN.' },
    airtel: { pattern: /^[A-Z0-9]{8,20}$/, hint: 'Enter the reference from your Airtel Money SMS.' },
};

function cleanCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24);
}

export async function POST(request) {
    const supabase = createServerSupabaseClient({ admin: true });
    if (!supabase) return NextResponse.json({ error: 'Server is not configured.' }, { status: 503 });

    const { member, response } = await requireMember();
    if (response) return response;

    const body = await request.json().catch(() => ({}));
    const tierId = normalizeTierId(body.tierId);
    const provider = String(body.provider || '').toLowerCase();
    const code = cleanCode(body.transactionCode);

    if (!PURCHASABLE.includes(tierId)) return NextResponse.json({ error: 'Choose a package first.' }, { status: 400 });
    if (!CODE_RULES[provider]) return NextResponse.json({ error: 'Choose M-Pesa or Airtel Money.' }, { status: 400 });
    if (!code) return NextResponse.json({ error: 'Enter the transaction code from your payment SMS.' }, { status: 400 });
    if (!CODE_RULES[provider].pattern.test(code)) {
        return NextResponse.json({ error: CODE_RULES[provider].hint }, { status: 400 });
    }

    const tier = await getPackageTier(supabase, tierId);
    const amount = Math.round(Number(tier?.price_ksh || 0));
    if (amount < 1) return NextResponse.json({ error: 'This package has no price set. Contact support.' }, { status: 409 });

    // Already submitted — by this member or anyone else.
    const { data: existing } = await supabase
        .from('package_requests')
        .select('id, user_id, status')
        .ilike('payment_reference', code)
        .maybeSingle();

    if (existing) {
        const mine = String(existing.user_id) === String(member.id);
        return NextResponse.json({
            error: mine
                ? 'You have already submitted this code. It is being reviewed.'
                : 'That transaction code has already been used. Check the code on your SMS receipt.',
            code: 'DUPLICATE_CODE',
        }, { status: 409 });
    }

    const { data: created, error } = await supabase
        .from('package_requests')
        .insert({
            user_id: member.id,
            email: member.email || '',
            display_name: member.display_name || '',
            tier: tierId,
            amount_ksh: amount,
            provider,
            payment_reference: code,
            payer_phone: String(body.phone || '').replace(/[^\d+]/g, '').slice(0, 20),
            note: String(body.note || '').slice(0, 400),
            status: 'pending',
        })
        .select('id, status, created_at')
        .maybeSingle();

    if (error) {
        // The unique index still fires if two submissions race.
        if (error.code === '23505') {
            return NextResponse.json({ error: 'That transaction code has already been submitted.', code: 'DUPLICATE_CODE' }, { status: 409 });
        }
        console.error('[api/payments] insert failed:', error.message);
        return NextResponse.json({ error: 'Could not save your payment. Please try again.' }, { status: 500 });
    }

    try {
        await supabase.from('user_notifications').insert({
            user_id: member.id,
            type: 'package',
            title: 'Payment submitted',
            body: `We received your ${tier.name || tierId} payment reference ${code}. You will be notified once it is confirmed.`,
        });
    } catch {
        // A missing notification must not lose the payment record.
    }

    return NextResponse.json({ ok: true, request: created, message: 'Payment submitted. We will confirm it shortly.' });
}

/** The caller's own submissions, so the page can show real status. */
export async function GET() {
    const supabase = createServerSupabaseClient({ admin: true });
    if (!supabase) return NextResponse.json({ error: 'Server is not configured.' }, { status: 503 });

    const { member, response } = await requireMember();
    if (response) return response;

    let { data, error } = await supabase
        .from('package_requests')
        .select('id, tier, amount_ksh, provider, payment_reference, status, admin_note, created_at, reviewed_at')
        .eq('user_id', member.id)
        .order('created_at', { ascending: false })
        .limit(10);

    // Deployments that have not run migration 20260808_050 lack `provider`.
    // Degrade to the columns that have always existed rather than showing nothing.
    if (error && (error.code === '42703' || /does not exist/i.test(error.message || ''))) {
        ({ data } = await supabase
            .from('package_requests')
            .select('id, tier, amount_ksh, payment_reference, status, admin_note, created_at, reviewed_at')
            .eq('user_id', member.id)
            .order('created_at', { ascending: false })
            .limit(10));
    }

    const requests = (data || []).map((row) => ({
        id: row.id,
        tier_id: row.tier,
        amount: row.amount_ksh,
        provider: row.provider || 'mpesa',
        transaction_code: row.payment_reference,
        status: row.status,
        rejection_reason: row.status === 'rejected' ? (row.admin_note || '') : '',
        created_at: row.created_at,
        reviewed_at: row.reviewed_at,
    }));

    return NextResponse.json({ ok: true, requests }, { headers: { 'Cache-Control': 'private, no-store' } });
}
