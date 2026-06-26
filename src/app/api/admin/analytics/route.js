import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period') || '30'; // days

        const since = new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000).toISOString();
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const [
            totalUsersRes,
            newUsersRes,
            activeUsersRes,
            onlineUsersRes,
            verifiedUsersRes,
            bannedUsersRes,
            transactionsRes,
            pendingPaymentsRes,
            pendingVerificationsRes,
            subscriptionBreakdownRes,
            recentTransactionsRes,
            dailySignupsRes,
        ] = await Promise.allSettled([
            // Total users
            supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
            // New users (last N days)
            supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).gte('created_at', since),
            // Active today (online today or created today)
            supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).gte('last_seen', today.toISOString()),
            // Online now
            supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('is_online', true),
            // Verified
            supabaseAdmin.from('verification_requests').select('id', { count: 'exact', head: true }).eq('status', 'verified'),
            // Banned
            supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('is_banned', true),
            // All completed transactions
            supabaseAdmin.from('transactions').select('amount, plan, created_at, status').eq('status', 'Completed'),
            // Pending payments
            supabaseAdmin.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'Pending'),
            // Pending verifications
            supabaseAdmin.from('verification_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
            // Subscription breakdown
            supabaseAdmin.from('subscriptions').select('plan'),
            // Recent transactions (last 30)
            supabaseAdmin.from('transactions').select('*, users(display_name, email, avatar_url)').order('created_at', { ascending: false }).limit(50),
            // Daily signups last 30 days
            supabaseAdmin.from('users').select('created_at').gte('created_at', since).order('created_at', { ascending: true }),
        ]);

        const get = (res) => res.status === 'fulfilled' ? res.value : { data: null, count: 0, error: res.reason };

        // 1. Get fallback ledger metrics
        let ledger = { custom_badges: {}, user_plans: {}, transactions: [], verifications: {} };
        try {
            const { data: ledgerRec } = await supabaseAdmin
                .from('app_settings')
                .select('value')
                .eq('key', 'fallback_ledger')
                .single();
            if (ledgerRec?.value) {
                ledger = typeof ledgerRec.value === 'string' ? JSON.parse(ledgerRec.value) : ledgerRec.value;
            }
        } catch {}

        const totalUsers = get(totalUsersRes).count || 0;
        const newUsers = get(newUsersRes).count || 0;
        const activeToday = get(activeUsersRes).count || 0;
        const onlineNow = get(onlineUsersRes).count || 0;
        const bannedUsers = get(bannedUsersRes).count || 0;

        // Merge DB verifications + fallback ledger verifications
        let verifiedUsers = get(verifiedUsersRes).count || 0;
        let pendingVerifications = get(pendingVerificationsRes).count || 0;
        if (ledger.verifications) {
            const fallbackVerified = Object.values(ledger.verifications).filter(v => v.status === 'verified').length;
            const fallbackPending = Object.values(ledger.verifications).filter(v => v.status === 'pending_review' || v.status === 'processing').length;
            verifiedUsers += fallbackVerified;
            pendingVerifications += fallbackPending;
        }

        // Merge DB transactions + fallback transactions
        let completedTransactions = (get(transactionsRes).data || []).map(t => ({
            ...t,
            amount: parseFloat(t.amount) || 0
        }));

        let pendingPayments = get(pendingPaymentsRes).count || 0;
        let allMergedTransactions = [...(get(transactionsRes).data || [])]; // for recentTransactions

        if (ledger.transactions && ledger.transactions.length > 0) {
            const existingCodes = new Set(completedTransactions.map(t => t.code?.toUpperCase()));
            
            ledger.transactions.forEach(t => {
                const isDup = t.code && existingCodes.has(t.code.toUpperCase());
                if (!isDup) {
                    // Add to allMergedTransactions for recent display
                    allMergedTransactions.push(t);

                    if (t.status === 'Completed') {
                        completedTransactions.push({
                            amount: parseFloat(t.amount) || 0,
                            plan: t.plan?.toLowerCase() || 'free',
                            created_at: t.created_at || t.date || new Date().toISOString(),
                            status: 'Completed',
                            code: t.code
                        });
                    } else if (t.status === 'Pending') {
                        pendingPayments++;
                    }
                }
            });
        }

        // Sort merged transactions by date descending
        allMergedTransactions.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        const totalRevenue = completedTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
        const todayRevenue = completedTransactions
            .filter(t => new Date(t.created_at || 0) >= today)
            .reduce((sum, t) => sum + (t.amount || 0), 0);
        const weekRevenue = completedTransactions
            .filter(t => new Date(t.created_at || 0) >= new Date(weekAgo))
            .reduce((sum, t) => sum + (t.amount || 0), 0);

        // Subscription Plan breakdown
        const subscriptions = get(subscriptionBreakdownRes).data || [];
        const planBreakdown = { free: 0, basic: 0, silver: 0, gold: 0 };
        subscriptions.forEach(s => {
            if (planBreakdown[s.plan] !== undefined) planBreakdown[s.plan]++;
        });

        // Merge fallback plan counts
        if (ledger.user_plans) {
            Object.values(ledger.user_plans).forEach(p => {
                if (planBreakdown[p.plan] !== undefined) {
                    planBreakdown[p.plan]++;
                }
            });
        }

        // Use merged transactions (DB + fallback) instead of only DB
        const recentTransactions = allMergedTransactions;

        // Build daily signups chart data (last 14 days)
        const signupsData = get(dailySignupsRes).data || [];
        const dailyMap = {};
        for (let i = 13; i >= 0; i--) {
            const d = new Date(Date.now() - i * 86400000);
            const key = d.toISOString().slice(0, 10);
            dailyMap[key] = 0;
        }
        signupsData.forEach(u => {
            const key = u.created_at?.slice(0, 10);
            if (key && dailyMap[key] !== undefined) dailyMap[key]++;
        });
        const dailySignupsChart = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

        // Revenue by plan
        const revenueByPlan = { basic: 0, silver: 0, gold: 0 };
        completedTransactions.forEach(t => {
            const normalizedPlan = t.plan?.toLowerCase();
            if (revenueByPlan[normalizedPlan] !== undefined) {
                revenueByPlan[normalizedPlan] += t.amount || 0;
            }
        });

        return NextResponse.json({
            users: { total: totalUsers, newThisPeriod: newUsers, activeToday, onlineNow, verified: verifiedUsers, banned: bannedUsers },
            revenue: { total: totalRevenue, today: todayRevenue, thisWeek: weekRevenue, byPlan: revenueByPlan },
            payments: { pending: pendingPayments, completed: completedTransactions.length },
            verifications: { pending: pendingVerifications, total: verifiedUsers },
            subscriptions: planBreakdown,
            recentTransactions: recentTransactions.slice(0, 50),
            charts: { dailySignups: dailySignupsChart },
        });
    } catch (err) {
        console.error('[Analytics API]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
