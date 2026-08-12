import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseAdmin';
import { accountRestrictionMessage, canUseFeature, dailyLimitForFeature, getUserPackageAccess, isAccountRestricted } from '@/lib/packageAccess';
import { emailHtml, sendAndLogEmail } from '@/lib/email';
import { requireMember } from '@/lib/authSession';
import { ADMIN_ENV_MISSING, SESSION_USER_MISSING } from '@/lib/copy';

function jsonError(message, status = 500) {
    return NextResponse.json({ error: message }, { status });
}

function isMissingColumn(error, columnName = '') {
    const text = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
    return text.includes('42703') || text.includes('pgrst204') || (columnName && text.includes(columnName.toLowerCase()));
}

/**
 * How long a stream may go without a heartbeat before it is treated as over.
 *
 * The host page beats every 25 seconds, so this tolerates two missed beats plus
 * latency. Set it much lower and a brief network stall kills a live stream; much
 * higher and a closed tab keeps advertising a host who left.
 */
const LIVE_HEARTBEAT_TIMEOUT_MS = 90 * 1000;

/**
 * Close streams whose host stopped reporting in.
 *
 * `end_stream` only runs if the host taps End Live. Closing the tab, losing the
 * network, or the browser discarding a backgrounded page all skip it — and the
 * row then sits in Live Now forever, advertising a host who is not there. That is
 * fabricated presence of exactly the kind the rest of the app had removed, and
 * it would have been the first thing a member noticed about the Live section.
 *
 * Returns the ids that were closed, so callers can drop them from a list they
 * have already fetched.
 */
async function sweepAbandonedStreams(supabase, rows) {
    const cutoff = Date.now() - LIVE_HEARTBEAT_TIMEOUT_MS;
    const stale = (rows || []).filter((row) => {
        if (!row?.id || row.is_active === false) return false;
        const beat = new Date(row.updated_at || row.started_at || row.created_at || 0).getTime();
        return Number.isFinite(beat) && beat < cutoff;
    });
    if (!stale.length) return new Set();

    const ids = stale.map((row) => row.id);
    const hostIds = [...new Set(stale.map((row) => row.host_id).filter(Boolean))];
    const endedAt = new Date().toISOString();
    const { error } = await supabase
        .from('live_streams')
        .update({ is_active: false, status: 'ended', ended_at: endedAt })
        .in('id', ids);
    if (error) {
        console.error('[live] could not close abandoned streams:', error.message);
        return new Set();
    }
    await supabase.from('live_viewers').delete().in('stream_id', ids);
    if (hostIds.length) await supabase.from('users').update({ is_live: false }).in('id', hostIds);
    return new Set(ids);
}

async function getUser(supabase, userId) {
    if (!userId) return null;
    const { data } = await supabase.from('users').select('id, display_name, avatar_url, photos, subscription_tier, admin_approved, package_locked, is_banned, is_suspended, account_deleted_at').eq('id', userId).maybeSingle();
    return data || null;
}

async function getGift(supabase, giftId) {
    if (!giftId) return null;
    const { data } = await supabase.from('gift_catalog').select('*').eq('id', giftId).maybeSingle();
    return data || null;
}

async function enforceGiftLimit(supabase, userId, tier) {
    const limit = dailyLimitForFeature(tier, 'gifts');
    if (limit === null || limit === undefined) return { ok: true, limit: null, remaining: null };
    if (limit <= 0) return { ok: false, limit, remaining: 0, message: 'Live gifts require a paid package with gift access.', redirectTo: '/packages' };
    const usageDate = new Date().toISOString().slice(0, 10);
    const result = await supabase
        .from('user_daily_usage')
        .select('id, count')
        .eq('user_id', userId)
        .eq('usage_date', usageDate)
        .eq('kind', 'gifts')
        .maybeSingle();
    if (result.error && result.error.code !== 'PGRST116') return { ok: true, limit, remaining: Math.max(0, limit - 1), skipped: true };
    const current = result.data?.count || 0;
    if (current >= limit) {
        return { ok: false, limit, used: current, remaining: 0, message: 'Your daily gift limit is exhausted. Upgrade your package for more gift access.', redirectTo: '/packages' };
    }
    if (result.data?.id) {
        await supabase.from('user_daily_usage').update({ count: current + 1, updated_at: new Date().toISOString() }).eq('id', result.data.id);
    } else {
        await supabase.from('user_daily_usage').insert({ user_id: userId, usage_date: usageDate, kind: 'gifts', count: 1 });
    }
    return { ok: true, limit, used: current + 1, remaining: Math.max(0, limit - current - 1) };
}

