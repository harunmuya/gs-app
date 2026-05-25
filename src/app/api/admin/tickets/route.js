import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

function isSchemaCacheError(err) {
    if (!err) return false;
    const msg = err.message || '';
    return err.code === 'PGRST205' || err.code === '42P01' || msg.includes('schema cache') || msg.includes('relation "public.support_tickets" does not exist') || msg.includes('relation "support_tickets" does not exist');
}

async function verifyAdmin() {
    const cookieStore = await cookies();
    const token = cookieStore.get('gs_admin_token')?.value;
    return token === 'authenticated-gs-admin';
}

// GET all tickets (admin)
export async function GET(request) {
    if (!await verifyAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const category = searchParams.get('category');

        try {
            let query = supabaseAdmin
                .from('support_tickets')
                .select('*, users(display_name, email, avatar_url, id)')
                .order('created_at', { ascending: false })
                .limit(100);

            if (status && status !== 'all') query = query.eq('status', status);
            if (category && category !== 'all') query = query.eq('category', category);

            const { data, error } = await query;
            if (error) {
                if (isSchemaCacheError(error)) {
                    console.warn('[Admin Tickets GET] Falling back to schema ledger (table missing)');
                    const ledgerTickets = await getTicketsFromLedgerPopulated(status, category);
                    return NextResponse.json({ tickets: ledgerTickets });
                }
                throw error;
            }

            return NextResponse.json({ tickets: data || [] });
        } catch (dbErr) {
            if (isSchemaCacheError(dbErr)) {
                console.warn('[Admin Tickets GET] Falling back to schema ledger (exception caught)');
                const ledgerTickets = await getTicketsFromLedgerPopulated(status, category);
                return NextResponse.json({ tickets: ledgerTickets });
            }
            throw dbErr;
        }
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
        const { action, ticketId, status, adminReply } = body;

        if (!ticketId) return NextResponse.json({ error: 'Ticket ID required' }, { status: 400 });

        const updates = { updated_at: new Date().toISOString() };
        if (status) updates.status = status;
        if (adminReply) updates.admin_reply = adminReply;

        try {
            const { data, error } = await supabaseAdmin
                .from('support_tickets')
                .update(updates)
                .eq('id', ticketId)
                .select('*, users(display_name, email)')
                .single();

            if (error) {
                if (isSchemaCacheError(error)) {
                    console.warn('[Admin Tickets POST] Updating fallback ledger (table missing)');
                    const updatedTicket = await updateTicketInLedger(ticketId, updates);
                    return NextResponse.json({ success: true, ticket: updatedTicket, fallback: true });
                }
                throw error;
            }

            // Send notification to user if replied
            if (adminReply && data?.user_id) {
                await supabaseAdmin.from('notifications').insert({
                    user_id: data.user_id,
                    type: 'support',
                    sender: 'GS Support',
                    sender_image: '/gs-logo.png',
                    title: '📩 Support Reply',
                    body: `Your ticket "${data.subject}" has been responded to by our team. Status: ${updates.status || data.status}.`,
                    is_read: false,
                }).catch(e => console.warn('[Tickets] Notify failed:', e.message));
            }

            return NextResponse.json({ success: true, ticket: data });
        } catch (dbErr) {
            if (isSchemaCacheError(dbErr)) {
                console.warn('[Admin Tickets POST] Updating fallback ledger (exception caught)');
                const updatedTicket = await updateTicketInLedger(ticketId, updates);
                return NextResponse.json({ success: true, ticket: updatedTicket, fallback: true });
            }
            throw dbErr;
        }
    } catch (err) {
        console.error('[Tickets POST]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// Fallback Helper Functions
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

            // Filters
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
        console.warn('[Support Ledger GET Admin] Failed to fetch populated from ledger:', err.message);
    }
    return [];
}

async function updateTicketInLedger(ticketId, updates) {
    const { data: ledgerRes } = await supabaseAdmin
        .from('app_settings')
        .select('*')
        .eq('key', 'fallback_ledger')
        .single();

    if (!ledgerRes) throw new Error('No fallback ledger found to update');

    let ledger = typeof ledgerRes.value === 'string' ? JSON.parse(ledgerRes.value) : ledgerRes.value;
    let tickets = ledger.support_tickets || [];

    const ticketIdx = tickets.findIndex(t => t.id === ticketId);
    if (ticketIdx === -1) throw new Error('Ticket not found in fallback ledger');

    const updatedTicket = {
        ...tickets[ticketIdx],
        ...updates,
        updated_at: new Date().toISOString()
    };

    tickets[ticketIdx] = updatedTicket;
    ledger.support_tickets = tickets;

    await supabaseAdmin
        .from('app_settings')
        .update({ value: ledger, updated_at: new Date().toISOString() })
        .eq('id', ledgerRes.id);

    // Fetch user info to match exact structure
    let userInfo = { display_name: 'Unknown User', email: 'unknown@user.com', avatar_url: '' };
    if (updatedTicket.user_id) {
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('display_name, email')
            .eq('id', updatedTicket.user_id)
            .single();
        if (user) {
            userInfo = user;
        }

        // Send confirmation receipt notification in database
        await supabaseAdmin.from('notifications').insert({
            user_id: updatedTicket.user_id,
            type: 'support',
            sender: 'GS Support',
            sender_image: '/gs-logo.png',
            title: '📩 Support Reply',
            body: `Your ticket "${updatedTicket.subject}" has been responded to by our team. Status: ${updatedTicket.status}.`,
            is_read: false,
        }).catch(() => {});
    }

    return {
        ...updatedTicket,
        users: userInfo
    };
}
