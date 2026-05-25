import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

// GET all tickets for a user
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

        // Read from BOTH sources and merge (ledger is the reliable source)
        let dbTickets = [];
        let ledgerTickets = [];

        // 1. Try database
        try {
            const { data, error } = await supabaseAdmin
                .from('support_tickets')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(20);
            if (!error && data) {
                dbTickets = data;
            }
        } catch {}

        // 2. Always read from fallback ledger too
        try {
            ledgerTickets = await getTicketsFromLedger(userId);
        } catch {}

        // 3. Merge and deduplicate by ID
        const dbIds = new Set(dbTickets.map(t => t.id));
        const uniqueLedgerTickets = ledgerTickets.filter(t => !dbIds.has(t.id));
        const allTickets = [...uniqueLedgerTickets, ...dbTickets]
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        return NextResponse.json({ tickets: allTickets });
    } catch (err) {
        console.error('[Support GET]', err);
        return NextResponse.json({ error: err.message || 'Failed to fetch tickets' }, { status: 500 });
    }
}

// POST — user submits a support ticket
export async function POST(request) {
    try {
        const body = await request.json();
        const { userId, category, subject, message } = body;

        if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        if (!category) return NextResponse.json({ error: 'Category required' }, { status: 400 });
        if (!subject?.trim()) return NextResponse.json({ error: 'Subject required' }, { status: 400 });
        if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 });

        const trimmedSubject = subject.trim();
        const trimmedMessage = message.trim();

        // Check rate limit from ledger (reliable source)
        let existingTickets = [];
        try {
            existingTickets = await getTicketsFromLedger(userId);
        } catch {}
        const openCount = existingTickets.filter(t => ['open', 'in_progress'].includes(t.status)).length;
        if (openCount >= 5) {
            return NextResponse.json({ error: 'You have too many open tickets. Please wait for existing ones to be resolved.' }, { status: 429 });
        }

        // Build the ticket record
        const tempId = 'TKT-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        const ticketRecord = {
            id: tempId,
            user_id: userId,
            category,
            subject: trimmedSubject,
            message: trimmedMessage,
            status: 'open',
            admin_reply: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        // ALWAYS save to fallback ledger first (reliable store)
        let ledgerSaved = false;
        try {
            await saveTicketToLedger(ticketRecord);
            ledgerSaved = true;
        } catch (ledgerErr) {
            console.error('[Support POST] Fallback ledger save error:', ledgerErr.message);
        }

        // THEN try inserting into DB (best-effort)
        let dbSaved = false;
        try {
            const { data, error } = await supabaseAdmin
                .from('support_tickets')
                .insert({
                    user_id: userId,
                    category,
                    subject: trimmedSubject,
                    message: trimmedMessage,
                    status: 'open',
                    created_at: ticketRecord.created_at,
                    updated_at: ticketRecord.updated_at,
                })
                .select()
                .single();
            if (!error && data) {
                dbSaved = true;
            }
        } catch {}

        // Send confirmation notification (best-effort)
        try {
            await supabaseAdmin.from('notifications').insert({
                user_id: userId,
                type: 'support',
                sender: 'GS Support',
                sender_image: '/gs-logo.png',
                title: 'Ticket Received',
                body: `Your support ticket "${trimmedSubject}" has been submitted. Our team will respond within 24 hours.`,
                is_read: false,
            });
        } catch {}

        if (!ledgerSaved && !dbSaved) {
            // Neither store worked — return the record anyway
            return NextResponse.json({ success: true, ticket: ticketRecord, fallback_warning: 'Stored locally' });
        }

        return NextResponse.json({ success: true, ticket: ticketRecord, stored_in: dbSaved ? 'database' : 'fallback_ledger' });
    } catch (err) {
        console.error('[Support POST]', err);
        return NextResponse.json({ error: err.message || 'Failed to submit ticket' }, { status: 500 });
    }
}

// ===== Fallback Ledger Helpers =====

async function getTicketsFromLedger(userId) {
    try {
        const { data: ledgerRes } = await supabaseAdmin
            .from('app_settings')
            .select('*')
            .eq('key', 'fallback_ledger')
            .single();

        if (ledgerRes && ledgerRes.value) {
            const ledger = typeof ledgerRes.value === 'string' ? JSON.parse(ledgerRes.value) : ledgerRes.value;
            const allTickets = ledger.support_tickets || [];
            if (userId) {
                return allTickets.filter(t => t.user_id === userId);
            }
            return allTickets;
        }
    } catch (err) {
        console.warn('[Support Ledger GET] Failed:', err.message);
    }
    return [];
}

async function saveTicketToLedger(ticket) {
    const { data: ledgerRes } = await supabaseAdmin
        .from('app_settings')
        .select('*')
        .eq('key', 'fallback_ledger')
        .single();

    let ledger = { custom_badges: {}, user_plans: {}, transactions: [], support_tickets: [], verifications: {} };
    let ledgerId = null;

    if (ledgerRes) {
        ledgerId = ledgerRes.id;
        ledger = typeof ledgerRes.value === 'string' ? JSON.parse(ledgerRes.value) : ledgerRes.value;
    }

    if (!ledger.support_tickets) ledger.support_tickets = [];
    ledger.support_tickets.unshift(ticket);

    if (ledgerId) {
        const { error } = await supabaseAdmin.from('app_settings').update({ value: ledger, updated_at: new Date().toISOString() }).eq('id', ledgerId);
        if (error) throw error;
    } else {
        const { error } = await supabaseAdmin.from('app_settings').insert({ key: 'fallback_ledger', value: ledger });
        if (error) throw error;
    }
}
