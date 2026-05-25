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
        const { userId, email, plan, amount, method, code, ticketId, paymentProofUrl } = await req.json();

        if (!email || !plan || !code) {
            return NextResponse.json({ error: 'Missing required transaction fields' }, { status: 400 });
        }

        // Insert pending transaction record into transactions table using admin client
        const { data, error } = await supabaseAdmin
            .from('transactions')
            .insert({
                user_id: userId || null,
                email: email,
                plan: plan,
                amount: amount || 0,
                method: method || 'M-Pesa Escrow',
                status: 'Pending',
                code: code.trim(),
                ticket_id: ticketId || null,
                payment_proof_url: paymentProofUrl || null
            })
            .select()
            .single();

        if (error) {
            console.error('[Transaction API] Supabase insert error:', error);

            // Resilient schema cache fallback: if the public.transactions table is missing,
            // or if the ticket_id column is missing (error 42703), persistently log it inside the fallback_ledger inside the app_settings table!
            if (error.code === 'PGRST205' || error.code === '42P01' || error.code === '42703' || (error.message && (error.message.includes('schema cache') || error.message.includes('relation "public.transactions" does not exist') || error.message.includes('column') || error.message.includes('ticket_id')))) {
                console.warn('[Transaction API] GRACEFUL FALLBACK: Logging transaction in fallback ledger.');
                
                const tempId = 'TX-' + Math.random().toString().substr(2, 5);
                const txRecord = {
                    id: tempId,
                    user_id: userId || null,
                    email: email,
                    plan: plan,
                    amount: amount || 0,
                    method: method || 'M-Pesa Escrow',
                    status: 'Pending',
                    code: code.trim(),
                    ticket_id: ticketId || ('GS-PAY-' + Math.random().toString(36).substr(2, 7).toUpperCase()),
                    payment_proof_url: paymentProofUrl || null,
                    created_at: new Date().toISOString()
                };

                try {
                    // 1. Read existing ledger from app_settings
                    const ledgerRes = await supabaseAdmin.from('app_settings').select('*').eq('key', 'fallback_ledger').single();
                    let ledger = { custom_badges: {}, user_plans: {}, transactions: [] };
                    let ledgerId = null;

                    if (ledgerRes.data) {
                        ledgerId = ledgerRes.data.id;
                        ledger = typeof ledgerRes.data.value === 'string' ? JSON.parse(ledgerRes.data.value) : ledgerRes.data.value;
                    }

                    // 2. Append new transaction to ledger
                    if (!ledger.transactions) ledger.transactions = [];
                    
                    // Verify if this code has already been submitted in the fallback ledger
                    if (ledger.transactions.some(tx => tx.code?.toUpperCase() === code.trim().toUpperCase())) {
                        return NextResponse.json({ error: 'This transaction code has already been submitted.' }, { status: 409 });
                    }
                    
                    ledger.transactions.unshift(txRecord);

                    // 3. Write ledger back to database
                    if (ledgerId) {
                        await supabaseAdmin.from('app_settings').update({ value: ledger, updated_at: new Date().toISOString() }).eq('id', ledgerId);
                    } else {
                        await supabaseAdmin.from('app_settings').insert({ key: 'fallback_ledger', value: ledger });
                    }

                    return NextResponse.json({
                        success: true,
                        transaction: txRecord,
                        fallback: true
                    });
                } catch (fallbackErr) {
                    console.error('[Transaction API] Failed to log transaction in fallback ledger:', fallbackErr.message);
                    // Critical fallback: if even app_settings fails, return the record so user is not blocked
                    return NextResponse.json({
                        success: true,
                        transaction: txRecord,
                        fallback: true,
                        fallback_warning: 'Database save failed entirely'
                    });
                }
            }

            if (error.code === '23505') { // Unique violation
                return NextResponse.json({ error: 'This transaction code has already been submitted.' }, { status: 409 });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, transaction: data });
    } catch (err) {
        console.error('[Transaction API] Unexpected error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
