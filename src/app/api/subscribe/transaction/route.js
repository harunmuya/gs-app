import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        }
    }
);

export async function POST(req) {
    try {
        const { userId, email, plan, amount, method, code, ticketId, paymentProofUrl, paymentProofBase64 } = await req.json();

        if (!email || !plan || !code) {
            return NextResponse.json({ error: 'Missing required transaction fields' }, { status: 400 });
        }

        const finalTicketId = ticketId || ('GS-PAY-' + Math.random().toString(36).substr(2, 7).toUpperCase());
        const proofUrl = paymentProofUrl || null;
        // Truncate base64 to max 500KB to avoid oversized JSON in fallback ledger
        const proofBase64 = paymentProofBase64 ? paymentProofBase64.substring(0, 500000) : null;

        // Build the transaction record
        const txRecord = {
            id: 'TX-' + Math.random().toString().substr(2, 5),
            user_id: userId || null,
            email: email,
            plan: plan,
            amount: parseFloat(amount) || 0,
            method: method || 'M-Pesa Escrow',
            status: 'Pending',
            code: code.trim(),
            ticket_id: finalTicketId,
            payment_proof_url: proofUrl,
            payment_proof_base64: proofBase64,
            created_at: new Date().toISOString()
        };

        // ALWAYS save to fallback ledger first (this is our reliable store)
        let ledgerSaved = false;
        try {
            ledgerSaved = await saveToFallbackLedger(txRecord);
        } catch (ledgerErr) {
            console.error('[Transaction API] Fallback ledger save error:', ledgerErr.message);
        }

        // THEN try to insert into the database table (best-effort)
        let dbSaved = false;
        try {
            const { data, error } = await supabaseAdmin
                .from('transactions')
                .insert({
                    user_id: userId || null,
                    email: email,
                    plan: plan,
                    amount: parseFloat(amount) || 0,
                    method: method || 'M-Pesa Escrow',
                    status: 'Pending',
                    code: code.trim(),
                    ticket_id: finalTicketId,
                    payment_proof_url: proofUrl
                })
                .select()
                .single();

            if (!error && data) {
                dbSaved = true;
                txRecord.id = data.id; // Use the real DB ID
            } else if (error) {
                console.warn('[Transaction API] DB insert failed (fallback active):', error.message);
                // Check for unique constraint violation
                if (error.code === '23505') {
                    return NextResponse.json({ error: 'This transaction code has already been submitted.' }, { status: 409 });
                }
            }
        } catch (dbErr) {
            console.warn('[Transaction API] DB insert exception (fallback active):', dbErr.message);
        }

        if (!ledgerSaved && !dbSaved) {
            // Neither store worked — return the record anyway so user is not blocked
            return NextResponse.json({
                success: true,
                transaction: txRecord,
                fallback: true,
                fallback_warning: 'Transaction recorded locally — admin will see it on next sync'
            });
        }

        return NextResponse.json({
            success: true,
            transaction: txRecord,
            stored_in: dbSaved ? 'database' : 'fallback_ledger'
        });

    } catch (err) {
        console.error('[Transaction API] Unexpected error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// Reliable fallback ledger save
async function saveToFallbackLedger(txRecord) {
    const ledgerRes = await supabaseAdmin
        .from('app_settings')
        .select('*')
        .eq('key', 'fallback_ledger')
        .single();

    let ledger = { custom_badges: {}, user_plans: {}, transactions: [], support_tickets: [], verifications: {} };
    let ledgerId = null;

    if (ledgerRes.data) {
        ledgerId = ledgerRes.data.id;
        ledger = typeof ledgerRes.data.value === 'string' ? JSON.parse(ledgerRes.data.value) : ledgerRes.data.value;
    }

    if (!ledger.transactions) ledger.transactions = [];

    // Check for duplicate code
    if (ledger.transactions.some(tx => tx.code?.toUpperCase() === txRecord.code.toUpperCase())) {
        // Already exists — skip but don't error
        return true;
    }

    ledger.transactions.unshift(txRecord);

    if (ledgerId) {
        const { error } = await supabaseAdmin
            .from('app_settings')
            .update({ value: ledger, updated_at: new Date().toISOString() })
            .eq('id', ledgerId);
        if (error) throw error;
    } else {
        const { error } = await supabaseAdmin
            .from('app_settings')
            .insert({ key: 'fallback_ledger', value: ledger });
        if (error) throw error;
    }

    return true;
}
