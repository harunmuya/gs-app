import { NextResponse } from 'next/server';
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

// GET all tickets for a user
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

        // 1. Try querying the database
        try {
            const { data, error } = await supabaseAdmin
                .from('support_tickets')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) {
                if (isSchemaCacheError(error)) {
                    console.warn('[Support GET] Falling back to schema ledger (table missing)');
                    const ledgerTickets = await getTicketsFromLedger(userId);
                    return NextResponse.json({ tickets: ledgerTickets });
                }
                throw error;
            }
            return NextResponse.json({ tickets: data || [] });
        } catch (dbErr) {
            if (isSchemaCacheError(dbErr)) {
                console.warn('[Support GET] Falling back to schema ledger (exception caught)');
                const ledgerTickets = await getTicketsFromLedger(userId);
                return NextResponse.json({ tickets: ledgerTickets });
            }
            throw dbErr;
        }
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

        // 1. Try checking rate limit using database
        let count = 0;
        let isFallbackMode = false;
        try {
            const { count: dbCount, error: countErr } = await supabaseAdmin
                .from('support_tickets')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId)
                .in('status', ['open', 'in_progress']);

            if (countErr) {
                if (isSchemaCacheError(countErr)) {
                    isFallbackMode = true;
                    const ledgerTickets = await getTicketsFromLedger(userId);
                    count = ledgerTickets.filter(t => ['open', 'in_progress'].includes(t.status)).length;
                } else {
                    throw countErr;
                }
            } else {
                count = dbCount || 0;
            }
        } catch (dbErr) {
            if (isSchemaCacheError(dbErr)) {
                isFallbackMode = true;
                const ledgerTickets = await getTicketsFromLedger(userId);
                count = ledgerTickets.filter(t => ['open', 'in_progress'].includes(t.status)).length;
            } else {
                throw dbErr;
            }
        }

        if (count >= 5) {
            return NextResponse.json({ error: 'You have too many open tickets. Please wait for existing ones to be resolved.' }, { status: 429 });
        }

        // 2. Create the ticket record
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

        if (isFallbackMode) {
            console.warn('[Support POST] Saving to fallback ledger (predetected)');
            await saveTicketToLedger(ticketRecord);
            await sendFallbackReceiptNotification(userId, trimmedSubject);
            return NextResponse.json({ success: true, ticket: ticketRecord, fallback: true });
        }

        // Try inserting into DB
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

            if (error) {
                if (isSchemaCacheError(error)) {
                    console.warn('[Support POST] Saving to fallback ledger (on insert error)');
                    await saveTicketToLedger(ticketRecord);
                    await sendFallbackReceiptNotification(userId, trimmedSubject);
                    return NextResponse.json({ success: true, ticket: ticketRecord, fallback: true });
                }
                throw error;
            }

            // Send confirmation receipt notification in database
            await supabaseAdmin.from('notifications').insert({
                user_id: userId,
                type: 'support',
                sender: 'GS Support',
                sender_image: '/gs-logo.png',
                title: '✅ Ticket Received',
                body: `Your support ticket "${trimmedSubject}" has been submitted. Our team will respond within 24 hours.`,
                is_read: false,
            }).catch(() => {});

            return NextResponse.json({ success: true, ticket: data });
        } catch (insertErr) {
            if (isSchemaCacheError(insertErr)) {
                console.warn('[Support POST] Saving to fallback ledger (on insert exception)');
                await saveTicketToLedger(ticketRecord);
                await sendFallbackReceiptNotification(userId, trimmedSubject);
                return NextResponse.json({ success: true, ticket: ticketRecord, fallback: true });
            }
            throw insertErr;
        }
    } catch (err) {
        console.error('[Support POST]', err);
        return NextResponse.json({ error: err.message || 'Failed to submit ticket' }, { status: 500 });
    }
}

// Fallback Helper Functions
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
        console.warn('[Support Ledger GET] Failed to fetch from ledger:', err.message);
    }
    return [];
}

async function saveTicketToLedger(ticket) {
    const { data: ledgerRes } = await supabaseAdmin
        .from('app_settings')
        .select('*')
        .eq('key', 'fallback_ledger')
        .single();

    let ledger = { custom_badges: {}, user_plans: {}, transactions: [], support_tickets: [] };
    let ledgerId = null;

    if (ledgerRes) {
        ledgerId = ledgerRes.id;
        ledger = typeof ledgerRes.value === 'string' ? JSON.parse(ledgerRes.value) : ledgerRes.value;
    }

    if (!ledger.support_tickets) ledger.support_tickets = [];
    ledger.support_tickets.unshift(ticket);

    if (ledgerId) {
        await supabaseAdmin.from('app_settings').update({ value: ledger, updated_at: new Date().toISOString() }).eq('id', ledgerId);
    } else {
        await supabaseAdmin.from('app_settings').insert({ key: 'fallback_ledger', value: ledger });
    }
}

async function sendFallbackReceiptNotification(userId, subject) {
    try {
        await supabaseAdmin.from('notifications').insert({
            user_id: userId,
            type: 'support',
            sender: 'GS Support',
            sender_image: '/gs-logo.png',
            title: '✅ Ticket Received',
            body: `Your support ticket "${subject}" has been submitted. Our team will respond within 24 hours.`,
            is_read: false,
        });
    } catch {}
}