/**
 * Attach catalog artwork to gift rows.
 *
 * live_gifts records what was sent (gift_id, gift_name, credit_cost) but not how
 * it looks — the artwork belongs to the catalog and would go stale if copied.
 * The join is done here rather than in PostgREST because that would depend on
 * the foreign key's constraint name, which differs between deployments.
 */
async function withGiftArtwork(supabase, rows) {
    const ids = [...new Set(rows.map((row) => row.gift_id).filter(Boolean))];
    if (!ids.length) return rows;
    const { data, error } = await supabase.from('gift_catalog').select('id, name, icon_url, gif_url, emoji, tier').in('id', ids);
    if (error) {
        console.error('[live] gift catalog lookup failed:', error.message);
        return rows;
    }
    const byId = new Map((data || []).map((gift) => [gift.id, gift]));
    return rows.map((row) => {
        const gift = byId.get(row.gift_id);
        return {
            ...row,
            gift_name: row.gift_name || gift?.name || 'Gift',
            gift_visual: gift?.icon_url || gift?.gif_url || gift?.emoji || '',
            gift_tier: gift?.tier ?? null,
        };
    });
}

async function notifyFollowersLive(supabase, host, stream) {
    try {
        const { data: follows } = await supabase
            .from('user_follows')
            .select('follower_id, follower:users!user_follows_follower_id_fkey(id, email, display_name)')
            .eq('following_id', host.id)
            .limit(100);
        const followers = (follows || []).map((row) => row.follower).filter((follower) => follower?.id);
        if (!followers.length) return;
        const hostName = host.display_name || 'A member you follow';
        const streamTitle = stream.title || `${hostName} is live`;
        const title = `${hostName} is live now`;
        const body = `Hello {{accountName}},\n\n${hostName} is online now on Genuine Sugar Mummies.\n\nLive title: ${streamTitle}\n\nOpen the app to join the live room, watch, comment, like, and send gifts.`;
        await supabase.from('user_notifications').insert(followers.map((follower) => ({
            user_id: follower.id,
            type: 'followed_live',
            title,
            body: body.replace('{{accountName}}', follower.display_name || 'there'),
            metadata: { streamId: stream.id, hostId: host.id, actionLink: `/live/${stream.id}` },
        })));
        await Promise.all(followers.filter((follower) => follower.email).slice(0, 40).map((follower) => sendAndLogEmail(supabase, {
            to: follower.email,
            subject: title,
            text: body.replace('{{accountName}}', follower.display_name || 'there'),
            html: emailHtml(title, body.replace('{{accountName}}', follower.display_name || 'there'), {
                preview: `${hostName} is online now in GS Live.`,
                accountName: follower.display_name || 'GS Member',
                accountEmail: follower.email,
                onlineName: hostName,
                badge: 'Live alert',
                actionLabel: 'Join Live in GS App',
                actionUrl: `/live/${stream.id}`,
                secondaryActionLabel: 'Open Live section',
                secondaryActionUrl: '/live',
                metaRows: [
                    { label: 'Live host', value: hostName },
                    { label: 'Live title', value: streamTitle },
                    { label: 'Status', value: 'Online now' },
                ],
            }),
        })));
    } catch {}
}

