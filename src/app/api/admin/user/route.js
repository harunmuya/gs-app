import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
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

export async function POST(request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('gs_admin_token')?.value;

        if (token !== 'authenticated-gs-admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { action, userId } = body;

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        if (action === 'ban') {
            const { isBanned } = body;
            const { data, error } = await supabaseAdmin
                .from('users')
                .update({ is_banned: isBanned })
                .eq('id', userId)
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ success: true, user: data });
        }

        if (action === 'update_plan') {
            const { plan, durationDays } = body;

            if (!['free', 'silver', 'gold', 'diamond'].includes(plan)) {
                return NextResponse.json({ error: 'Invalid subscription plan' }, { status: 400 });
            }

            const expiresAt = durationDays 
                ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
                : null;

            let subData = null;
            let subError = null;

            try {
                const { data, error } = await supabaseAdmin
                    .from('subscriptions')
                    .upsert(
                        {
                            user_id: userId,
                            plan: plan,
                            started_at: new Date().toISOString(),
                            expires_at: expiresAt,
                        },
                        { onConflict: 'user_id' }
                    )
                    .select()
                    .single();
                
                subData = data;
                subError = error;
            } catch (dbErr) {
                subError = dbErr;
            }

            // Fallback plan updates to fallback ledger if subscriptions table fails
            if (subError) {
                console.warn('[Admin API] Subscriptions upsert failed, using fallback ledger:', subError.message);
                try {
                    const ledgerRes = await supabaseAdmin.from('app_settings').select('*').eq('key', 'fallback_ledger').single();
                    let ledger = { custom_badges: {}, user_plans: {}, transactions: [] };
                    let ledgerId = null;

                    if (ledgerRes.data) {
                        ledgerId = ledgerRes.data.id;
                        ledger = typeof ledgerRes.data.value === 'string' ? JSON.parse(ledgerRes.data.value) : ledgerRes.data.value;
                    }

                    if (!ledger.user_plans) ledger.user_plans = {};
                    ledger.user_plans[userId] = {
                        plan: plan,
                        started_at: new Date().toISOString(),
                        expires_at: expiresAt
                    };

                    if (ledgerId) {
                        await supabaseAdmin.from('app_settings').update({ value: ledger, updated_at: new Date().toISOString() }).eq('id', ledgerId);
                    } else {
                        await supabaseAdmin.from('app_settings').insert({ key: 'fallback_ledger', value: ledger });
                    }

                    subData = { plan, started_at: new Date().toISOString(), expires_at: expiresAt };
                } catch (fallbackErr) {
                    console.error('[Admin API] Fallback plan save failed:', fallbackErr);
                    return NextResponse.json({ error: 'Failed to update subscription via fallback system.' }, { status: 500 });
                }
            }

            // Automatically log dynamic transaction for package upgrades
            let amount = 0;
            if (plan === 'silver') amount = 500;
            else if (plan === 'gold') amount = 1000;
            else if (plan === 'diamond') amount = 2500;

            if (amount > 0) {
                const randomCode = 'ADM' + Math.random().toString(36).substr(2, 8).toUpperCase();
                
                // Get user email
                let userEmail = 'unknown@genuinesugarmummies.co.ke';
                try {
                    const { data: uData } = await supabaseAdmin
                        .from('users')
                        .select('email')
                        .eq('id', userId)
                        .single();
                    if (uData?.email) userEmail = uData.email;
                } catch {}

                const txRecord = {
                    user_id: userId,
                    email: userEmail,
                    plan: plan,
                    amount: amount,
                    method: 'Admin Manual',
                    status: 'Completed',
                    code: randomCode,
                    created_at: new Date().toISOString()
                };

                try {
                    // Try standard transactions insert
                    const { error: txErr } = await supabaseAdmin
                        .from('transactions')
                        .insert(txRecord);
                    
                    if (txErr) throw txErr;
                } catch (txErr) {
                    console.warn('[Admin API] Failed to log transaction directly, using fallback ledger:', txErr.message);
                    try {
                        const ledgerRes = await supabaseAdmin.from('app_settings').select('*').eq('key', 'fallback_ledger').single();
                        let ledger = { custom_badges: {}, user_plans: {}, transactions: [] };
                        let ledgerId = null;

                        if (ledgerRes.data) {
                            ledgerId = ledgerRes.data.id;
                            ledger = typeof ledgerRes.data.value === 'string' ? JSON.parse(ledgerRes.data.value) : ledgerRes.data.value;
                        }

                        if (!ledger.transactions) ledger.transactions = [];
                        ledger.transactions.unshift({
                            id: 'TX-' + Math.random().toString().substr(2, 5),
                            ...txRecord
                        });

                        if (ledgerId) {
                            await supabaseAdmin.from('app_settings').update({ value: ledger, updated_at: new Date().toISOString() }).eq('id', ledgerId);
                        } else {
                            await supabaseAdmin.from('app_settings').insert({ key: 'fallback_ledger', value: ledger });
                        }
                    } catch (fallbackTxErr) {
                        console.error('[Admin API] Fallback transaction log failed:', fallbackTxErr.message);
                    }
                }
            }

            return NextResponse.json({ success: true, subscription: subData });
        }

        if (action === 'verify') {
            const { status, reason } = body;

            if (!['pending', 'processing', 'pending_review', 'verified', 'failed'].includes(status)) {
                return NextResponse.json({ error: 'Invalid verification status' }, { status: 400 });
            }

            let verifData = null;
            let verifError = null;

            try {
                const { data, error } = await supabaseAdmin
                    .from('verification_requests')
                    .upsert(
                        {
                            user_id: userId,
                            status: status,
                            reason: reason || '',
                            reviewed_at: new Date().toISOString(),
                        },
                        { onConflict: 'user_id' }
                    )
                    .select()
                    .single();

                verifData = data;
                verifError = error;
            } catch (dbErr) {
                verifError = dbErr;
            }

            // Fallback to ledger if DB upsert fails
            if (verifError) {
                console.warn('[Admin API] Verification upsert failed, using fallback ledger:', verifError.message);
                try {
                    const ledgerRes = await supabaseAdmin.from('app_settings').select('*').eq('key', 'fallback_ledger').single();
                    let ledger = { custom_badges: {}, user_plans: {}, transactions: [], verifications: {} };
                    let ledgerId = null;

                    if (ledgerRes.data) {
                        ledgerId = ledgerRes.data.id;
                        ledger = typeof ledgerRes.data.value === 'string' ? JSON.parse(ledgerRes.data.value) : ledgerRes.data.value;
                    }

                    if (!ledger.verifications) ledger.verifications = {};
                    
                    const existingVerif = ledger.verifications[userId] || {};
                    ledger.verifications[userId] = {
                        ...existingVerif,
                        user_id: userId,
                        status: status,
                        reason: reason || '',
                        reviewed_at: new Date().toISOString()
                    };

                    if (ledgerId) {
                        await supabaseAdmin.from('app_settings').update({ value: ledger, updated_at: new Date().toISOString() }).eq('id', ledgerId);
                    } else {
                        await supabaseAdmin.from('app_settings').insert({ key: 'fallback_ledger', value: ledger });
                    }

                    verifData = ledger.verifications[userId];
                } catch (fallbackErr) {
                    console.error('[Admin API] Fallback verification save failed:', fallbackErr);
                    return NextResponse.json({ error: 'Failed to update verification status via fallback system.' }, { status: 500 });
                }
            }

            // If verified, update the custom badge as well
            if (status === 'verified') {
                try {
                    await supabaseAdmin.from('users').update({ custom_badge: 'Verified' }).eq('id', userId);
                } catch {}

                // Sync custom badge in ledger
                try {
                    const ledgerRes = await supabaseAdmin.from('app_settings').select('*').eq('key', 'fallback_ledger').single();
                    if (ledgerRes.data) {
                        const ledger = typeof ledgerRes.data.value === 'string' ? JSON.parse(ledgerRes.data.value) : ledgerRes.data.value;
                        ledger.custom_badges = ledger.custom_badges || {};
                        ledger.custom_badges[userId] = 'Verified';
                        await supabaseAdmin.from('app_settings').update({ value: ledger, updated_at: new Date().toISOString() }).eq('id', ledgerRes.data.id);
                    }
                } catch {}
            }

            // Send in-app notification to user when verified/failed
            if (status === 'verified') {
                try {
                    await supabaseAdmin
                        .from('notifications')
                        .insert({
                            user_id: userId,
                            type: 'verification',
                            sender: 'GS Admin',
                            sender_image: '/gs-logo.png',
                            title: '✅ Profile Verified!',
                            body: 'Congratulations! Your identity has been verified by our admin team. You now have the official GS verified badge on your profile.',
                            is_read: false,
                        });
                } catch (notifErr) {
                    console.error('Failed to send verification notification:', notifErr.message);
                }
            } else if (status === 'failed') {
                try {
                    await supabaseAdmin
                        .from('notifications')
                        .insert({
                            user_id: userId,
                            type: 'verification',
                            sender: 'GS Admin',
                            sender_image: '/gs-logo.png',
                            title: '❌ Verification Not Approved',
                            body: reason || 'Your verification submission was not approved. Please resubmit with clear, valid documents.',
                            is_read: false,
                        });
                } catch (notifErr) {
                    console.error('Failed to send rejection notification:', notifErr.message);
                }
            }

            return NextResponse.json({ success: true, verification: verifData });
        }

        if (action === 'badge') {
            const { badge } = body;
            
            // Try standard users update first
            try {
                const { data, error } = await supabaseAdmin
                    .from('users')
                    .update({ custom_badge: badge || '' })
                    .eq('id', userId)
                    .select()
                    .single();

                if (!error) {
                    return NextResponse.json({ success: true, user: data });
                }
            } catch (dbErr) {
                console.warn('[Admin API] Could not update custom_badge directly, using fallback ledger:', dbErr.message);
            }

            // Fallback: Store custom badge in app_settings.fallback_ledger
            try {
                const ledgerRes = await supabaseAdmin.from('app_settings').select('*').eq('key', 'fallback_ledger').single();
                let ledger = { custom_badges: {}, user_plans: {}, transactions: [] };
                let ledgerId = null;

                if (ledgerRes.data) {
                    ledgerId = ledgerRes.data.id;
                    ledger = typeof ledgerRes.data.value === 'string' ? JSON.parse(ledgerRes.data.value) : ledgerRes.data.value;
                }

                if (!ledger.custom_badges) ledger.custom_badges = {};
                ledger.custom_badges[userId] = badge || '';

                if (ledgerId) {
                    await supabaseAdmin.from('app_settings').update({ value: ledger, updated_at: new Date().toISOString() }).eq('id', ledgerId);
                } else {
                    await supabaseAdmin.from('app_settings').insert({ key: 'fallback_ledger', value: ledger });
                }

                // Return a mock user object with badge mapped
                const { data: uData } = await supabaseAdmin.from('users').select('*').eq('id', userId).single();
                const userObj = { ...uData, custom_badge: badge || '', displayName: uData?.display_name };
                return NextResponse.json({ success: true, user: userObj });
            } catch (fallbackErr) {
                console.error('[Admin API] Fallback badge save failed:', fallbackErr);
                return NextResponse.json({ error: 'Failed to update user badge via fallback system.' }, { status: 500 });
            }
        }

        if (action === 'record_payment') {
            const { plan, amount, method, code, email } = body;

            if (!['free', 'silver', 'gold', 'diamond'].includes(plan)) {
                return NextResponse.json({ error: 'Invalid subscription plan' }, { status: 400 });
            }

            // Sync subscription if a real user is selected
            if (userId && userId !== 'mock') {
                const expiresAt = plan === 'free' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                try {
                    await supabaseAdmin
                        .from('subscriptions')
                        .upsert(
                            {
                                user_id: userId,
                                plan: plan,
                                started_at: new Date().toISOString(),
                                expires_at: expiresAt,
                            },
                            { onConflict: 'user_id' }
                        );
                } catch (subErr) {
                    console.error('Failed to sync subscription during manual payment:', subErr.message);
                }
            }

            const txRecord = {
                user_id: userId === 'mock' ? null : userId,
                email: email || 'unknown@genuinesugarmummies.co.ke',
                plan: plan,
                amount: parseFloat(amount) || 0,
                method: method || 'M-Pesa Escrow',
                status: 'Completed',
                code: code || ('MAN' + Math.random().toString(36).substr(2, 8).toUpperCase()),
                created_at: new Date().toISOString()
            };

            // Insert transaction record
            try {
                const { data, error } = await supabaseAdmin
                    .from('transactions')
                    .insert(txRecord)
                    .select()
                    .single();

                if (error) throw error;
                return NextResponse.json({ success: true, transaction: data });
            } catch (txErr) {
                console.warn('[Admin API] Failed to record payment directly, using fallback ledger:', txErr.message);
                try {
                    const ledgerRes = await supabaseAdmin.from('app_settings').select('*').eq('key', 'fallback_ledger').single();
                    let ledger = { custom_badges: {}, user_plans: {}, transactions: [] };
                    let ledgerId = null;

                    if (ledgerRes.data) {
                        ledgerId = ledgerRes.data.id;
                        ledger = typeof ledgerRes.data.value === 'string' ? JSON.parse(ledgerRes.data.value) : ledgerRes.data.value;
                    }

                    const tempId = 'TX-' + Math.random().toString().substr(2, 5);
                    const formattedRecord = { id: tempId, ...txRecord };
                    
                    if (!ledger.transactions) ledger.transactions = [];
                    ledger.transactions.unshift(formattedRecord);

                    if (ledgerId) {
                        await supabaseAdmin.from('app_settings').update({ value: ledger, updated_at: new Date().toISOString() }).eq('id', ledgerId);
                    } else {
                        await supabaseAdmin.from('app_settings').insert({ key: 'fallback_ledger', value: ledger });
                    }

                    return NextResponse.json({ success: true, transaction: formattedRecord });
                } catch (fallbackErr) {
                    console.error('[Admin API] Fallback record payment failed:', fallbackErr);
                    return NextResponse.json({ error: 'Failed to record payment via fallback system.' }, { status: 500 });
                }
            }
        }

        if (action === 'send_notification') {
            const { title, bodyText, targetTier } = body;

            if (!title || !bodyText) {
                return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
            }

            // Get target users based on tier/userId
            let query = supabaseAdmin.from('users').select('id');
            
            if (userId && userId !== 'broadcast') {
                query = query.eq('id', userId);
            } else if (targetTier && targetTier !== 'all') {
                // Get user IDs matching the target subscription tier
                const { data: subUsers } = await supabaseAdmin
                    .from('subscriptions')
                    .select('user_id')
                    .eq('plan', targetTier);
                
                const userIds = (subUsers || []).map(s => s.user_id);
                if (userIds.length === 0) {
                    return NextResponse.json({ success: true, sent: 0 });
                }
                query = query.in('id', userIds);
            }

            const { data: targetUsers } = await query;
            const usersList = targetUsers || [];
            
            const content = `${title}\n\n${bodyText}`;

            let sentCount = 0;
            for (const u of usersList) {
                const res = await sendAdminChatMessage(supabaseAdmin, u.id, content, 'Admin Mary G', '/gs-logo.png');
                if (res.success) {
                    sentCount++;
                }
            }

            return NextResponse.json({ success: true, sent: sentCount });
        }

        if (action === 'approve_payment' || action === 'decline_payment') {
            const { transactionId } = body;
            if (!transactionId) {
                return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 });
            }

            let tx = null;
            let fromFallback = false;

            try {
                const dbTx = await supabaseAdmin.from('transactions').select('*').eq('id', transactionId).single();
                if (dbTx.data) {
                    tx = dbTx.data;
                }
            } catch (txSearchErr) {
                console.warn('[Admin API] Database transaction search failed:', txSearchErr.message);
            }

            if (!tx) {
                try {
                    const ledgerRes = await supabaseAdmin.from('app_settings').select('*').eq('key', 'fallback_ledger').single();
                    if (ledgerRes.data) {
                        const ledger = typeof ledgerRes.data.value === 'string' ? JSON.parse(ledgerRes.data.value) : ledgerRes.data.value;
                        const found = ledger.transactions?.find(t => t.id === transactionId);
                        if (found) {
                            tx = found;
                            fromFallback = true;
                        }
                    }
                } catch (fallbackSearchErr) {
                    console.error('[Admin API] Fallback search failed:', fallbackSearchErr.message);
                }
            }

            if (!tx) {
                return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
            }

            let targetUserId = tx.user_id || tx.userId;
            if (!targetUserId && tx.email) {
                try {
                    const userRes = await supabaseAdmin.from('users').select('id').eq('email', tx.email).single();
                    if (userRes.data) targetUserId = userRes.data.id;
                } catch (uErr) {
                    console.warn('[Admin API] User lookup failed:', uErr.message);
                }
            }

            if (action === 'approve_payment') {
                // Update transaction status to Completed
                if (!fromFallback) {
                    await supabaseAdmin.from('transactions').update({ status: 'Completed' }).eq('id', transactionId);
                } else {
                    const ledgerRes = await supabaseAdmin.from('app_settings').select('*').eq('key', 'fallback_ledger').single();
                    if (ledgerRes.data) {
                        const ledgerId = ledgerRes.data.id;
                        const ledger = typeof ledgerRes.data.value === 'string' ? JSON.parse(ledgerRes.data.value) : ledgerRes.data.value;
                        if (ledger.transactions) {
                            ledger.transactions = ledger.transactions.map(t => 
                                t.id === transactionId ? { ...t, status: 'Completed' } : t
                            );
                            await supabaseAdmin.from('app_settings').update({ value: ledger, updated_at: new Date().toISOString() }).eq('id', ledgerId);
                        }
                    }
                }

                // Upgrade User Subscription Plan
                if (targetUserId) {
                    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                    
                    try {
                        await supabaseAdmin.from('subscriptions').upsert(
                            {
                                user_id: targetUserId,
                                plan: tx.plan,
                                started_at: new Date().toISOString(),
                                expires_at: expiresAt,
                            },
                            { onConflict: 'user_id' }
                        );
                    } catch (subErr) {
                        console.warn('[Admin Approve] Subscriptions upsert failed:', subErr.message);
                    }

                    // Sync to fallback user_plans
                    try {
                        const ledgerRes = await supabaseAdmin.from('app_settings').select('*').eq('key', 'fallback_ledger').single();
                        let ledger = { custom_badges: {}, user_plans: {}, transactions: [] };
                        let ledgerId = null;
                        if (ledgerRes.data) {
                            ledgerId = ledgerRes.data.id;
                            ledger = typeof ledgerRes.data.value === 'string' ? JSON.parse(ledgerRes.data.value) : ledgerRes.data.value;
                        }
                        if (!ledger.user_plans) ledger.user_plans = {};
                        ledger.user_plans[targetUserId] = {
                            plan: tx.plan,
                            started_at: new Date().toISOString(),
                            expires_at: expiresAt
                        };
                        if (ledgerId) {
                            await supabaseAdmin.from('app_settings').update({ value: ledger, updated_at: new Date().toISOString() }).eq('id', ledgerId);
                        } else {
                            await supabaseAdmin.from('app_settings').insert({ key: 'fallback_ledger', value: ledger });
                        }
                    } catch (fallbackErr) {
                        console.error('[Admin Approve] Fallback plan save failed:', fallbackErr);
                    }

                    // Send alert message using GS Support and gs-logo.png avatar!
                    try {
                        await supabaseAdmin.from('notifications').insert({
                            user_id: targetUserId,
                            type: 'upgrade',
                            sender: 'GS Support',
                            sender_image: '/gs-logo.png',
                            title: 'Upgrade Success!',
                            body: `Your payment of KES ${(tx.amount || 0).toLocaleString()} via ${tx.method} has been approved! Your account has been upgraded to ${tx.plan.toUpperCase()} status. Enjoy unlimited messages and matches!`,
                            is_read: false
                        });
                    } catch (notifErr) {
                        console.error('[Admin Approve] Alert insert failed:', notifErr.message);
                    }
                }

                return NextResponse.json({ success: true, status: 'Completed' });
            }

            if (action === 'decline_payment') {
                // Update transaction status to Failed
                if (!fromFallback) {
                    await supabaseAdmin.from('transactions').update({ status: 'Failed' }).eq('id', transactionId);
                } else {
                    const ledgerRes = await supabaseAdmin.from('app_settings').select('*').eq('key', 'fallback_ledger').single();
                    if (ledgerRes.data) {
                        const ledgerId = ledgerRes.data.id;
                        const ledger = typeof ledgerRes.data.value === 'string' ? JSON.parse(ledgerRes.data.value) : ledgerRes.data.value;
                        if (ledger.transactions) {
                            ledger.transactions = ledger.transactions.map(t => 
                                t.id === transactionId ? { ...t, status: 'Failed' } : t
                            );
                            await supabaseAdmin.from('app_settings').update({ value: ledger, updated_at: new Date().toISOString() }).eq('id', ledgerId);
                        }
                    }
                }

                // Send decline alert using GS Support and gs-logo.png avatar!
                if (targetUserId) {
                    try {
                        await supabaseAdmin.from('notifications').insert({
                            user_id: targetUserId,
                            type: 'system',
                            sender: 'GS Support',
                            sender_image: '/gs-logo.png',
                            title: 'Payment Declined',
                            body: `Your payment transaction ID "${tx.code}" was declined during manual verification. Please double-check your remittance details or contact Mary G on Telegram @GSADMINMARYGAGENCY for manual resolution.`,
                            is_read: false
                        });
                    } catch (notifErr) {
                        console.error('[Admin Decline] Alert insert failed:', notifErr.message);
                    }
                }

                return NextResponse.json({ success: true, status: 'Failed' });
            }
        }

        if (action === 'void_payment') {
            const { transactionId } = body;
            if (!transactionId) {
                return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 });
            }

            try {
                const { error } = await supabaseAdmin
                    .from('transactions')
                    .update({ status: 'Voided' })
                    .eq('id', transactionId);

                if (error) throw error;
                return NextResponse.json({ success: true });
            } catch (txErr) {
                console.warn('[Admin API] Failed to void payment directly, checking fallback ledger:', txErr.message);
                try {
                    const ledgerRes = await supabaseAdmin.from('app_settings').select('*').eq('key', 'fallback_ledger').single();
                    if (ledgerRes.data) {
                        const ledgerId = ledgerRes.data.id;
                        const ledger = typeof ledgerRes.data.value === 'string' ? JSON.parse(ledgerRes.data.value) : ledgerRes.data.value;

                        if (ledger.transactions) {
                            ledger.transactions = ledger.transactions.map(t => 
                                t.id === transactionId ? { ...t, status: 'Voided' } : t
                            );
                            await supabaseAdmin.from('app_settings').update({ value: ledger, updated_at: new Date().toISOString() }).eq('id', ledgerId);
                        }
                    }
                    return NextResponse.json({ success: true });
                } catch (fallbackErr) {
                    console.error('[Admin API] Fallback void payment failed:', fallbackErr);
                    return NextResponse.json({ error: 'Failed to void payment via fallback system.' }, { status: 500 });
                }
            }
        }

        if (action === 'delete_user') {
            const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
            if (error) throw error;

            await supabaseAdmin.from('users').delete().eq('id', userId);
            return NextResponse.json({ success: true });
        }

        if (action === 'refund_payment') {
            const { transactionId } = body;
            if (!transactionId) {
                return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 });
            }

            let fromFallback = false;
            try {
                const { error } = await supabaseAdmin.from('transactions').update({ status: 'Refunded' }).eq('id', transactionId);
                if (error) throw error;
            } catch (txErr) {
                console.warn('[Admin API] Database transaction refund failed, checking fallback ledger:', txErr.message);
                fromFallback = true;
            }

            if (fromFallback) {
                const ledgerRes = await supabaseAdmin.from('app_settings').select('*').eq('key', 'fallback_ledger').single();
                if (ledgerRes.data) {
                    const ledgerId = ledgerRes.data.id;
                    const ledger = typeof ledgerRes.data.value === 'string' ? JSON.parse(ledgerRes.data.value) : ledgerRes.data.value;
                    if (ledger.transactions) {
                        ledger.transactions = ledger.transactions.map(t => 
                            t.id === transactionId ? { ...t, status: 'Refunded' } : t
                        );
                        await supabaseAdmin.from('app_settings').update({ value: ledger, updated_at: new Date().toISOString() }).eq('id', ledgerId);
                    }
                }
            }

            if (userId && userId !== 'mock') {
                try {
                    await supabaseAdmin.from('subscriptions').upsert(
                        {
                            user_id: userId,
                            plan: 'free',
                            started_at: new Date().toISOString(),
                            expires_at: null,
                        },
                        { onConflict: 'user_id' }
                    );
                } catch (subErr) {
                    console.warn('[Admin Refund] Subscriptions reset failed:', subErr.message);
                }
            }

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });
    } catch (err) {
        console.error('[Admin Action API] Error:', err);
        
        // Return clear directions if schema is not updated
        if (err.code === '42703' || err.code === '42P01' || err.code === 'PGRST205' || (err.message && (err.message.includes('column') || err.message.includes('schema cache') || err.message.includes('table')))) {
            return NextResponse.json({ 
                error: "Database schema mismatch detected. This action requires database tables or columns that do not exist yet. Please run the SQL migration script located at 'supabase/update_schema.sql' in your Supabase Dashboard SQL Editor to update your database schema." 
            }, { status: 400 });
        }
        
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
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
