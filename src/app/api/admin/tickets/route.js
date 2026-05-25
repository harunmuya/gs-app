import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

async function verifyAdmin() {
    const cookieStore = await cookies();
    const token = cookieStore.get('gs_admin_token')?.value;
    return token === 'authenticated-gs-admin';
}

// GET all tickets (admin) — reads from both DB + fallback ledger
export async function GET(request) {
    if (!await verifyAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const category = searchParams.get('category');

        let dbTickets = [];
        let ledgerTickets = [];

        // 1. Try querying the database
        try {
            let query = supabaseAdmin
                .from('support_tickets')
                .select('*, users(display_name, email, avatar_url, id)')
                .order('created_at', { ascending: false })
                .limit(100);

            if (status && status !== 'all') query = query.eq('status', status);
            if (category && category !== 'all') query = query.eq('category', category);

            const { data, error } = await query;
            if (!error && data) {
                dbTickets = data;
            }
        } catch {}

        // 2. Always read from fallback ledger too
        try {
            ledgerTickets = await getTicketsFromLedgerPopulated(status, category);
        } catch {}

        // 3. Merge and deduplicate by ID (ledger tickets first since they're the reliable source)
        const dbIds = new Set(dbTickets.map(t => t.id));
        const uniqueLedgerTickets = ledgerTickets.filter(t => !dbIds.has(t.id));
        const allTickets = [...uniqueLedgerTickets, ...dbTickets]
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        return NextResponse.json({ tickets: allTickets, source: { db: dbTickets.length, ledger: uniqueLedgerTickets.length } });
    } catch (err) {
        console.error('[Tickets GET]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST — reply to ticket or update status (admin)
export async function POST(request) {
    if (!await verifyAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { ticketId, status, adminReply } = body;

        if (!ticketId) return NextResponse.json({ error: 'Ticket ID required' }, { status: 400 });

        const updates = { updated_at: new Date().toISOString() };
        if (status) updates.status = status;
        if (adminReply) updates.admin_reply = adminReply;

        // ALWAYS update in fallback ledger first (reliable store)
        let ledgerUpdated = false;
        try {
            await updateTicketInLedger(ticketId, updates);
            ledgerUpdated = true;
        } catch (ledgerErr) {
            console.warn('[Admin Tickets POST] Ledger update failed:', ledgerErr.message);
        }

        // Then try updating in DB (best-effort)
        let dbUpdated = false;
        try {
            const { data, error } = await supabaseAdmin
                .from('support_tickets')
                .update(updates)
                .eq('id', ticketId)
                .select('*, users(display_name, email)')
                .single();

            if (!error && data) {
                dbUpdated = true;
                // Send notification to user if replied
                if (adminReply && data.user_id) {
                    await supabaseAdmin.from('notifications').insert({
                        user_id: data.user_id,
                        type: 'support',
                        sender: 'GS Support',
                        sender_image: '/gs-logo.png',
                        title: 'Support Reply',
                        body: `Your ticket "${data.subject}" has been responded to by our team. Status: ${updates.status || data.status}.`,
                        is_read: false,
                    }).catch(() => {});

                    // Also send actual reply message to user's chat!
                    const chatMessageText = `[Support Reply to "${data.subject}"]: ${adminReply}`;
                    await sendAdminChatMessage(supabaseAdmin, data.user_id, chatMessageText, 'GS Support', '/gs-logo.png').catch(() => {});
                }
            }
        } catch {}

        // If ledger was updated but DB wasn't, send notification from ledger data
        if (ledgerUpdated && !dbUpdated && adminReply) {
            try {
                const ticket = await findTicketInLedger(ticketId);
                if (ticket?.user_id) {
                    await supabaseAdmin.from('notifications').insert({
                        user_id: ticket.user_id,
                        type: 'support',
                        sender: 'GS Support',
                        sender_image: '/gs-logo.png',
                        title: 'Support Reply',
                        body: `Your ticket "${ticket.subject}" has been responded to by our team. Status: ${updates.status || ticket.status}.`,
                        is_read: false,
                    }).catch(() => {});

                    // Also send actual reply message to user's chat!
                    const chatMessageText = `[Support Reply to "${ticket.subject}"]: ${adminReply}`;
                    await sendAdminChatMessage(supabaseAdmin, ticket.user_id, chatMessageText, 'GS Support', '/gs-logo.png').catch(() => {});
                }
            } catch {}
        }

        return NextResponse.json({ success: true, updated_in: dbUpdated ? 'database' : (ledgerUpdated ? 'fallback_ledger' : 'none') });
    } catch (err) {
        console.error('[Tickets POST]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ===== Fallback Ledger Helpers =====

async function getTicketsFromLedgerPopulated(statusFilter, categoryFilter) {
    try {
        const { data: ledgerRes } = await supabaseAdmin
            .from('app_settings')
            .select('*')
            .eq('key', 'fallback_ledger')
            .single();

        if (ledgerRes && ledgerRes.value) {
            const ledger = typeof ledgerRes.value === 'string' ? JSON.parse(ledgerRes.value) : ledgerRes.value;
            let tickets = ledger.support_tickets || [];

            // Apply filters
            if (statusFilter && statusFilter !== 'all') {
                tickets = tickets.filter(t => t.status === statusFilter);
            }
            if (categoryFilter && categoryFilter !== 'all') {
                tickets = tickets.filter(t => t.category === categoryFilter);
            }

            if (tickets.length === 0) return [];

            // Fetch user info for each ticket
            const userIds = [...new Set(tickets.map(t => t.user_id).filter(Boolean))];
            let userMap = {};

            if (userIds.length > 0) {
                const { data: users } = await supabaseAdmin
                    .from('users')
                    .select('display_name, email, avatar_url, id')
                    .in('id', userIds);

                if (users) {
                    users.forEach(u => {
                        userMap[u.id] = u;
                    });
                }
            }

            return tickets.map(t => ({
                ...t,
                users: userMap[t.user_id] || { display_name: 'Unknown User', email: 'unknown@user.com', avatar_url: '' }
            }));
        }
    } catch (err) {
        console.warn('[Admin Tickets Ledger GET]', err.message);
    }
    return [];
}

async function findTicketInLedger(ticketId) {
    try {
        const { data: ledgerRes } = await supabaseAdmin
            .from('app_settings')
            .select('value')
            .eq('key', 'fallback_ledger')
            .single();
        if (ledgerRes?.value) {
            const ledger = typeof ledgerRes.value === 'string' ? JSON.parse(ledgerRes.value) : ledgerRes.value;
            return (ledger.support_tickets || []).find(t => t.id === ticketId);
        }
    } catch {}
    return null;
}

async function updateTicketInLedger(ticketId, updates) {
    const { data: ledgerRes } = await supabaseAdmin
        .from('app_settings')
        .select('*')
        .eq('key', 'fallback_ledger')
        .single();

    if (!ledgerRes) {
        console.warn('[Admin Tickets] No fallback ledger found — ticket may only exist in DB');
        return;
    }

    let ledger = typeof ledgerRes.value === 'string' ? JSON.parse(ledgerRes.value) : ledgerRes.value;
    let tickets = ledger.support_tickets || [];

    const ticketIdx = tickets.findIndex(t => t.id === ticketId);
    if (ticketIdx === -1) {
        console.warn(`[Admin Tickets] Ticket ${ticketId} not found in ledger — may exist only in DB`);
        return;
    }

    tickets[ticketIdx] = {
        ...tickets[ticketIdx],
        ...updates,
        updated_at: new Date().toISOString()
    };

    ledger.support_tickets = tickets;

    await supabaseAdmin
        .from('app_settings')
        .update({ value: ledger, updated_at: new Date().toISOString() })
        .eq('id', ledgerRes.id);
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