export async function GET(request) {
    const supabase = createServerSupabaseClient({ admin: true });
    if (!supabase) return jsonError(ADMIN_ENV_MISSING, 503);
    const { searchParams } = new URL(request.url);
    const streamId = searchParams.get('streamId');

    if (streamId) {
        const [stream, comments, gifts, viewers] = await Promise.all([
            supabase.from('live_streams').select('*, host:users!live_streams_host_id_fkey(id, display_name, avatar_url, photos, verified, followers_count, is_banned, is_suspended, account_deleted_at)').eq('id', streamId).maybeSingle(),
            supabase.from('live_comments').select('*, user:users!live_comments_user_id_fkey(id, display_name, avatar_url, photos)').eq('stream_id', streamId).order('created_at', { ascending: true }).limit(100),
            supabase.from('live_gifts').select('*').eq('stream_id', streamId).order('created_at', { ascending: false }).limit(60),
            supabase.from('live_viewers').select('*', { count: 'exact', head: true }).eq('stream_id', streamId),
        ]);
        if (stream.error) return jsonError(stream.error.message);
        if (!stream.data?.id) return jsonError('Live stream not found.', 404);
        if (!stream.data.host?.id || isAccountRestricted(stream.data.host)) return jsonError('Live stream not found.', 404);
        // A viewer opening the room directly must see the same truth as the list.
        const closedHere = await sweepAbandonedStreams(supabase, [stream.data]);
        const stillLive = !closedHere.has(stream.data.id) && stream.data.is_active !== false;
        return NextResponse.json({
            ok: true,
            stream: {
                ...stream.data,
                is_active: stillLive,
                status: stillLive ? stream.data.status : 'ended',
                viewer_count: viewers.count ?? stream.data.viewer_count ?? 0,
                total_comments: Math.max(Number(stream.data.total_comments || 0), (comments.data || []).length),
                total_gifts: Math.max(Number(stream.data.total_gifts || 0), (gifts.data || []).length),
                total_likes: stream.data.total_likes ?? 0,
            },
            comments: comments.data || [],
            gifts: await withGiftArtwork(supabase, gifts.data || []),
        });
    }

    let listResult = await supabase
        .from('live_streams')
        .select('*, host:users!live_streams_host_id_fkey(id, display_name, avatar_url, photos, verified, followers_count, is_banned, is_suspended, account_deleted_at)')
        .eq('is_active', true)
        .order('viewer_count', { ascending: false })
        .order('started_at', { ascending: false })
        .limit(50);
    if (listResult.error && isMissingColumn(listResult.error, 'is_active')) {
        listResult = await supabase
            .from('live_streams')
            .select('*, host:users!live_streams_host_id_fkey(id, display_name, avatar_url, photos, verified, followers_count, is_banned, is_suspended, account_deleted_at)')
            .order('created_at', { ascending: false })
            .limit(50);
        if (!listResult.error) {
            listResult.data = (listResult.data || []).filter((stream) => stream.status === 'active' || !stream.ended_at);
        }
    }
    const { data, error } = listResult;
    if (error) return jsonError(error.message);
    const closed = await sweepAbandonedStreams(supabase, data || []);
    const visibleStreams = (data || []).filter((stream) => (
        stream.host?.id && !isAccountRestricted(stream.host) && !closed.has(stream.id)
    ));
    const streams = await Promise.all(visibleStreams.map(async (stream) => {
        const [comments, gifts, viewers] = await Promise.all([
            supabase.from('live_comments').select('*', { count: 'exact', head: true }).eq('stream_id', stream.id),
            supabase.from('live_gifts').select('*', { count: 'exact', head: true }).eq('stream_id', stream.id),
            supabase.from('live_viewers').select('*', { count: 'exact', head: true }).eq('stream_id', stream.id),
        ]);
        return {
            ...stream,
            viewer_count: viewers.count ?? stream.viewer_count ?? 0,
            total_comments: Math.max(Number(stream.total_comments || 0), Number(comments.count || 0)),
            total_gifts: Math.max(Number(stream.total_gifts || 0), Number(gifts.count || 0)),
            total_likes: stream.total_likes ?? 0,
        };
    }));
    streams.sort((a, b) => (
        Number(b.viewer_count || 0) - Number(a.viewer_count || 0)
        || Number(b.total_likes || 0) - Number(a.total_likes || 0)
        || Number(b.total_gifts || 0) - Number(a.total_gifts || 0)
        || Number(b.total_comments || 0) - Number(a.total_comments || 0)
        || new Date(b.started_at || b.created_at || 0) - new Date(a.started_at || a.created_at || 0)
    ));
    /*
      Cached at the edge for 30 seconds.

      This list is identical for every viewer: it carries no session state and no
      per-member flags, unlike the stories feed (likedByMe, viewedByMe) or the
      packages endpoint (quota counts), which for that reason are left uncached.

      Every signed-in client polls this every 45 seconds, and it was answering
      "public, max-age=0, must-revalidate" with X-Vercel-Cache: MISS, so each
      poll invoked the function. With a 30 second edge cache most polls are
      served without one, which matters while the account is over its request
      allowance.

      30 seconds is well inside the 90 second heartbeat timeout, so a stream that
      ends is still reflected quickly, and the abandoned-stream sweep still runs
      at least twice a minute.
    */
    return NextResponse.json({ ok: true, streams }, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
}

export async function POST(request) {
    const supabase = createServerSupabaseClient({ admin: true });
    if (!supabase) return jsonError(ADMIN_ENV_MISSING, 503);
    const body = await request.json().catch(() => ({}));
    const action = body.action;
    // Host/actor is the signed-in member; body.userId let streams and stream
    // actions be performed under another member's identity.
    const { member, response } = await requireMember();
    if (response) return response;
    const userId = member.id;

    if (action === 'start_stream') {
        const host = await getUser(supabase, userId);
        if (!host?.id) return jsonError('Sign in before going live.', 401);
        if (isAccountRestricted(host)) return jsonError(accountRestrictionMessage(host), 403);
        const access = await getUserPackageAccess(supabase, host);
        if (!canUseFeature(access.tier, 'live')) return NextResponse.json({ error: 'Going live requires Silver package or higher.', redirectTo: '/packages' }, { status: 402 });
        let existing = await supabase.from('live_streams').select('*').eq('host_id', userId).eq('is_active', true).order('started_at', { ascending: false }).limit(1).maybeSingle();
        if (existing.error && isMissingColumn(existing.error, 'is_active')) {
            existing = await supabase.from('live_streams').select('*').eq('host_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
            if (existing.data?.ended_at || existing.data?.status === 'ended') existing.data = null;
        }
        if (existing.error) return jsonError(existing.error.message);
        if (existing.data?.id) return NextResponse.json({ ok: true, stream: existing.data });
        const startedAt = new Date().toISOString();
        const { data, error } = await supabase.from('live_streams').insert({
            host_id: userId,
            title: String(body.title || `${host.display_name || 'Member'} is live`).slice(0, 120),
            is_active: true,
            // started_at was never set, so every stream reported a duration
            // counted from the epoch or from nothing at all. updated_at doubles as
            // the first heartbeat.
            started_at: startedAt,
            updated_at: startedAt,
            viewer_count: 0,
            total_gifts: 0,
            total_coins: 0,
            total_likes: 0,
            total_comments: 0,
            total_views: 0,
        }).select('*').maybeSingle();
        if (error && isMissingColumn(error)) {
            const fallback = await supabase.from('live_streams').insert({
                host_id: userId,
                title: String(body.title || `${host.display_name || 'Member'} is live`).slice(0, 120),
            }).select('*').maybeSingle();
            if (fallback.error) return jsonError(fallback.error.message);
            await supabase.from('users').update({ is_live: true }).eq('id', userId);
            await notifyFollowersLive(supabase, host, fallback.data);
            return NextResponse.json({ ok: true, stream: fallback.data });
        }
        if (error) return jsonError(error.message);
        await supabase.from('users').update({ is_live: true }).eq('id', userId);
        await notifyFollowersLive(supabase, host, data);
        return NextResponse.json({ ok: true, stream: data });
    }

    if (action === 'heartbeat') {
        // The host page calls this on a timer for as long as it is broadcasting.
        // `updated_at` is the liveness signal sweepAbandonedStreams reads.
        const streamId = body.streamId;
        if (!streamId) return jsonError('Stream is required.', 400);
        const { data, error } = await supabase
            .from('live_streams')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', streamId)
            .eq('host_id', userId)
            .eq('is_active', true)
            .select('id')
            .maybeSingle();
        if (error) return jsonError(error.message);
        // No row means the stream was already closed — tell the host so its page
        // can stop pretending to broadcast.
        return NextResponse.json({ ok: true, live: Boolean(data?.id) });
    }

    if (action === 'end_stream') {
        const streamId = body.streamId;
        if (!streamId || !userId) return jsonError('Stream and host are required.', 400);
        let { data, error } = await supabase.from('live_streams').update({ is_active: false, ended_at: new Date().toISOString(), status: 'ended' }).eq('id', streamId).eq('host_id', userId).select('*').maybeSingle();
        if (error && isMissingColumn(error)) {
            const fallback = await supabase.from('live_streams').update({ status: 'ended' }).eq('id', streamId).eq('host_id', userId).select('*').maybeSingle();
            data = fallback.data;
            error = fallback.error;
        }
        if (error) return jsonError(error.message);
        await supabase.from('users').update({ is_live: false }).eq('id', userId);
        await supabase.from('live_viewers').delete().eq('stream_id', streamId);
        return NextResponse.json({ ok: true, stream: data });
    }

    if (action === 'join_stream' || action === 'leave_stream') {
        const streamId = body.streamId;
        if (!streamId || !userId) return jsonError('Stream and user are required.', 400);
        if (action === 'join_stream') {
            const viewer = await getUser(supabase, userId);
            if (!viewer?.id) return jsonError(SESSION_USER_MISSING, 404);
            if (isAccountRestricted(viewer)) return jsonError(accountRestrictionMessage(viewer), 403);
            const { data: streamRow } = await supabase.from('live_streams').select('host_id, total_views').eq('id', streamId).maybeSingle();
            const streamHost = streamRow?.host_id ? await getUser(supabase, streamRow.host_id) : null;
            if (!streamHost?.id || isAccountRestricted(streamHost)) return jsonError('Live stream not found.', 404);
            const existingViewer = await supabase.from('live_viewers').select('user_id').eq('stream_id', streamId).eq('user_id', userId).maybeSingle();
            const { error } = await supabase.from('live_viewers').upsert({ stream_id: streamId, user_id: userId, joined_at: new Date().toISOString() }, { onConflict: 'stream_id,user_id' });
            if (error) return jsonError(error.message);
            if (!existingViewer.data?.user_id) {
                const nextTotalViews = Number(streamRow?.total_views || 0) + 1;
                const viewUpdate = await supabase.from('live_streams').update({ total_views: nextTotalViews }).eq('id', streamId).select('id').maybeSingle();
                if (viewUpdate.error && ['42703', 'PGRST204'].includes(viewUpdate.error.code)) {
                    await supabase.from('live_streams').update({ viewer_count: 1 }).eq('id', streamId).select('id').maybeSingle();
                }
                if (streamRow?.host_id && streamRow.host_id !== userId) {
                    const { data: hostStats } = await supabase.from('users').select('total_profile_views').eq('id', streamRow.host_id).maybeSingle();
                    if (hostStats) await supabase.from('users').update({ total_profile_views: Number(hostStats.total_profile_views || 0) + 1 }).eq('id', streamRow.host_id);
                }
            }
        } else {
            await supabase.from('live_viewers').delete().eq('stream_id', streamId).eq('user_id', userId);
        }
        const { count } = await supabase.from('live_viewers').select('*', { count: 'exact', head: true }).eq('stream_id', streamId);
        await supabase.from('live_streams').update({ viewer_count: count || 0 }).eq('id', streamId);
        return NextResponse.json({ ok: true, viewerCount: count || 0 });
    }

    if (action === 'send_comment') {
        const content = String(body.content || '').trim().slice(0, 220);
        if (!body.streamId || !userId || !content) return jsonError('Comment details are required.', 400);
        const commenter = await getUser(supabase, userId);
        if (!commenter?.id) return jsonError(SESSION_USER_MISSING, 404);
        if (isAccountRestricted(commenter)) return jsonError(accountRestrictionMessage(commenter), 403);
        const { data: streamRow } = await supabase.from('live_streams').select('host_id').eq('id', body.streamId).maybeSingle();
        const host = streamRow?.host_id ? await getUser(supabase, streamRow.host_id) : null;
        if (!host?.id || isAccountRestricted(host)) return jsonError('Live stream not found.', 404);
        // The column is `body`, not `content`. Every live comment insert failed
        // with 42703, so the live chat could never receive a message.
        const { data, error } = await supabase.from('live_comments').insert({ stream_id: body.streamId, user_id: userId, body: content }).select('*').maybeSingle();
        if (error) return jsonError(error.message);
        return NextResponse.json({ ok: true, comment: data });
    }

    if (action === 'like_stream') {
        const streamId = body.streamId;
        if (!streamId || !userId) return jsonError('Stream and user are required.', 400);
        const liker = await getUser(supabase, userId);
        if (!liker?.id) return jsonError(SESSION_USER_MISSING, 404);
        if (isAccountRestricted(liker)) return jsonError(accountRestrictionMessage(liker), 403);
        let { data: streamRow, error: streamError } = await supabase.from('live_streams').select('id, host_id, total_likes').eq('id', streamId).maybeSingle();
        if (streamError && ['42703', 'PGRST204'].includes(streamError.code)) {
            const fallback = await supabase.from('live_streams').select('id, host_id').eq('id', streamId).maybeSingle();
            streamRow = fallback.data;
            streamError = fallback.error;
        }
        if (streamError) return jsonError(streamError.message);
        if (!streamRow?.id) return jsonError('Live stream not found.', 404);
        const host = streamRow.host_id ? await getUser(supabase, streamRow.host_id) : null;
        if (!host?.id || isAccountRestricted(host)) return jsonError('Live stream not found.', 404);
        const nextLikes = Number(streamRow.total_likes || 0) + 1;
        const update = await supabase.from('live_streams').update({ total_likes: nextLikes }).eq('id', streamId).select('id, total_likes').maybeSingle();
        if (update.error && ['42703', 'PGRST204'].includes(update.error.code)) return NextResponse.json({ ok: true, totalLikes: nextLikes, persisted: false });
        if (update.error) return jsonError(update.error.message);
        return NextResponse.json({ ok: true, totalLikes: update.data?.total_likes ?? nextLikes, persisted: true });
    }

    if (action === 'send_gift') {
        if (!body.streamId || !userId || !body.giftId) return jsonError('Gift details are required.', 400);
        const [sender, streamResult] = await Promise.all([
            getUser(supabase, userId),
            supabase.from('live_streams').select('id, host_id').eq('id', body.streamId).maybeSingle(),
        ]);
        if (!streamResult.data?.id) return jsonError('Live stream not found.', 404);
        if (!sender?.id) return jsonError(SESSION_USER_MISSING, 404);
        if (isAccountRestricted(sender)) return jsonError(accountRestrictionMessage(sender), 403);
        const host = streamResult.data?.host_id ? await getUser(supabase, streamResult.data.host_id) : null;
        if (!host?.id || isAccountRestricted(host)) return jsonError('Live stream not found.', 404);
        const access = await getUserPackageAccess(supabase, sender);
        if (!canUseFeature(access.tier, 'gifts')) return NextResponse.json({ error: 'Live gifts require a package with gift access.', redirectTo: '/packages' }, { status: 402 });
        const gift = await getGift(supabase, body.giftId);
        if (!gift?.id) return jsonError('Gift not found.', 404);
        if (Number(gift.tier || 1) > Number(access.tier.max_gift_tier || 0)) {
            return NextResponse.json({ error: `${gift.name} requires a higher package tier.`, redirectTo: '/packages' }, { status: 402 });
        }
        const { data: wallet } = await supabase.from('credit_wallet').select('credits').eq('user_id', userId).maybeSingle();
        const credits = wallet?.credits || 0;
        const cost = gift.credit_cost || 0;
        if (credits < cost) return NextResponse.json({ error: 'Not enough credits for this live gift.', redirectTo: '/wallet' }, { status: 402 });
        const quota = await enforceGiftLimit(supabase, userId, access.tier);
        if (!quota.ok) return NextResponse.json({ error: quota.message, ...quota }, { status: 402 });

        // Record the gift first, debit second.
        //
        // This was the other way round, against columns that do not exist
        // (`gift_visual`, `gift_cost`; the table has `gift_id` and
        // `credit_cost`). So the debit succeeded, the insert failed with 42703,
        // and the member lost the credits and got no gift. Writing the row first
        // means a failure costs nothing, and the debit below is the only step
        // left that can go wrong.
        const { data, error } = await supabase.from('live_gifts').insert({
            stream_id: body.streamId,
            sender_id: userId,
            gift_id: gift.id,
            gift_name: gift.name,
            credit_cost: cost,
        }).select('*').maybeSingle();
        if (error) return jsonError(error.message);

        const debit = await supabase
            .from('credit_wallet')
            .update({ credits: credits - cost, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .gte('credits', cost)
            .select('credits')
            .maybeSingle();
        if (debit.error || !debit.data) {
            // Balance moved underneath us, or the debit failed. Roll the gift back
            // rather than hand out a free one.
            await supabase.from('live_gifts').delete().eq('id', data.id);
            return NextResponse.json({ error: 'Not enough credits for this live gift.', redirectTo: '/wallet' }, { status: 402 });
        }
        if (streamResult.data?.host_id) {
            const counter = await supabase.from('users').select('gifts_received_count').eq('id', streamResult.data.host_id).maybeSingle();
            if (counter.data) await supabase.from('users').update({ gifts_received_count: Number(counter.data.gifts_received_count || 0) + 1 }).eq('id', streamResult.data.host_id);
        }
        await supabase.from('wallet_transactions').insert({ user_id: userId, wallet_type: 'credit', direction: 'debit', amount: cost, balance_after: credits - cost, source: 'live_gift', status: 'posted', reference: data?.id || '', metadata: { giftId: gift.id, streamId: body.streamId } });
        return NextResponse.json({ ok: true, gift: data, catalogGift: gift, credits: credits - cost });
    }

    return jsonError('Unsupported live action.', 400);
}
