import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseAdmin';
import { accountRestrictionMessage, canUseFeature, dailyLimitForFeature, getUserPackageAccess, isAccountRestricted } from '@/lib/packageAccess';
import { requireMember } from '@/lib/authSession';
import { notifyMember } from '@/lib/notifyMember';
import { consumeQuota } from '@/lib/entitlementGuard';
import { FACILITATION_NOTICE, profileKindFor, requiresFacilitation } from '@/lib/profileKind';

const LIMIT_NOTICE = 'Daily quota reached. Subscribe to Basic, Silver, or Gold for unlimited messaging.';

function jsonError(message, status = 500) {
    return NextResponse.json({ error: message }, { status });
}

function pairIds(a, b) {
    return [a, b].sort();
}

/**
 * Delegates to the canonical guard. The copy that lived here counted with a
 * read-modify-write (raceable) and treated a query error as permission granted.
 */
async function enforceDailyLimit(supabase, userId, tier, kind, user = null) {
    const subject = user?.id ? user : { id: userId };
    return consumeQuota(supabase, subject, kind, { tier });
}

function parseDataUrl(dataUrl) {
    const match = String(dataUrl || '').match(/^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/);
    if (!match) return null;
    return { contentType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

async function uploadChatAsset(supabase, rawUrl, { ownerId, messageId, type, name }) {
    if (!rawUrl || !String(rawUrl).startsWith('data:')) return { publicUrl: rawUrl || '', path: '' };
    const parsed = parseDataUrl(rawUrl);
    if (!parsed || parsed.buffer.length > 6 * 1024 * 1024) return { publicUrl: rawUrl, path: '' };
    const extMap = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'audio/webm': 'webm',
        'audio/mp4': 'm4a',
        'audio/mpeg': 'mp3',
        'audio/wav': 'wav',
    };
    const ext = extMap[parsed.contentType] || 'bin';
    const cleanName = String(name || type || 'message').replace(/[^a-zA-Z0-9.-]/g, '-').slice(0, 80);
    const path = `${ownerId}/${messageId}-${cleanName}.${ext}`;
    try {
        const uploaded = await supabase.storage.from('message-attachments').upload(path, parsed.buffer, { contentType: parsed.contentType, upsert: false });
        if (uploaded.error) return { publicUrl: rawUrl, path: '' };
        const { data } = supabase.storage.from('message-attachments').getPublicUrl(path);
        return { publicUrl: data?.publicUrl || rawUrl, path };
    } catch {
        return { publicUrl: rawUrl, path: '' };
    }
}

async function getUser(supabase, userId) {
    if (!userId) return null;
    const { data } = await supabase
        .from('users')
        .select('id, display_name, avatar_url, photos, subscription_tier, admin_approved, package_locked, is_banned, is_suspended, account_deleted_at, last_seen_at, is_seed_profile')
        .eq('id', userId)
        .maybeSingle();
    return data || null;
}

async function ensureConversation(supabase, userId, peerId) {
    const [userOne, userTwo] = pairIds(userId, peerId);
    let result = await supabase
        .from('conversations')
        .select('id, user_one_id, user_two_id, status, last_message_at, created_at, updated_at')
        .eq('user_one_id', userOne)
        .eq('user_two_id', userTwo)
        .maybeSingle();
    if (result.error && result.error.code !== 'PGRST116') return { error: result.error };
    if (result.data?.id) return { data: result.data };
    const payload = { user_one_id: userOne, user_two_id: userTwo, status: 'active' };
    result = await supabase
        .from('conversations')
        .insert(payload)
        .select('id, user_one_id, user_two_id, status, last_message_at, created_at, updated_at')
        .maybeSingle();
    if (result.error && /user_id/i.test(result.error.message || '')) {
        result = await supabase
            .from('conversations')
            .insert({ ...payload, user_id: userId })
            .select('id, user_one_id, user_two_id, status, last_message_at, created_at, updated_at')
            .maybeSingle();
    }
    return result;
}

async function conversationRows(supabase, userId) {
    const { data, error } = await supabase
        .from('conversations')
        .select('id, user_one_id, user_two_id, status, last_message_at, updated_at, created_at')
        .or(`user_one_id.eq.${userId},user_two_id.eq.${userId}`)
        .order('updated_at', { ascending: false })
        .limit(100);
    if (error) return { error };
    const peers = [...new Set((data || []).map((row) => row.user_one_id === userId ? row.user_two_id : row.user_one_id).filter(Boolean))];
    const { data: users } = peers.length
        ? await supabase.from('users').select('id, display_name, avatar_url, photos, verified, last_seen_at, is_banned, is_suspended, account_deleted_at').in('id', peers)
        : { data: [] };
    const usersById = new Map((users || []).filter((user) => !isAccountRestricted(user)).map((user) => [user.id, user]));
    const conversationIds = (data || []).map((row) => row.id);
    const { data: messages } = conversationIds.length
        ? await supabase.from('messages').select('id, conversation_id, sender_id, body, message_type, status, read_at, created_at').in('conversation_id', conversationIds).order('created_at', { ascending: false }).limit(200)
        : { data: [] };
    const latestByConversation = new Map();
    const unreadByConversation = new Map();
    (messages || []).forEach((message) => {
        if (!latestByConversation.has(message.conversation_id)) latestByConversation.set(message.conversation_id, message);
        if (message.sender_id !== userId && !message.read_at) unreadByConversation.set(message.conversation_id, (unreadByConversation.get(message.conversation_id) || 0) + 1);
    });
    return {
        data: (data || []).map((row) => {
            const peerId = row.user_one_id === userId ? row.user_two_id : row.user_one_id;
            const peer = usersById.get(peerId) || {};
            if (!peer.id) return null;
            return {
                ...row,
                peer,
                peerId,
                latestMessage: latestByConversation.get(row.id) || null,
                unreadCount: unreadByConversation.get(row.id) || 0,
            };
        }).filter(Boolean),
    };
}

export async function GET(request) {
    const supabase = createServerSupabaseClient({ admin: true });
    if (!supabase) return jsonError('Supabase admin env missing.', 503);
    const { searchParams } = new URL(request.url);
    // Conversations are read as the signed-in member. Taking ?userId= from the
    // query allowed anyone to read another member's full message history.
    const { member, response } = await requireMember();
    if (response) return response;
    const userId = member.id;
    const peerId = searchParams.get('peerId');
    const viewer = await getUser(supabase, userId);
    if (!viewer?.id) return jsonError('Signed-in user was not found.', 404);
    if (isAccountRestricted(viewer)) return jsonError(accountRestrictionMessage(viewer), 403);

    if (!peerId) {
        const result = await conversationRows(supabase, userId);
        if (result.error) return jsonError(result.error.message);
        return NextResponse.json({ ok: true, conversations: result.data || [] });
    }

    const [user, peer] = await Promise.all([Promise.resolve(viewer), getUser(supabase, peerId)]);
    if (!user?.id || !peer?.id) return jsonError('User or member was not found.', 404);
    if (isAccountRestricted(peer)) return jsonError('This member is unavailable.', 404);
    const conversation = await ensureConversation(supabase, userId, peerId);
    if (conversation.error) return jsonError(conversation.error.message);
    const { data: messages, error } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, receiver_id, body, message_type, status, read_at, delivered_at, metadata, created_at')
        .eq('conversation_id', conversation.data.id)
        .order('created_at', { ascending: true })
        .limit(300);
    if (error) return jsonError(error.message);
    await supabase.from('messages').update({ read_at: new Date().toISOString(), status: 'read' }).eq('conversation_id', conversation.data.id).eq('receiver_id', userId).is('read_at', null);
    const access = await getUserPackageAccess(supabase, user);
    const messageLimit = dailyLimitForFeature(access.tier, 'messages');
    return NextResponse.json({
        ok: true,
        conversation: conversation.data,
        peer,
        messages: messages || [],
        canMessage: messageLimit === null || messageLimit > 0,
        packageAccess: access.tier,
    });
}

export async function POST(request) {
    const supabase = createServerSupabaseClient({ admin: true });
    if (!supabase) return jsonError('Supabase admin env missing.', 503);
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'send';
    // Sender is the signed-in member. body.userId let a caller send messages that
    // appeared to come from someone else.
    const { member, response } = await requireMember();
    if (response) return response;
    const userId = member.id;
    const peerId = body.peerId;
    if (!peerId) return jsonError('Peer is required.', 400);
    if (String(peerId) === String(userId)) return jsonError('You cannot message yourself.', 400);
    const [user, peer] = await Promise.all([getUser(supabase, userId), getUser(supabase, peerId)]);
    if (!user?.id || !peer?.id) return jsonError('User or member was not found.', 404);
    if (isAccountRestricted(user)) return jsonError(accountRestrictionMessage(user) || 'Your account cannot send messages.', 403);
    if (isAccountRestricted(peer)) return jsonError('This member is unavailable.', 404);
    // Server-side half of the facilitation rule. The UI hides the composer for
    // seeded and imported profiles, but the endpoint has to refuse as well —
    // nobody is behind these accounts to read the message.
    if (requiresFacilitation(profileKindFor(peer))) {
        return NextResponse.json({
            error: FACILITATION_NOTICE,
            code: 'FACILITATION_REQUIRED',
            requiresFacilitation: true,
        }, { status: 403 });
    }

    const conversation = await ensureConversation(supabase, userId, peerId);
    if (conversation.error) return jsonError(conversation.error.message);

    if (action === 'typing') {
        return NextResponse.json({ ok: true, conversationId: conversation.data.id });
    }

    if (action === 'reaction') {
        const messageId = body.messageId;
        const reaction = String(body.reaction || body.emoji || 'heart').slice(0, 24);
        if (!messageId) return jsonError('Message id is required.', 400);
        const { data: current, error: currentError } = await supabase
            .from('messages')
            .select('id, conversation_id, metadata')
            .eq('id', messageId)
            .eq('conversation_id', conversation.data.id)
            .maybeSingle();
        if (currentError) return jsonError(currentError.message);
        if (!current?.id) return jsonError('Message was not found.', 404);
        const metadata = current.metadata && typeof current.metadata === 'object' ? current.metadata : {};
        const reactions = metadata.reactions && typeof metadata.reactions === 'object' ? metadata.reactions : {};
        const users = Array.isArray(reactions[reaction]) ? reactions[reaction] : [];
        const nextUsers = users.includes(userId) ? users.filter((id) => id !== userId) : [...users, userId];
        const nextReactions = { ...reactions, [reaction]: nextUsers };
        Object.keys(nextReactions).forEach((key) => {
            if (!nextReactions[key]?.length) delete nextReactions[key];
        });
        const { data, error } = await supabase
            .from('messages')
            .update({ metadata: { ...metadata, reactions: nextReactions } })
            .eq('id', messageId)
            .select('id, metadata')
            .maybeSingle();
        if (error) return jsonError(error.message);
        return NextResponse.json({ ok: true, message: data });
    }

    const access = await getUserPackageAccess(supabase, user);

    const bodyText = String(body.message || body.body || '').trim().slice(0, 1200);
    const attachmentUrl = String(body.attachmentUrl || '').trim();
    const voiceUrl = String(body.voiceUrl || '').trim();
    const attachmentType = String(body.attachmentType || '').trim().slice(0, 40);
    const attachmentName = String(body.attachmentName || '').trim().slice(0, 120);
    if (!bodyText && !attachmentUrl && !voiceUrl) return jsonError('Message is empty.', 400);
    if (attachmentUrl && attachmentType === 'image' && !canUseFeature(access.tier, 'images')) {
        return NextResponse.json({ error: 'Image sharing requires Basic package or higher.', redirectTo: '/packages' }, { status: 402 });
    }
    if (attachmentUrl && attachmentType === 'gif' && !canUseFeature(access.tier, 'gifs')) {
        return NextResponse.json({ error: 'GIF sharing requires Silver package or higher.', redirectTo: '/packages' }, { status: 402 });
    }
    if (attachmentUrl && !['image', 'gif'].includes(attachmentType) && !canUseFeature(access.tier, 'voiceNotes')) {
        return NextResponse.json({ error: 'Media sharing requires Silver package or higher.', redirectTo: '/packages' }, { status: 402 });
    }
    if (voiceUrl && !canUseFeature(access.tier, 'voiceNotes')) {
        return NextResponse.json({ error: 'Voice notes require Silver package or higher.', redirectTo: '/packages' }, { status: 402 });
    }
    const quota = await enforceDailyLimit(supabase, userId, access.tier, 'messages');
    if (!quota.ok) return NextResponse.json({ error: quota.message || LIMIT_NOTICE, ...quota }, { status: quota.httpStatus || 402 });

    const messageType = voiceUrl ? 'voice_note' : attachmentType || 'text';
    const finalBody = bodyText || (voiceUrl ? 'Voice note' : attachmentType === 'image' ? 'Image message' : attachmentType === 'gif' ? `GIF: ${attachmentName || 'reaction'}` : 'Media message');
    const inserted = await supabase
        .from('messages')
        .insert({
            conversation_id: conversation.data.id,
            sender_id: userId,
            receiver_id: peerId,
            body: finalBody,
            content: finalBody,
            message_type: messageType,
            status: 'sent',
            delivered_at: new Date().toISOString(),
            metadata: {},
        })
        .select('id, conversation_id, sender_id, receiver_id, body, message_type, status, read_at, delivered_at, metadata, created_at')
        .maybeSingle();
    if (inserted.error) return jsonError(inserted.error.message);

    let metadata = {};
    if (attachmentUrl) {
        const uploaded = await uploadChatAsset(supabase, attachmentUrl, { ownerId: userId, messageId: inserted.data.id, type: attachmentType || 'attachment', name: attachmentName });
        metadata.attachment = { url: uploaded.publicUrl, path: uploaded.path, type: attachmentType || 'attachment', name: attachmentName };
        try {
            await supabase.from('message_attachments').insert({
                message_id: inserted.data.id,
                owner_id: userId,
                storage_path: uploaded.path,
                public_url: uploaded.publicUrl,
                attachment_type: attachmentType || 'attachment',
                file_name: attachmentName,
            });
        } catch {}
    }
    if (voiceUrl) {
        const uploaded = await uploadChatAsset(supabase, voiceUrl, { ownerId: userId, messageId: inserted.data.id, type: 'voice_note', name: 'voice-note' });
        const durationSeconds = Math.max(0, Number(body.voiceDurationSeconds || body.durationSeconds || 0));
        metadata.voice = { url: uploaded.publicUrl, path: uploaded.path, durationSeconds };
        try {
            await supabase.from('voice_notes').insert({
                message_id: inserted.data.id,
                owner_id: userId,
                storage_path: uploaded.path,
                public_url: uploaded.publicUrl,
                duration_seconds: durationSeconds,
            });
        } catch {}
    }
    if (Object.keys(metadata).length) {
        await supabase.from('messages').update({ metadata }).eq('id', inserted.data.id);
        inserted.data.metadata = metadata;
    }

    const now = new Date().toISOString();
    await supabase.from('conversations').update({ last_message_at: now, updated_at: now }).eq('id', conversation.data.id);
    // Notify in the app, and email if the recipient is away. A message nobody
    // is told about is the most common reason a conversation dies here.
    await notifyMember(supabase, {
        userId: peerId,
        type: 'member_message',
        title: `New message from ${user.display_name || 'Member'}`,
        body: inserted.data.body,
        metadata: { conversationId: conversation.data.id, senderId: userId, actionLink: `/messages/${userId}` },
        email: {
            template: 'message',
            data: { senderName: user.display_name || 'A member', preview: inserted.data.body },
        },
    });
    try {
        await supabase.from('admin_logs').insert({ action: 'chat_message_sent', details: { conversationId: conversation.data.id, senderId: userId, receiverId: peerId, messageType } });
    } catch {}

    return NextResponse.json({ ok: true, conversation: conversation.data, message: inserted.data });
}
