import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseAdmin';
import { requireMember } from '@/lib/authSession';
import { REPORT_REASON_IDS } from '@/lib/blocks';
import { ADMIN_ENV_MISSING } from '@/lib/copy';

/**
 * Blocking and reporting.
 *
 * Blocking is the member's own decision and applies the moment it is made.
 * Reporting is a message to the administrators and changes nothing by itself.
 * They are separate on purpose: somebody who wants to be left alone should not
 * have to wait for a human, and somebody reporting a scammer should not have to
 * block them to be heard.
 *
 * Nothing here tells the other person anything. A blocked member is not
 * notified, and a reported member is not told who reported them, because both
 * would make it dangerous to use.
 */

function jsonError(message, status = 500) {
    return NextResponse.json({ error: message }, { status });
}

/** GET — who this member has blocked, so the list can be reviewed and undone. */
export async function GET() {
    const supabase = createServerSupabaseClient({ admin: true });
    if (!supabase) return jsonError(ADMIN_ENV_MISSING, 503);

    const { member, response } = await requireMember();
    if (!member) return response;

    const { data, error } = await supabase
        .from('user_blocks')
        .select('id, blocked_id, reason, created_at, blocked:users!user_blocks_blocked_id_fkey(id, display_name, username, avatar_url, photos)')
        .eq('blocker_id', member.id)
        .order('created_at', { ascending: false });

    if (error) return jsonError('Could not load your blocked list.', 500);

    return NextResponse.json({
        ok: true,
        blocks: (data || []).map((row) => ({
            id: row.id,
            memberId: row.blocked_id,
            name: row.blocked?.display_name || row.blocked?.username || 'Member',
            avatarUrl: row.blocked?.avatar_url || (row.blocked?.photos || [])[0] || '',
            reason: row.reason || '',
            createdAt: row.created_at,
        })),
    }, {
        // Personal, and must never be served to anyone else.
        headers: { 'Cache-Control': 'private, no-store' },
    });
}

export async function POST(request) {
    const supabase = createServerSupabaseClient({ admin: true });
    if (!supabase) return jsonError(ADMIN_ENV_MISSING, 503);

    const { member, response } = await requireMember();
    if (!member) return response;

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '').trim();
    const targetId = String(body.targetId || '').trim();

    if (!targetId) return jsonError('A member is required.', 400);
    if (targetId === member.id) return jsonError('You cannot do that to your own account.', 400);

    // Confirm the target exists before writing a row that references it, so a
    // mistyped id fails as "no such member" rather than as a database error.
    const { data: target } = await supabase
        .from('users')
        .select('id, display_name')
        .eq('id', targetId)
        .maybeSingle();
    if (!target) return jsonError('That member no longer exists.', 404);

    if (action === 'block') {
        const { error } = await supabase
            .from('user_blocks')
            .upsert(
                { blocker_id: member.id, blocked_id: targetId, reason: String(body.reason || '').slice(0, 200) },
                // Blocking somebody already blocked is not an error; the member
                // asked for them to be gone and they are.
                { onConflict: 'blocker_id,blocked_id' }
            );
        if (error) return jsonError('Could not block this member.', 500);
        return NextResponse.json({ ok: true, blocked: true });
    }

    if (action === 'unblock') {
        const { error } = await supabase
            .from('user_blocks')
            .delete()
            .eq('blocker_id', member.id)
            .eq('blocked_id', targetId);
        if (error) return jsonError('Could not unblock this member.', 500);
        return NextResponse.json({ ok: true, blocked: false });
    }

    if (action === 'report') {
        const reason = String(body.reason || 'other').trim();
        if (!REPORT_REASON_IDS.has(reason)) return jsonError('Choose a reason for the report.', 400);

        const { error } = await supabase.from('user_reports').insert({
            reporter_id: member.id,
            reported_id: targetId,
            reason,
            detail: String(body.detail || '').slice(0, 2000),
        });
        if (error) return jsonError('Could not send this report.', 500);

        /*
          Reporting someone almost always means you also want them gone, but it
          is still the member's choice: `alsoBlock` is passed by the form and a
          failure here must not lose the report, which is already saved.
        */
        if (body.alsoBlock) {
            await supabase
                .from('user_blocks')
                .upsert(
                    { blocker_id: member.id, blocked_id: targetId, reason: `Reported: ${reason}` },
                    { onConflict: 'blocker_id,blocked_id' }
                );
        }

        return NextResponse.json({ ok: true, reported: true, blocked: Boolean(body.alsoBlock) });
    }

    return jsonError('Unknown action.', 400);
}
