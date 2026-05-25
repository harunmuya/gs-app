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

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('gs_admin_token')?.value;

        if (token !== 'authenticated-gs-admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch users, subscriptions, verification requests, transactions, and settings using service role
        // Execute queries with separate catches to support resilient fallbacks if tables don't exist yet
        const usersRes = await supabaseAdmin.from('users').select('*').order('created_at', { ascending: false });
        
        let subsRes = { data: [] };
        try {
            const res = await supabaseAdmin.from('subscriptions').select('*');
            if (!res.error) subsRes = res;
        } catch {}

        let verifsRes = { data: [] };
        try {
            const res = await supabaseAdmin.from('verification_requests').select('*');
            if (!res.error) verifsRes = res;
        } catch {}

        let txsRes = { data: [] };
        try {
            const res = await supabaseAdmin.from('transactions').select('*').order('created_at', { ascending: false });
            if (!res.error) txsRes = res;
        } catch {}

        let settingsRes = { data: [] };
        try {
            const res = await supabaseAdmin.from('app_settings').select('*');
            if (!res.error) settingsRes = res;
        } catch {}

        if (usersRes.error) throw usersRes.error;

        const settingsData = settingsRes?.data || [];

        // Extract fallback ledger (badges, user plans, manual transactions)
        let ledger = { custom_badges: {}, user_plans: {}, transactions: [] };
        const ledgerRec = settingsData.find(s => s.key === 'fallback_ledger');
        if (ledgerRec) {
            ledger = typeof ledgerRec.value === 'string' ? JSON.parse(ledgerRec.value) : ledgerRec.value;
        }

        const users = usersRes.data || [];
        const subscriptions = subsRes.data || [];
        const verifications = verifsRes.data || [];

        // Build a lookup map for fast merging
        const subMap = {};
        subscriptions.forEach(s => {
            subMap[s.user_id] = s;
        });

        const verifMap = {};
        verifications.forEach(v => {
            verifMap[v.user_id] = v;
        });

        // Merge user objects
        const detailedUsers = users.map(user => {
            const userSub = subMap[user.id] || { plan: 'free' };
            const userVerif = verifMap[user.id] || { status: 'none' };
            
            // Sync with fallback ledger
            const fallbackBadge = ledger.custom_badges?.[user.id] || '';
            const fallbackPlan = ledger.user_plans?.[user.id];
            const fallbackVerif = ledger.verifications?.[user.id];

            const activePlan = fallbackPlan ? fallbackPlan.plan : userSub.plan;
            const activeStartedAt = fallbackPlan ? fallbackPlan.started_at : userSub.started_at;
            const activeExpiresAt = fallbackPlan ? fallbackPlan.expires_at : userSub.expires_at;

            const activeVerifStatus = fallbackVerif ? fallbackVerif.status : userVerif.status;
            const activeSelfie = fallbackVerif ? fallbackVerif.selfie_url : userVerif.selfie_url;
            const activeIdDoc = fallbackVerif ? fallbackVerif.id_doc_url : userVerif.id_doc_url;
            const activeSubmittedAt = fallbackVerif ? fallbackVerif.submitted_at : userVerif.submitted_at;

            return {
                id: user.id,
                email: user.email,
                displayName: user.display_name,
                avatarUrl: user.avatar_url,
                isAdmin: user.is_admin || false,
                isBanned: user.is_banned || false,
                customBadge: fallbackBadge || user.custom_badge || '',
                createdAt: user.created_at,
                joinedAt: user.created_at,
                phone: user.phone || '',
                location: user.location || '',
                subscription: {
                    plan: activePlan,
                    startedAt: activeStartedAt,
                    expiresAt: activeExpiresAt,
                },
                verification: {
                    status: activeVerifStatus,
                    selfieUrl: activeSelfie,
                    idDocUrl: activeIdDoc,
                    submittedAt: activeSubmittedAt,
                }
            };
        });

        // Create an email lookup map for display names (from detailedUsers which has displayName)
        const userEmailMap = {};
        detailedUsers.forEach(u => {
            if (u.email) {
                userEmailMap[u.email.toLowerCase()] = u.displayName;
            }
        });

        const getUserName = (email) => {
            if (!email) return 'Guest Payer';
            const norm = email.trim().toLowerCase();
            if (userEmailMap[norm]) return userEmailMap[norm];
            // Otherwise, capitalize email prefix as a beautiful fallback
            const prefix = email.split('@')[0].replace(/[._-]/g, ' ');
            return prefix.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        };

        // Seed mock transactions with numeric amounts matching live data format
        const mockTransactions = [
            { id: 'TX-82937', userName: 'Harun Muya', user: 'harunmuya@gmail.com', plan: 'Gold', amount: 1000, method: 'M-Pesa Escrow', status: 'Completed', code: 'QET93821LK', ticketId: 'GS-PAY-P8B12K9', date: 'Today, 2:14 PM', created_at: new Date(Date.now() - 7200000).toISOString() },
            { id: 'TX-82936', userName: 'Kevin Otieno', user: 'kevin.otieno@outlook.com', plan: 'Diamond', amount: 2500, method: 'M-Pesa Escrow', status: 'Completed', code: 'QES12495MZ', ticketId: 'GS-PAY-R9B38K1', date: 'Today, 11:05 AM', created_at: new Date(Date.now() - 18000000).toISOString() },
            { id: 'TX-82935', userName: 'Mary Wambui', user: 'mary.wambui@yahoo.com', plan: 'Silver', amount: 500, method: 'M-Pesa Direct', status: 'Completed', code: 'QER91024JK', ticketId: 'GS-PAY-X2D18M4', date: 'Yesterday, 6:40 PM', created_at: new Date(Date.now() - 86400000).toISOString() },
            { id: 'TX-82934', userName: 'Josphat Mutua', user: 'josphat.mutua@gmail.com', plan: 'Gold', amount: 1000, method: 'M-Pesa Escrow', status: 'Completed', code: 'QEP38421MN', ticketId: 'GS-PAY-Y7N24L3', date: 'May 22, 10:15 AM', created_at: new Date(Date.now() - 3 * 86400000).toISOString() }
        ];

        // Formatting transactions with robust fallbacks
        let rawTransactions = txsRes?.data || [];
        
        // Merge custom fallback transactions recorded in app_settings ledger
        if (ledger.transactions && ledger.transactions.length > 0) {
            const existingCodes = new Set(rawTransactions.map(tx => tx.code?.toUpperCase()));
            const newFallbackTxs = ledger.transactions.filter(tx => !existingCodes.has(tx.code?.toUpperCase()));
            rawTransactions = [...newFallbackTxs, ...rawTransactions];
        }

        const formattedLiveTxs = rawTransactions.map(tx => ({
            id: tx.id || ('TX-' + Math.random().toString().substr(2, 5)),
            userName: getUserName(tx.email),
            user: tx.email,
            plan: tx.plan ? tx.plan.charAt(0).toUpperCase() + tx.plan.slice(1) : 'Free',
            amount: parseFloat(tx.amount) || 0,
            payment_proof_url: tx.payment_proof_url || null,
            method: tx.method || 'M-Pesa Escrow',
            status: tx.status || 'Pending',
            code: tx.code || 'UNKNOWN',
            ticketId: tx.ticket_id || tx.ticketId || '—',
            created_at: tx.created_at || null,
            date: tx.created_at 
                ? new Date(tx.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                : 'N/A'
        }));

        // Prepend live/pending user-submitted transactions on top of mock transactions
        const transactions = [...formattedLiveTxs, ...mockTransactions];

        // Get app campaigns configuration
        let campaigns = {
            bannerAds: true,
            intercomPromo: false,
            lockMessageLimit: true,
            dailySwipeLimit: true
        };
        const campRec = settingsData.find(s => s.key === 'campaigns');
        if (campRec) {
            campaigns = typeof campRec.value === 'string' ? JSON.parse(campRec.value) : campRec.value;
        }

        return NextResponse.json({ 
            users: detailedUsers, 
            transactions,
            campaigns,
            ledgerStatus: txsRes?.data?.length > 0 ? 'connected' : 'fallback'
        });
    } catch (err) {
        console.error('[Admin Users API] Error:', err);
        return NextResponse.json({ error: 'Failed to retrieve admin dashboard users data' }, { status: 500 });
    }
}
