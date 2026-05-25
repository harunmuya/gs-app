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

        const totalUsers = get(totalUsersRes).count || 0;
        const newUsers = get(newUsersRes).count || 0;
        const activeToday = get(activeUsersRes).count || 0;
        const onlineNow = get(onlineUsersRes).count || 0;
        const verifiedUsers = get(verifiedUsersRes).count || 0;
        const bannedUsers = get(bannedUsersRes).count || 0;
        const pendingPayments = get(pendingPaymentsRes).count || 0;
        const pendingVerifications = get(pendingVerificationsRes).count || 0;

        const completedTransactions = get(transactionsRes).data || [];
        const totalRevenue = completedTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const todayRevenue = completedTransactions
            .filter(t => new Date(t.created_at) >= today)
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const weekRevenue = completedTransactions
            .filter(t => new Date(t.created_at) >= new Date(weekAgo))
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const subscriptions = get(subscriptionBreakdownRes).data || [];
        const planBreakdown = { free: 0, silver: 0, gold: 0, diamond: 0 };
        subscriptions.forEach(s => {
            if (planBreakdown[s.plan] !== undefined) planBreakdown[s.plan]++;
            else planBreakdown.free++;
        });

        const recentTransactions = get(recentTransactionsRes).data || [];

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
        const revenueByPlan = { silver: 0, gold: 0, diamond: 0 };
        completedTransactions.forEach(t => {
            if (revenueByPlan[t.plan] !== undefined) revenueByPlan[t.plan] += parseFloat(t.amount) || 0;
        });

        return NextResponse.json({
            users: { total: totalUsers, newThisPeriod: newUsers, activeToday, onlineNow, verified: verifiedUsers, banned: bannedUsers },
            revenue: { total: totalRevenue, today: todayRevenue, thisWeek: weekRevenue, byPlan: revenueByPlan },
            payments: { pending: pendingPayments, completed: completedTransactions.length },
            verifications: { pending: pendingVerifications, total: verifiedUsers },
            subscriptions: planBreakdown,
            recentTransactions: recentTransactions.slice(0, 30),
            charts: { dailySignups: dailySignupsChart },
        });
    } catch (err) {
        console.error('[Analytics API]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
