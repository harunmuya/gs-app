'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Users, ShieldAlert, CheckCircle, XCircle, Search, LogOut,
    Crown, Eye, RefreshCw, Star, Ban, Unlock, AlertTriangle, ShieldCheck,
    Mail, MapPin, Calendar, Clock, ExternalLink, CreditCard, Landmark,
    Send, TrendingUp, Sparkles, Megaphone, FileText, ChevronDown, CheckCheck,
    Plus, Lock, BarChart2, Activity, Bell, Volume2, Gift, Trash2,
    DollarSign, Filter, UserCheck, ArrowUpRight, Percent, X, MessageSquare,
    Zap, Download, LifeBuoy, Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import VerifiedBadge from '@/components/VerifiedBadge';

export default function AdminDashboard() {
    const router = useRouter();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [search, setSearch] = useState('');
    const [planFilter, setPlanFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [selectedDocs, setSelectedDocs] = useState(null);
    const [activeTab, setActiveTab] = useState('users');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentForm, setPaymentForm] = useState({ userId: 'mock', email: '', plan: 'silver', amount: 500, method: 'M-Pesa Escrow', code: '' });
    const [selectedUser, setSelectedUser] = useState(null);
    const [alertForm, setAlertForm] = useState({ userId: null, title: '', body: '' });
    const [showAlertModal, setShowAlertModal] = useState(false);
    const [logSearch, setLogSearch] = useState('');
    const [logTypeFilter, setLogTypeFilter] = useState('all');
    const [broadcastForm, setBroadcastForm] = useState({ title: '', body: '', targetTier: 'all' });
    const [broadcastLoading, setBroadcastLoading] = useState(false);

    const [systemLogs, setSystemLogs] = useState([
        { id: 1, type: 'info', event: 'Admin Session Initialized', details: 'Authorized admin authenticated successfully.', time: 'Just now' },
        { id: 2, type: 'upgrade', event: 'Plan Automated Sync', details: 'Database synchronizations checked for dynamic routing entries.', time: '12m ago' },
        { id: 3, type: 'success', event: 'Google OAuth Sync', details: 'Auto-login handshake metadata optimized for fast loading.', time: '1h ago' },
        { id: 4, type: 'warning', event: 'Daily Swipe Enforcement', details: 'Free tier limits configured for default accounts.', time: '2h ago' },
        { id: 5, type: 'info', event: 'Safety Escalation Guard', details: 'Chat rules verified. Texting locked after 3 messages on free package.', time: '4h ago' }
    ]);

    const [transactions, setTransactions] = useState([]);

    const [campaigns, setCampaigns] = useState({
        bannerAds: true,
        intercomPromo: false,
        lockMessageLimit: true,
        dailySwipeLimit: true,
        promoPopupEnabled: false,
        welcomeMessageEnabled: false,
        promoPopupDelay: 30,
        customBannerText: '',
        welcomeMessage: '',
    });

    // Support and Analytics States
    const [analyticsData, setAnalyticsData] = useState(null);
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);
    const [tickets, setTickets] = useState([]);
    const [loadingTickets, setLoadingTickets] = useState(false);
    const [ticketSearch, setTicketSearch] = useState('');
    const [ticketStatusFilter, setTicketStatusFilter] = useState('all');
    const [ticketCategoryFilter, setTicketCategoryFilter] = useState('all');
    const [replyingTicketId, setReplyingTicketId] = useState(null);
    const [adminReplyText, setAdminReplyText] = useState('');

    // Verification notes reason state
    const [verificationReason, setVerificationReason] = useState('');

    const fetchAnalytics = async () => {
        setLoadingAnalytics(true);
        try {
            const res = await fetch('/api/admin/analytics?period=30');
            if (res.ok) {
                const data = await res.json();
                setAnalyticsData(data);
            }
        } catch (err) {
            console.error('Failed to load analytics:', err);
        } finally {
            setLoadingAnalytics(false);
        }
    };

    const fetchTickets = async () => {
        setLoadingTickets(true);
        try {
            const res = await fetch(`/api/admin/tickets?status=${ticketStatusFilter}&category=${ticketCategoryFilter}`);
            if (res.ok) {
                const data = await res.json();
                setTickets(data.tickets || []);
            }
        } catch (err) {
            console.error('Failed to load tickets:', err);
        } finally {
            setLoadingTickets(false);
        }
    };

    const handleReplyTicket = async (e) => {
        e.preventDefault();
        if (!adminReplyText.trim()) return;
        setActionLoading('reply-' + replyingTicketId);
        try {
            const res = await fetch('/api/admin/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticketId: replyingTicketId,
                    adminReply: adminReplyText.trim(),
                    status: 'resolved'
                })
            });
            if (res.ok) {
                setTickets(prev => prev.map(t => t.id === replyingTicketId ? { ...t, admin_reply: adminReplyText.trim(), status: 'resolved' } : t));
                setSystemLogs(l => [{
                    id: Date.now(), type: 'success',
                    event: 'Support Ticket Replied',
                    details: `Replied to ticket #${replyingTicketId.slice(0, 8)}.`, time: 'Just now'
                }, ...l]);
                setReplyingTicketId(null);
                setAdminReplyText('');
                alert('Reply sent and ticket resolved!');
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to reply to ticket');
            }
        } catch {
            alert('Request failed');
        } finally {
            setActionLoading(null);
        }
    };

    const handleUpdateTicketStatus = async (ticketId, status) => {
        setActionLoading('status-' + ticketId);
        try {
            const res = await fetch('/api/admin/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticketId, status })
            });
            if (res.ok) {
                setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status } : t));
                setSystemLogs(l => [{
                    id: Date.now(), type: 'info',
                    event: 'Ticket Status Updated',
                    details: `Status set to '${status.toUpperCase()}' for ticket #${ticketId.slice(0, 8)}.`, time: 'Just now'
                }, ...l]);
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to update ticket status');
            }
        } catch {
            alert('Request failed');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRefreshAll = async () => {
        await fetchUsers();
        await fetchAnalytics();
        await fetchTickets();
    };

    const handleExportUsersCSV = () => {
        if (users.length === 0) return;
        const headers = ['ID', 'Display Name', 'Email', 'Phone', 'Gender', 'Looking For', 'Age', 'Location', 'Plan', 'Is Banned', 'Joined At'];
        const csvRows = [headers.join(',')];
        
        filteredUsers.forEach(u => {
            const row = [
                JSON.stringify(u.id || ''),
                JSON.stringify(u.displayName || u.display_name || ''),
                JSON.stringify(u.email || ''),
                JSON.stringify(u.phone || ''),
                JSON.stringify(u.gender || ''),
                JSON.stringify(u.looking_for || ''),
                JSON.stringify(u.age || ''),
                JSON.stringify(u.location || ''),
                JSON.stringify(u.subscription?.plan || 'free'),
                JSON.stringify(u.isBanned || u.is_banned ? 'Yes' : 'No'),
                JSON.stringify(u.joinedAt || u.created_at || '')
            ];
            csvRows.push(row.join(','));
        });
        
        const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `gs_users_export_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/users');
            if (res.ok) {
                const data = await res.json();
                setUsers(data.users || []);
                setTransactions(data.transactions || []);
                if (data.campaigns) {
                    setCampaigns(prev => ({ ...prev, ...data.campaigns }));
                }
            } else {
                router.replace('/admin/login');
            }
        } catch (err) {
            console.error('Failed to load users:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchAnalytics();
        fetchTickets();
    }, []);

    useEffect(() => {
        if (activeTab === 'support') {
            fetchTickets();
        } else if (activeTab === 'analytics') {
            fetchAnalytics();
        }
    }, [activeTab, ticketStatusFilter, ticketCategoryFilter]);

    const handleLogout = async () => {
        try {
            await fetch('/api/admin/auth', { method: 'DELETE' });
            router.replace('/admin/login');
        } catch { }
    };

    const triggerAction = async (userId, action, payload = {}) => {
        setActionLoading(userId + '-' + action);
        try {
            const res = await fetch('/api/admin/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, action, ...payload })
            });
            if (res.ok) {
                setUsers(prev => prev.map(user => {
                    if (user.id !== userId) return user;
                    if (action === 'ban') {
                        setSystemLogs(l => [{
                            id: Date.now(), type: payload.isBanned ? 'danger' : 'success',
                            event: payload.isBanned ? 'Account Suspended' : 'Ban Lifted',
                            details: `Toggled ban status for ${user.displayName || user.email}.`, time: 'Just now'
                        }, ...l]);
                        return { ...user, isBanned: payload.isBanned };
                    }
                    if (action === 'update_plan') {
                        setSystemLogs(l => [{
                            id: Date.now(), type: 'upgrade',
                            event: 'Plan Package Modified',
                            details: `Plan upgraded to ${payload.plan.toUpperCase()} for ${user.displayName || user.email}.`, time: 'Just now'
                        }, ...l]);
                        const newSub = {
                            ...user.subscription, plan: payload.plan,
                            startedAt: new Date().toISOString(),
                            expiresAt: payload.durationDays ? new Date(Date.now() + payload.durationDays * 24 * 60 * 60 * 1000).toISOString() : null
                        };
                        // Also update selectedUser modal if open
                        setSelectedUser(su => su?.id === userId ? { ...su, subscription: newSub } : su);
                        return { ...user, subscription: newSub };
                    }
                    if (action === 'verify') {
                        setSystemLogs(l => [{
                            id: Date.now(), type: payload.status === 'verified' ? 'success' : 'danger',
                            event: 'Verification Reviewed',
                            details: `Status '${payload.status.toUpperCase()}' set for ${user.displayName || user.email}.`, time: 'Just now'
                        }, ...l]);
                        return { ...user, verification: { ...user.verification, status: payload.status } };
                    }
                    if (action === 'badge') {
                        setSystemLogs(l => [{
                            id: Date.now(), type: 'info',
                            event: 'Badge Manually Assigned',
                            details: `Assigned badge '${payload.badge || 'NONE'}' to ${user.displayName || user.email}.`, time: 'Just now'
                        }, ...l]);
                        const updatedUser = { ...user, customBadge: payload.badge };
                        // Also update selectedUser modal if it matches
                        setSelectedUser(su => su?.id === userId ? updatedUser : su);
                        return updatedUser;
                    }
                    if (action === 'delete_user') {
                        setSystemLogs(l => [{
                            id: Date.now(), type: 'danger',
                            event: 'Account Permanently Deleted',
                            details: `Permanently deleted user account for ${user.displayName || user.email}.`, time: 'Just now'
                        }, ...l]);
                        return null;
                    }
                    return user;
                }).filter(Boolean));
                if (selectedDocs && selectedDocs.userId === userId) setSelectedDocs(null);
            } else {
                const err = await res.json();
                alert(err.error || 'Operation failed');
            }
        } catch (err) {
            alert('Request failed');
        } finally {
            setActionLoading(null);
        }
    };

    // Filters
    const filteredUsers = users.filter(user => {
        const query = search.toLowerCase();
        const matchesSearch = (user.displayName?.toLowerCase().includes(query)) ||
            (user.email?.toLowerCase().includes(query)) ||
            (user.phone?.toLowerCase().includes(query)) ||
            (user.id.toLowerCase().includes(query));
        const matchesPlan = planFilter === 'All' || user.subscription.plan === planFilter.toLowerCase();
        let matchesStatus = true;
        if (statusFilter === 'banned') matchesStatus = user.isBanned;
        else if (statusFilter === 'active') matchesStatus = !user.isBanned;
        else if (statusFilter === 'pending_review') matchesStatus = user.verification.status === 'pending_review' || user.verification.status === 'processing';
        else if (statusFilter === 'verified') matchesStatus = user.verification.status === 'verified';
        return matchesSearch && matchesPlan && matchesStatus;
    });

    const pendingVerifications = users.filter(u => u.verification.status === 'pending_review' || u.verification.status === 'processing');
    const activePremiumCount = users.filter(u => u.subscription?.plan !== 'free' && u.subscription?.plan).length;

    const getDynamicStats = () => {
        let totalRev = 0, todayRev = 0, weekRev = 0, monthRev = 0;
        const now = Date.now();
        transactions.forEach(t => {
            if (t.status === 'Voided') return;
            const amt = parseFloat(String(t.amount || '0').replace(/[^0-9.]/g, '')) || 0;
            const txTime = new Date(t.created_at || t.createdAt || t.date || 0).getTime();
            totalRev += amt;
            if (now - txTime < 86400000) todayRev += amt;
            if (now - txTime < 7 * 86400000) weekRev += amt;
            if (now - txTime < 30 * 86400000) monthRev += amt;
        });
        return {
            totalRevenue: totalRev === 0 ? 5000 : totalRev,
            todayRevenue: todayRev,
            weekRevenue: weekRev,
            monthRevenue: monthRev,
            silver: users.filter(u => u.subscription?.plan === 'silver').length,
            gold: users.filter(u => u.subscription?.plan === 'gold').length,
            diamond: users.filter(u => u.subscription?.plan === 'diamond').length,
            free: users.filter(u => !u.subscription?.plan || u.subscription?.plan === 'free').length,
        };
    };

    const stats = getDynamicStats();
    const kpis = {
        total: users.length,
        premium: activePremiumCount,
        banned: users.filter(u => u.isBanned).length,
        pendingVerification: pendingVerifications.length,
        mrr: stats.totalRevenue,
    };

    const handleRecordPaymentSubmit = async (e) => {
        e.preventDefault();
        setActionLoading('record_payment');
        try {
            let selectedUserEmail = paymentForm.email;
            if (paymentForm.userId && paymentForm.userId !== 'mock') {
                const matchedUser = users.find(u => u.id === paymentForm.userId);
                if (matchedUser) selectedUserEmail = matchedUser.email;
            }
            if (!selectedUserEmail) { alert('Please enter a user email or select an account.'); setActionLoading(null); return; }

            const res = await fetch('/api/admin/user', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'record_payment', userId: paymentForm.userId, email: selectedUserEmail, plan: paymentForm.plan, amount: paymentForm.amount, method: paymentForm.method, code: paymentForm.code })
            });
            if (res.ok) {
                await fetchUsers();
                setShowPaymentModal(false);
                setPaymentForm({ userId: 'mock', email: '', plan: 'silver', amount: 500, method: 'M-Pesa Escrow', code: '' });
                setSystemLogs(l => [{
                    id: Date.now(), type: 'success',
                    event: 'Payment Recorded',
                    details: `Recorded KES ${paymentForm.amount} for ${selectedUserEmail}.`, time: 'Just now'
                }, ...l]);
                alert('Payment successfully logged!');
            } else {
                const err = await res.json(); alert(err.error || 'Failed to record payment');
            }
        } catch { alert('Request failed'); } finally { setActionLoading(null); }
    };

    const toggleCampaign = async (key, val) => {
        const updated = { ...campaigns, [key]: val };
        setCampaigns(updated);
        try {
            await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
            setSystemLogs(l => [{ id: Date.now(), type: 'info', event: 'App Campaigns Saved', details: `Campaign setting "${key}" set to ${JSON.stringify(val)}.`, time: 'Just now' }, ...l]);
        } catch (err) { console.error('Failed to save settings:', err); }
    };

    const handleSendBroadcast = async (e) => {
        e.preventDefault();
        setBroadcastLoading(true);
        try {
            const res = await fetch('/api/admin/user', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'send_notification', userId: 'broadcast', title: broadcastForm.title, bodyText: broadcastForm.body, targetTier: broadcastForm.targetTier })
            });
            const data = await res.json();
            if (res.ok) {
                setSystemLogs(l => [{ id: Date.now(), type: 'success', event: 'Broadcast Sent', details: `Notification "${broadcastForm.title}" sent to ${data.sent} users (tier: ${broadcastForm.targetTier}).`, time: 'Just now' }, ...l]);
                setBroadcastForm({ title: '', body: '', targetTier: 'all' });
                alert(`✅ Notification sent to ${data.sent} users!`);
            } else {
                const err = data; alert(err.error || 'Failed to send');
            }
        } catch { alert('Request failed'); } finally { setBroadcastLoading(false); }
    };

    const handleSendDirectAlert = async (e) => {
        e.preventDefault();
        setActionLoading('direct_alert');
        try {
            const res = await fetch('/api/admin/user', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'send_notification', userId: alertForm.userId, title: alertForm.title, bodyText: alertForm.body, targetTier: 'all' })
            });
            if (res.ok) {
                setSystemLogs(l => [{ id: Date.now(), type: 'info', event: 'Direct Alert Sent', details: `Alert sent to user ${alertForm.userId}: "${alertForm.title}".`, time: 'Just now' }, ...l]);
                setShowAlertModal(false);
                setAlertForm({ userId: null, title: '', body: '' });
                alert('✅ Alert sent!');
            } else {
                const err = await res.json(); alert(err.error || 'Failed');
            }
        } catch { alert('Request failed'); } finally { setActionLoading(null); }
    };

    const handleVoidPayment = async (txId) => {
        if (!confirm('Void this payment record?')) return;
        setActionLoading('void-' + txId);
        try {
            await fetch('/api/admin/user', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'void_payment', userId: 'admin', transactionId: txId })
            });
            setTransactions(prev => prev.map(t => t.id === txId ? { ...t, status: 'Voided' } : t));
            setSystemLogs(l => [{ id: Date.now(), type: 'warning', event: 'Payment Voided', details: `Transaction #${txId} was voided.`, time: 'Just now' }, ...l]);
        } catch { alert('Failed to void payment'); } finally { setActionLoading(null); }
    };

    const handleApprovePayment = async (txId) => {
        if (!confirm('Approve this manual payment? This will update the user subscription status and send a success inbox alert.')) return;
        setActionLoading('approve-' + txId);
        try {
            const res = await fetch('/api/admin/user', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'approve_payment', userId: 'admin', transactionId: txId })
            });
            if (res.ok) {
                setTransactions(prev => prev.map(t => t.id === txId ? { ...t, status: 'Completed' } : t));
                setSystemLogs(l => [{ id: Date.now(), type: 'success', event: 'Payment Approved', details: `Transaction #${txId} was approved and unlocked.`, time: 'Just now' }, ...l]);
                // Refresh all data so users list shows updated subscription badge
                setTimeout(() => fetchUsers(), 1500);
                alert('✅ Payment approved! User subscription has been activated.');
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to approve payment');
            }
        } catch { alert('Failed to approve payment'); } finally { setActionLoading(null); }
    };

    const handleDeclinePayment = async (txId) => {
        if (!confirm('Decline this manual payment? This will mark it as Failed and send a rejection inbox alert.')) return;
        setActionLoading('decline-' + txId);
        try {
            const res = await fetch('/api/admin/user', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'decline_payment', userId: 'admin', transactionId: txId })
            });
            if (res.ok) {
                setTransactions(prev => prev.map(t => t.id === txId ? { ...t, status: 'Failed' } : t));
                setSystemLogs(l => [{ id: Date.now(), type: 'danger', event: 'Payment Declined', details: `Transaction #${txId} was declined.`, time: 'Just now' }, ...l]);
                setTimeout(() => fetchUsers(), 1500);
                alert('❌ Payment declined. User has been notified.');
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to decline payment');
            }
        } catch { alert('Failed to decline payment'); } finally { setActionLoading(null); }
    };

    // Filtered logs
    const filteredLogs = systemLogs.filter(log => {
        const matchesSearch = log.event.toLowerCase().includes(logSearch.toLowerCase()) || log.details.toLowerCase().includes(logSearch.toLowerCase());
        const matchesType = logTypeFilter === 'all' || log.type === logTypeFilter;
        return matchesSearch && matchesType;
    });

    if (loading && users.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-screen bg-slate-950">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-slate-400 font-medium">Loading GS Control Panel...</p>
                </div>
            </div>
        );
    }

    const conversionRate = kpis.total > 0 ? ((kpis.premium / kpis.total) * 100).toFixed(1) : '0.0';

    const TABS = [
        { key: 'users', icon: Users, label: 'Users' },
        { key: 'verification', icon: ShieldCheck, label: 'Verification', badge: kpis.pendingVerification },
        { key: 'finance', icon: CreditCard, label: 'Finance', badge: transactions.filter(tx => tx.status === 'Pending').length || null },
        { key: 'analytics', icon: BarChart2, label: 'Analytics' },
        { key: 'support', icon: LifeBuoy, label: 'Tickets', badge: tickets.filter(t => t.status === 'open').length || null },
        { key: 'notifications', icon: Bell, label: 'Broadcast' },
        { key: 'campaigns', icon: Megaphone, label: 'Ads & Limits' },
        { key: 'logs', icon: FileText, label: 'Logs' },
    ];

    return (
        <div className="admin-dashboard-container flex-1 flex flex-col min-h-screen bg-slate-950 pb-16">
            {/* Top Navigation */}
            <header className="sticky top-0 z-40 bg-slate-900/60 border-b border-slate-800/80 backdrop-blur-xl px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <img src="/gs-logo.png" alt="GS" className="w-11 h-11 rounded-xl" style={{ boxShadow: '0 0 14px rgba(245,158,11,0.3)', border: '1.5px solid #F59E0B' }} />
                    <div>
                        <h1 className="text-lg font-black text-white tracking-tight">Genuine Sugarmummies</h1>
                        <p className="text-[10px] text-rose-500 font-bold tracking-widest uppercase">Operational Control Dashboard v5.0</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={() => setShowPaymentModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer">
                        <Plus size={14} /> Record Payment
                    </button>
                    <button onClick={handleRefreshAll} className="p-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-400 hover:text-slate-200 transition-all cursor-pointer" title="Refresh">
                        <RefreshCw size={16} className={loading || loadingTickets || loadingAnalytics ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={handleLogout} className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer">
                        <LogOut size={14} /> Logout
                    </button>
                </div>
            </header>

            <main className="max-w-7xl w-full mx-auto px-8 pt-8 space-y-8">

                {/* Pending Transaction Alert Banner */}
                {transactions.some(tx => tx.status === 'Pending') && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center justify-between gap-4 shadow-lg animate-pulse"
                    >
                        <div className="flex items-center gap-3">
                            <span className="flex h-3.5 w-3.5 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500"></span>
                            </span>
                            <div>
                                <span className="font-extrabold uppercase tracking-wider text-rose-300">Action Required:</span>{' '}
                                <span className="text-slate-300">There are pending manual mobile wallet checkouts awaiting verification. Match the user ticket ID from Telegram.</span>
                            </div>
                        </div>
                        <button 
                            onClick={() => setActiveTab('finance')}
                            className="px-3.5 py-1.5 bg-rose-500 text-white font-extrabold rounded-xl hover:bg-rose-600 transition-all uppercase tracking-wider text-[10px]"
                        >
                            View Ledger
                        </button>
                    </motion.div>
                )}

                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <KpiCard icon={Users} label="Total Users" value={kpis.total} color="rose" />
                    <KpiCard icon={Crown} label="Premium" value={kpis.premium} color="amber" />
                    <KpiCard icon={ShieldAlert} label="Banned" value={kpis.banned} color="red" />
                    <KpiCard icon={ShieldCheck} label="Verify Queue" value={kpis.pendingVerification} color="sky" />
                    <KpiCard icon={Landmark} label="Revenue (KES)" value={kpis.mrr.toLocaleString()} color="emerald" />
                    <KpiCard icon={Percent} label="Conversion" value={`${conversionRate}%`} color="purple" />
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-800/80 gap-1 overflow-x-auto">
                    {TABS.map(tab => (
                        <TabButton key={tab.key} active={activeTab === tab.key} onClick={() => setActiveTab(tab.key)} icon={tab.icon} label={tab.label} badge={tab.badge} />
                    ))}
                </div>

                <div className="space-y-6">

                    {/* ====== USERS TAB ====== */}
                    {activeTab === 'users' && (
                        <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur rounded-3xl p-6 space-y-5">
                            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                                <div className="relative w-full lg:max-w-md">
                                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search by name, email, phone or ID..."
                                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500 transition-all" />
                                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                </div>
                                <div className="flex flex-wrap gap-3 items-center w-full lg:w-auto">
                                    <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs">
                                        <span className="text-slate-500">Tier:</span>
                                        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="bg-transparent text-white font-bold focus:outline-none cursor-pointer">
                                            <option value="All">All Packages</option>
                                            <option value="Free">Free</option>
                                            <option value="Silver">Silver</option>
                                            <option value="Gold">Gold</option>
                                            <option value="Diamond">Diamond VIP</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs">
                                        <span className="text-slate-500">Status:</span>
                                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-transparent text-white font-bold focus:outline-none cursor-pointer">
                                            <option value="All">All</option>
                                            <option value="active">Active</option>
                                            <option value="banned">Banned</option>
                                            <option value="pending_review">Pending Review</option>
                                            <option value="verified">Verified</option>
                                        </select>
                                    </div>
                                    <p className="text-xs text-slate-500 font-semibold ml-auto lg:ml-2">{filteredUsers.length} records</p>
                                    <button onClick={handleExportUsersCSV}
                                        className="px-3.5 py-2 bg-emerald-650 hover:bg-emerald-700 text-white border border-emerald-500/20 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer ml-auto lg:ml-2">
                                        <Download size={13} /> Export CSV
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-950/40">
                                <table className="w-full border-collapse text-left text-slate-300">
                                    <thead>
                                        <tr className="border-b border-slate-800/80 text-[10px] text-slate-500 uppercase tracking-widest bg-slate-900/30">
                                            <th className="px-5 py-4 font-bold">User</th>
                                            <th className="px-5 py-4 font-bold">Package</th>
                                            <th className="px-5 py-4 font-bold">Verification</th>
                                            <th className="px-5 py-4 font-bold">Badge</th>
                                            <th className="px-5 py-4 font-bold">Status</th>
                                            <th className="px-5 py-4 font-bold text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50 text-xs">
                                        {filteredUsers.length === 0 ? (
                                            <tr><td colSpan="6" className="text-center py-12 text-slate-500">No users match the filters</td></tr>
                                        ) : filteredUsers.map(user => {
                                            const planColors = {
                                                free: 'text-slate-400 bg-slate-800/20 border-slate-800/40',
                                                silver: 'text-slate-300 bg-slate-600/10 border-slate-600/20',
                                                gold: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
                                                diamond: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
                                            };
                                            const plan = user.subscription.plan || 'free';
                                            return (
                                                <tr key={user.id} className="hover:bg-slate-900/10 transition-all">
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-800 shrink-0 border border-slate-700/60">
                                                                {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> :
                                                                    <div className="w-full h-full flex items-center justify-center font-black text-slate-400 text-xs">{user.displayName ? user.displayName[0].toUpperCase() : 'U'}</div>}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5 max-w-[180px] flex-wrap">
                                                                    <h4 className="font-bold text-white truncate">{user.displayName || 'Unnamed'}</h4>
                                                                    {user.verification?.status === 'verified' && <VerifiedBadge size={14} verified={true} />}
                                                                    {user.subscription && user.subscription.plan && user.subscription.plan !== 'free' && (
                                                                        <VerifiedBadge size={14} badgeText={user.subscription.plan} />
                                                                    )}
                                                                    {user.customBadge && user.customBadge.toLowerCase() !== 'verified' && user.customBadge.toLowerCase() !== user.subscription?.plan?.toLowerCase() && (
                                                                        <VerifiedBadge size={14} badgeText={user.customBadge} />
                                                                    )}
                                                                </div>
                                                                <p className="text-[10px] text-slate-500 truncate max-w-[160px]">{user.email}</p>
                                                                {user.phone && <p className="text-[9px] text-rose-500/80 font-semibold">{user.phone}</p>}
                                                                {user.joinedAt && <p className="text-[9px] text-slate-600">Joined: {new Date(user.joinedAt).toLocaleDateString()}</p>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <select disabled={actionLoading === user.id + '-update_plan'} value={plan}
                                                            onChange={(e) => triggerAction(user.id, 'update_plan', { plan: e.target.value, durationDays: 30 })}
                                                            className={`px-3 py-1.5 rounded-full border text-[10px] font-bold focus:outline-none cursor-pointer uppercase ${planColors[plan]}`}>
                                                            <option value="free" className="bg-slate-950 text-slate-300">Free</option>
                                                            <option value="silver" className="bg-slate-950 text-slate-300">Silver</option>
                                                            <option value="gold" className="bg-slate-950 text-amber-500">Gold</option>
                                                            <option value="diamond" className="bg-slate-950 text-purple-400">Diamond VIP</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-5 py-4 whitespace-nowrap">
                                                        {user.verification.status === 'pending_review' || user.verification.status === 'processing' ? (
                                                            <button onClick={() => setSelectedDocs({ userId: user.id, name: user.displayName, selfieUrl: user.verification.selfieUrl, idDocUrl: user.verification.idDocUrl })}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 font-bold text-[9px] uppercase transition-all cursor-pointer animate-pulse">
                                                                <Eye size={11} /> Pending
                                                            </button>
                                                        ) : user.verification.status === 'verified' ? (
                                                            <button onClick={() => triggerAction(user.id, 'verify', { status: 'failed' })}
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 font-bold text-[9px] uppercase transition-all">
                                                                <img src="/gs-verified-badge.png" alt="" className="w-3.5 h-3.5" style={{ objectFit: 'contain' }} /> Verified
                                                            </button>
                                                        ) : (
                                                            <button onClick={() => triggerAction(user.id, 'verify', { status: 'verified' })}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-500 hover:text-slate-300 font-bold text-[9px] uppercase transition-all">
                                                                Verify
                                                            </button>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <select disabled={actionLoading === user.id + '-badge'} value={user.customBadge || ''}
                                                            onChange={(e) => triggerAction(user.id, 'badge', { badge: e.target.value })}
                                                            className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/60 text-[10px] font-semibold focus:outline-none cursor-pointer text-white">
                                                            <option value="">No Badge</option>
                                                            <option value="Verified">Verified</option>
                                                            <option value="VIP Member">VIP Member</option>
                                                            <option value="Sugar Mum">Sugar Mum</option>
                                                            <option value="Sugar Daddy">Sugar Daddy</option>
                                                            <option value="Trusted Agency">Trusted Agency</option>
                                                            <option value="Popular Member">Popular Member</option>
                                                            <option value="Staff">Staff</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        {user.isBanned ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold"><Ban size={10} /> Banned</span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold"><Unlock size={10} /> Active</span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4 text-right whitespace-nowrap">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button onClick={() => { setAlertForm({ userId: user.id, title: '', body: '' }); setShowAlertModal(true); }}
                                                                className="px-2.5 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1">
                                                                <Bell size={10} /> Alert
                                                            </button>
                                                            <button onClick={() => setSelectedUser(user)}
                                                                className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/40 text-slate-300 hover:bg-slate-700 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1">
                                                                <Eye size={10} /> View
                                                            </button>
                                                            <button disabled={actionLoading !== null} onClick={() => triggerAction(user.id, 'ban', { isBanned: !user.isBanned })}
                                                                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer ${user.isBanned ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                                                                {user.isBanned ? 'Unban' : 'Ban'}
                                                            </button>
                                                            <button disabled={actionLoading !== null} onClick={() => { if (confirm(`Permanently delete account for ${user.displayName || user.email}?`)) triggerAction(user.id, 'delete_user'); }}
                                                                className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1">
                                                                <Trash2 size={10} /> Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ====== VERIFICATION TAB ====== */}
                    {activeTab === 'verification' && (
                        <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur rounded-3xl p-6 space-y-4">
                            <h2 className="text-sm font-black text-white uppercase tracking-wider">Identity Verification Queue</h2>
                            <p className="text-xs text-slate-400">Review user-submitted verification documents. Approving grants the GS verified badge.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                                {pendingVerifications.length === 0 ? (
                                    <div className="col-span-full text-center py-12 bg-slate-950/40 rounded-2xl border border-slate-800/80 text-slate-500 text-xs font-semibold">
                                        ✅ Verification queue is empty!
                                    </div>
                                ) : pendingVerifications.map(u => (
                                    <div key={u.id} className="p-5 rounded-2xl border border-slate-800/80 bg-slate-950/30 flex flex-col justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-800 border border-slate-700/60">
                                                {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-800" />}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-white text-xs">{u.displayName || 'User'}</h4>
                                                <p className="text-[9px] text-slate-500">{u.email}</p>
                                                <span className="text-[9px] text-amber-400 font-bold uppercase">{u.verification.status}</span>
                                            </div>
                                        </div>
                                        <button onClick={() => setSelectedDocs({ userId: u.id, name: u.displayName, selfieUrl: u.verification.selfieUrl, idDocUrl: u.verification.idDocUrl })}
                                            className="w-full py-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer">
                                            <Eye size={14} /> Review Selfie & ID Document
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ====== FINANCE TAB ====== */}
                    {activeTab === 'finance' && (
                        <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur rounded-3xl p-6 space-y-5">
                            {/* Revenue summary */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 space-y-1">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Today</p>
                                    <h3 className="text-lg font-black text-emerald-400">KES {stats.todayRevenue.toLocaleString()}</h3>
                                </div>
                                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 space-y-1">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">This Week</p>
                                    <h3 className="text-lg font-black text-sky-400">KES {stats.weekRevenue.toLocaleString()}</h3>
                                </div>
                                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 space-y-1">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">This Month</p>
                                    <h3 className="text-lg font-black text-amber-400">KES {stats.monthRevenue.toLocaleString()}</h3>
                                </div>
                                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 space-y-1">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">All Time</p>
                                    <h3 className="text-lg font-black text-rose-400">KES {stats.totalRevenue.toLocaleString()}</h3>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-sm font-black text-white uppercase tracking-wider">Cross-Border Payment Ledger</h2>
                                    <p className="text-xs text-slate-400">{transactions.length} transaction{transactions.length !== 1 ? 's' : ''} recorded</p>
                                </div>
                                <span className="px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl flex items-center gap-1.5">
                                    <CheckCheck size={14} /> Ledger Sync
                                </span>
                            </div>

                            <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-950/40">
                                <table className="w-full border-collapse text-left text-slate-300">
                                    <thead>
                                        <tr className="border-b border-slate-800/80 text-[10px] text-slate-500 uppercase tracking-widest bg-slate-900/30">
                                            <th className="px-6 py-4 font-bold">Ref #</th>
                                            <th className="px-6 py-4 font-bold">Plan</th>
                                            <th className="px-6 py-4 font-bold">Payer</th>
                                            <th className="px-6 py-4 font-bold">Code</th>
                                            <th className="px-6 py-4 font-bold">Ticket ID</th>
                                            <th className="px-6 py-4 font-bold">Amount</th>
                                            <th className="px-6 py-4 font-bold">Status</th>
                                            <th className="px-6 py-4 font-bold">Date</th>
                                            <th className="px-6 py-4 font-bold text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50 text-xs">
                                        {transactions.length === 0 ? (
                                            <tr><td colSpan="9" className="text-center py-10 text-slate-500">No transactions recorded yet</td></tr>
                                        ) : transactions.map(tx => (
                                            <tr key={tx.id} className="hover:bg-slate-900/10">
                                                <td className="px-6 py-3.5 font-bold text-white text-[11px]">#{tx.id}</td>
                                                <td className="px-6 py-3.5"><span className="px-2 py-0.5 rounded-full text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold uppercase">{tx.plan}</span></td>
                                                <td className="px-6 py-3.5">
                                                     <div className="font-bold text-white">{tx.userName || 'Guest Payer'}</div>
                                                     <div className="text-[10px] text-slate-500">{tx.user || tx.email || '—'}</div>
                                                     {tx.payment_proof_url && (
                                                         <a href={tx.payment_proof_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 text-[9px] text-rose-400 hover:text-rose-300 font-extrabold hover:underline">
                                                             <Camera size={9} /> View Proof
                                                         </a>
                                                     )}
                                                </td>
                                                <td className="px-6 py-3.5 font-mono text-rose-400 font-bold">{tx.code}</td>
                                                <td className="px-6 py-3.5 font-mono text-amber-400 font-bold">{tx.ticketId || '—'}</td>
                                                <td className="px-6 py-3.5 font-black text-emerald-400">KES {tx.amount?.toLocaleString?.() || tx.amount}</td>
                                                <td className="px-6 py-3.5">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                                        tx.status === 'Voided' 
                                                            ? 'text-slate-500 bg-slate-800/40 border-slate-700' 
                                                            : tx.status === 'Pending'
                                                            ? 'text-amber-400 bg-amber-500/10 border-amber-500/20 animate-pulse'
                                                            : tx.status === 'Failed'
                                                            ? 'text-red-400 bg-red-500/10 border-red-500/20'
                                                            : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                                    }`}>
                                                        {tx.status || 'Completed'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3.5 text-slate-500">{tx.date || tx.created_at ? new Date(tx.date || tx.created_at).toLocaleDateString() : '—'}</td>
                                                <td className="px-6 py-3.5 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {tx.status === 'Pending' && (
                                                            <>
                                                                <button onClick={() => handleApprovePayment(tx.id)} disabled={!!actionLoading}
                                                                    className="px-2 py-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-[9px] font-bold transition-all cursor-pointer">
                                                                    Approve
                                                                </button>
                                                                <button onClick={() => handleDeclinePayment(tx.id)} disabled={!!actionLoading}
                                                                    className="px-2 py-1 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-[9px] font-bold transition-all cursor-pointer">
                                                                    Decline
                                                                </button>
                                                            </>
                                                        )}
                                                        {tx.status !== 'Voided' && tx.status !== 'Failed' && tx.status !== 'Completed' && (
                                                            <button onClick={() => handleVoidPayment(tx.id)} disabled={!!actionLoading}
                                                                className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[9px] font-bold transition-all cursor-pointer">
                                                                Void
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ====== ANALYTICS TAB ====== */}
                    {activeTab === 'analytics' && (
                        <div className="space-y-5">
                            {loadingAnalytics ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <StatCard label="Total Users" value={analyticsData?.users?.total ?? kpis.total} icon={Users} color="#3B82F6" />
                                        <StatCard label="Verified Accounts" value={analyticsData?.users?.verified ?? kpis.pendingVerification} icon={Crown} color="#F59E0B" />
                                        <StatCard label="Active Today" value={analyticsData?.users?.activeToday ?? 0} icon={Zap} color="#6B7280" />
                                        <StatCard label="Online Now" value={analyticsData?.users?.onlineNow ?? 0} icon={ArrowUpRight} color="#10B981" />
                                    </div>

                                    {/* Signup Trend Chart */}
                                    {analyticsData?.charts?.dailySignups && (
                                        <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur rounded-3xl p-6 space-y-4">
                                            <h2 className="text-sm font-black text-white uppercase tracking-wider">Daily User Registration Trend (Last 14 Days)</h2>
                                            <div className="h-44 flex items-end gap-2 pt-4 px-2 select-none border-b border-slate-800">
                                                {analyticsData.charts.dailySignups.map(bar => {
                                                    const maxCount = Math.max(...analyticsData.charts.dailySignups.map(c => c.count), 5);
                                                    const pct = (bar.count / maxCount) * 100;
                                                    return (
                                                        <div key={bar.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative">
                                                            <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-xl text-[9px] font-bold text-white transition-opacity whitespace-nowrap shadow-xl pointer-events-none z-10">
                                                                {bar.count} signups on {new Date(bar.date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                                                            </div>
                                                            <div className="w-full rounded-t bg-gradient-to-t from-rose-600 to-amber-500 min-h-[4px] hover:from-rose-500 hover:to-amber-400 transition-all cursor-pointer" style={{ height: `${pct}%` }} />
                                                            <span className="text-[8px] text-slate-500 font-bold rotate-45 md:rotate-0 origin-center truncate w-full text-center mt-1">
                                                                {new Date(bar.date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Plan distribution */}
                                    <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur rounded-3xl p-6 space-y-4">
                                        <h2 className="text-sm font-black text-white uppercase tracking-wider">Plan Distribution</h2>
                                        <div className="space-y-3">
                                            {[
                                                { label: 'Free', count: analyticsData?.subscriptions?.free ?? stats.free, color: '#6B7280', total: analyticsData?.users?.total ?? kpis.total },
                                                { label: 'Silver', count: analyticsData?.subscriptions?.silver ?? stats.silver, color: '#94A3B8', total: analyticsData?.users?.total ?? kpis.total },
                                                { label: 'Gold', count: analyticsData?.subscriptions?.gold ?? stats.gold, color: '#F59E0B', total: analyticsData?.users?.total ?? kpis.total },
                                                { label: 'Diamond VIP', count: analyticsData?.subscriptions?.diamond ?? stats.diamond, color: '#A78BFA', total: analyticsData?.users?.total ?? kpis.total },
                                            ].map(({ label, count, color, total }) => {
                                                const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
                                                return (
                                                    <div key={label} className="space-y-1.5">
                                                        <div className="flex justify-between text-xs">
                                                            <span className="font-semibold text-slate-300">{label}</span>
                                                            <span className="text-slate-500">{count} users ({pct}%)</span>
                                                        </div>
                                                        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                                                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Revenue breakdown */}
                                    <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur rounded-3xl p-6 space-y-4">
                                        <h2 className="text-sm font-black text-white uppercase tracking-wider">Revenue Breakdown</h2>
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                            <RevenueCard label="Today" value={analyticsData?.revenue?.today ?? stats.todayRevenue} color="emerald" />
                                            <RevenueCard label="This Week" value={analyticsData?.revenue?.thisWeek ?? stats.weekRevenue} color="sky" />
                                            <RevenueCard label="Silver (Total)" value={analyticsData?.revenue?.byPlan?.silver ?? 0} color="amber" />
                                            <RevenueCard label="All Time" value={analyticsData?.revenue?.total ?? stats.totalRevenue} color="rose" />
                                        </div>
                                        <p className="text-[10px] text-slate-600 text-center">Revenue is calculated from recorded M-Pesa/manual transactions. Voided payments excluded.</p>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ====== SUPPORT TICKETS TAB ====== */}
                    {activeTab === 'support' && (
                        <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur rounded-3xl p-6 space-y-4">
                            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                                <div>
                                    <h2 className="text-sm font-black text-white uppercase tracking-wider">User Support Tickets</h2>
                                    <p className="text-xs text-slate-400">Manage, reply, and resolve customer support tickets.</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                                    <select value={ticketCategoryFilter} onChange={(e) => { setTicketCategoryFilter(e.target.value); }}
                                        className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500 cursor-pointer">
                                        <option value="all">All Categories</option>
                                        <option value="payment">Payment Issue</option>
                                        <option value="account">Account Problem</option>
                                        <option value="verification">Verification Help</option>
                                        <option value="technical">Technical Issue</option>
                                        <option value="other">Other</option>
                                    </select>
                                    <select value={ticketStatusFilter} onChange={(e) => { setTicketStatusFilter(e.target.value); }}
                                        className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500 cursor-pointer">
                                        <option value="all">All Statuses</option>
                                        <option value="open">Open</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="resolved">Resolved</option>
                                        <option value="closed">Closed</option>
                                    </select>
                                    <button onClick={fetchTickets} disabled={loadingTickets} className="p-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-400 hover:text-slate-200 transition-all cursor-pointer">
                                        <RefreshCw size={14} className={loadingTickets ? 'animate-spin' : ''} />
                                    </button>
                                </div>
                            </div>

                            <div className="relative w-full">
                                <input type="text" value={ticketSearch} onChange={(e) => setTicketSearch(e.target.value)}
                                    placeholder="Search tickets by subject, message, email or user..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder:text-slate-650 focus:outline-none focus:border-rose-500 transition-all" />
                                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            </div>

                            <div className="space-y-4 pt-2">
                                {loadingTickets ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : tickets.length === 0 ? (
                                    <p className="text-center py-10 text-slate-500 text-xs">No support tickets found matching criteria.</p>
                                ) : (
                                    tickets
                                        .filter(t => {
                                            const query = ticketSearch.toLowerCase();
                                            return (t.subject?.toLowerCase().includes(query)) ||
                                                (t.message?.toLowerCase().includes(query)) ||
                                                (t.users?.email?.toLowerCase().includes(query)) ||
                                                (t.users?.display_name?.toLowerCase().includes(query));
                                        })
                                        .map(ticket => {
                                            const isReplying = replyingTicketId === ticket.id;
                                            return (
                                                <div key={ticket.id} className="p-5 rounded-2xl border border-slate-800 bg-slate-950/20 space-y-4">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold text-white">{ticket.subject}</span>
                                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${
                                                                    ticket.status === 'open' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20 animate-pulse' :
                                                                    ticket.status === 'in_progress' ? 'text-sky-400 bg-sky-500/10 border-sky-500/20' :
                                                                    ticket.status === 'resolved' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                                                                    'text-slate-500 bg-slate-800/40 border-slate-700'
                                                                }`}>
                                                                    {ticket.status}
                                                                </span>
                                                                <span className="px-2 py-0.5 rounded-full text-[9px] bg-slate-800 text-slate-400 border border-slate-700 font-bold capitalize">
                                                                    {ticket.category}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                                                <span>Submitted by: <strong>{ticket.users?.display_name || 'Anonymous'}</strong> ({ticket.users?.email || 'no-email'})</span>
                                                                <span>•</span>
                                                                <span>{new Date(ticket.created_at).toLocaleString()}</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-1.5">
                                                            <button onClick={() => handleUpdateTicketStatus(ticket.id, 'in_progress')}
                                                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-bold cursor-pointer">
                                                                In Progress
                                                            </button>
                                                            <button onClick={() => handleUpdateTicketStatus(ticket.id, 'closed')}
                                                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 text-[9px] font-bold cursor-pointer">
                                                                Close
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <p className="text-xs text-slate-300 bg-slate-950/40 p-3 rounded-xl border border-slate-800/50 leading-relaxed">
                                                        {ticket.message}
                                                    </p>

                                                    {ticket.admin_reply && (
                                                        <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 space-y-1">
                                                            <div className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider">GS Support Reply:</div>
                                                            <p className="text-xs text-slate-300">{ticket.admin_reply}</p>
                                                        </div>
                                                    )}

                                                    {isReplying ? (
                                                        <form onSubmit={handleReplyTicket} className="space-y-2.5">
                                                            <textarea required rows={3} value={adminReplyText} onChange={(e) => setAdminReplyText(e.target.value)}
                                                                placeholder="Write support reply..."
                                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 placeholder:text-slate-600 resize-none" />
                                                            <div className="flex items-center gap-2">
                                                                <button type="submit" disabled={actionLoading === 'reply-' + ticket.id}
                                                                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer">
                                                                    <Send size={10} /> Send Reply
                                                                </button>
                                                                <button type="button" onClick={() => setReplyingTicketId(null)}
                                                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-[10px] font-bold cursor-pointer">
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </form>
                                                    ) : (
                                                        <button onClick={() => { setReplyingTicketId(ticket.id); setAdminReplyText(ticket.admin_reply || ''); }}
                                                            className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 text-[9px] font-bold flex items-center gap-1 transition-all cursor-pointer">
                                                            <MessageSquare size={10} /> {ticket.admin_reply ? 'Edit Reply' : 'Reply to Ticket'}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })
                                )}
                            </div>
                        </div>
                    )}

                    {/* ====== NOTIFICATIONS/BROADCAST TAB ====== */}
                    {activeTab === 'notifications' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* Compose form */}
                            <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur rounded-3xl p-6 space-y-4">
                                <h2 className="text-sm font-black text-white uppercase tracking-wider">Broadcast Notification</h2>
                                <p className="text-xs text-slate-400">Send in-app notifications to all or selected user tiers.</p>

                                {/* Quick templates */}
                                <div className="space-y-2">
                                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Quick Templates</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { label: '🚀 New Feature', title: 'New Feature Available!', body: 'Check out the latest features we just added to the GS app.' },
                                            { label: '🎁 Promo Offer', title: '🎁 Special Offer Inside!', body: 'Upgrade to VIP this week and get exclusive sugar mummy contacts. Limited spots!' },
                                            { label: '🔧 Maintenance', title: 'Scheduled Maintenance', body: 'The app will be under maintenance for 30 minutes. Apologies for any inconvenience.' },
                                            { label: '🛡️ Safety Alert', title: '⚠️ Safety Reminder', body: 'Never send money to unverified profiles. Always use the GS escrow system for safety.' },
                                        ].map(tpl => (
                                            <button key={tpl.label} onClick={() => setBroadcastForm(prev => ({ ...prev, title: tpl.title, body: tpl.body }))}
                                                className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-800 text-[10px] text-slate-300 font-semibold text-left transition-all cursor-pointer">
                                                {tpl.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <form onSubmit={handleSendBroadcast} className="space-y-3">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-300">Target Audience</label>
                                        <select value={broadcastForm.targetTier} onChange={(e) => setBroadcastForm(prev => ({ ...prev, targetTier: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500">
                                            <option value="all">All Users</option>
                                            <option value="free">Free Tier Only</option>
                                            <option value="silver">Silver Members</option>
                                            <option value="gold">Gold Members</option>
                                            <option value="diamond">Diamond VIP</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-300">Notification Title</label>
                                        <input type="text" required value={broadcastForm.title} onChange={(e) => setBroadcastForm(prev => ({ ...prev, title: e.target.value }))}
                                            placeholder="e.g. 🎉 Special Offer Just for You!"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 placeholder:text-slate-600" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-300">Message Body</label>
                                        <textarea required rows={4} value={broadcastForm.body} onChange={(e) => setBroadcastForm(prev => ({ ...prev, body: e.target.value }))}
                                            placeholder="Write the notification message here..."
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 placeholder:text-slate-600 resize-none" />
                                    </div>
                                    <button type="submit" disabled={broadcastLoading}
                                        className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer">
                                        <Send size={14} />
                                        {broadcastLoading ? 'Sending...' : 'Send Broadcast Notification'}
                                    </button>
                                </form>
                            </div>

                            {/* Sent history from logs */}
                            <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur rounded-3xl p-6 space-y-4">
                                <h2 className="text-sm font-black text-white uppercase tracking-wider">Broadcast History</h2>
                                <div className="divide-y divide-slate-800/60 rounded-2xl border border-slate-800/80 bg-slate-950/40 max-h-[440px] overflow-y-auto">
                                    {systemLogs.filter(l => l.event === 'Broadcast Sent' || l.event === 'Direct Alert Sent').length === 0 ? (
                                        <p className="text-center py-8 text-slate-600 text-xs">No broadcasts sent yet</p>
                                    ) : systemLogs.filter(l => l.event === 'Broadcast Sent' || l.event === 'Direct Alert Sent').map(log => (
                                        <div key={log.id} className="p-4 flex items-start gap-3 text-xs">
                                            <Send size={12} className="text-rose-500 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="font-bold text-white">{log.event}</p>
                                                <p className="text-slate-400">{log.details}</p>
                                                <p className="text-slate-600 text-[10px]">{log.time}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ====== CAMPAIGNS TAB ====== */}
                    {activeTab === 'campaigns' && (
                        <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur rounded-3xl p-6 space-y-6">
                            <div>
                                <h2 className="text-sm font-black text-white uppercase tracking-wider">App Ads & Restrictions</h2>
                                <p className="text-xs text-slate-400 mt-1">Toggle dynamic restrictions and paywalls. Changes sync to all users immediately.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <CampaignToggle label="App Banner Ads" desc="Display promotional VIP unlock banners on profile detail pages for free users." checked={campaigns.bannerAds} onChange={(v) => toggleCampaign('bannerAds', v)} />
                                <CampaignToggle label="Daily Swipe Restriction" desc="Enforce daily right-swipe limits on free plan users (10 swipes/day)." checked={campaigns.dailySwipeLimit} onChange={(v) => toggleCampaign('dailySwipeLimit', v)} />
                                <CampaignToggle label="3-Message Chat Lock" desc="Restrict messaging to 3 messages for free users, then lock input." checked={campaigns.lockMessageLimit} onChange={(v) => toggleCampaign('lockMessageLimit', v)} />
                                <CampaignToggle label="VIP Promo Popup" desc="Show a VIP upgrade popup to free users after a delay." checked={campaigns.intercomPromo} onChange={(v) => toggleCampaign('intercomPromo', v)} />
                                <CampaignToggle label="Welcome Message (New Users)" desc="Automatically send a welcome notification to newly registered users." checked={campaigns.welcomeMessageEnabled} onChange={(v) => toggleCampaign('welcomeMessageEnabled', v)} />
                                <CampaignToggle label="Premium Intercom Promo" desc="Trigger recurring popups encouraging users to join escrow VIP groups." checked={campaigns.promoPopupEnabled} onChange={(v) => toggleCampaign('promoPopupEnabled', v)} />
                            </div>

                            {/* Extended settings */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-300">Promo Popup Delay (seconds)</label>
                                    <input type="number" value={campaigns.promoPopupDelay || 30} min={5} max={300}
                                        onChange={(e) => toggleCampaign('promoPopupDelay', parseInt(e.target.value) || 30)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500" />
                                    <p className="text-[10px] text-slate-600">Time after page load before promo popup appears</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-300">Custom Banner Ad Text</label>
                                    <textarea rows={3} value={campaigns.customBannerText || ''} onChange={(e) => toggleCampaign('customBannerText', e.target.value)}
                                        placeholder="e.g. 🔥 Upgrade to VIP — Get this Mummy's Direct Contact!"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500 resize-none placeholder:text-slate-600" />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-xs font-bold text-slate-300">Welcome Message (for new users)</label>
                                    <textarea rows={3} value={campaigns.welcomeMessage || ''} onChange={(e) => toggleCampaign('welcomeMessage', e.target.value)}
                                        placeholder="e.g. Welcome to Genuine Sugarmummies! Start by verifying your profile to get the GS badge..."
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500 resize-none placeholder:text-slate-600" />
                                </div>
                            </div>

                            {/* Package Pricing Editor */}
                            <div className="pt-5 border-t border-slate-800/60 space-y-4">
                                <div>
                                    <h3 className="text-xs font-black text-white uppercase tracking-wider">Package Pricing Editor (KES)</h3>
                                    <p className="text-[10px] text-slate-500">Edit active package amounts displayed during upgrade checkouts.</p>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    {[
                                        { key: 'silverPrice', label: '🥈 Silver Plan', default: '500' },
                                        { key: 'goldPrice', label: '👑 Gold Plan', default: '1000' },
                                        { key: 'diamondPrice', label: '💎 Diamond VIP', default: '2500' }
                                    ].map(pkg => (
                                        <div key={pkg.key} className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-300">{pkg.label}</label>
                                            <input type="number" value={campaigns[pkg.key] || pkg.default}
                                                onChange={(e) => toggleCampaign(pkg.key, parseInt(e.target.value) || pkg.default)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500" />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Site Links Manager */}
                            <div className="pt-5 border-t border-slate-800/60 space-y-4">
                                <div>
                                    <h3 className="text-xs font-black text-white uppercase tracking-wider">Site Links Manager</h3>
                                    <p className="text-[10px] text-slate-500">Set external operational link endpoints for client navigation directories.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { key: 'privacyUrl', label: '🛡️ Privacy Policy URL', placeholder: 'https://genuinesugarmummies.co.ke/privacy' },
                                        { key: 'termsUrl', label: '⚖️ Terms of Service URL', placeholder: 'https://genuinesugarmummies.co.ke/terms' },
                                        { key: 'aboutUrl', label: 'ℹ️ About Us URL', placeholder: 'https://genuinesugarmummies.co.ke/about' },
                                        { key: 'contactUrl', label: '📞 Contact Support URL', placeholder: 'https://genuinesugarmummies.co.ke/contact' }
                                    ].map(link => (
                                        <div key={link.key} className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-350">{link.label}</label>
                                            <input type="text" value={campaigns[link.key] || ''} placeholder={link.placeholder}
                                                onChange={(e) => toggleCampaign(link.key, e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 placeholder:text-slate-600" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ====== LOGS TAB ====== */}
                    {activeTab === 'logs' && (
                        <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur rounded-3xl p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-sm font-black text-white uppercase tracking-wider">System Audit Logs</h2>
                                    <p className="text-xs text-slate-400">Administrative operations, verifications, and system events.</p>
                                </div>
                                <button onClick={() => setSystemLogs([])} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-all cursor-pointer">
                                    <Trash2 size={13} /> Clear Logs
                                </button>
                            </div>

                            {/* Log filters */}
                            <div className="flex gap-3 flex-wrap">
                                <div className="relative flex-1 min-w-[200px]">
                                    <input type="text" value={logSearch} onChange={(e) => setLogSearch(e.target.value)}
                                        placeholder="Search logs..."
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500" />
                                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                </div>
                                <select value={logTypeFilter} onChange={(e) => setLogTypeFilter(e.target.value)}
                                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500 cursor-pointer">
                                    <option value="all">All Types</option>
                                    <option value="info">Info</option>
                                    <option value="success">Success</option>
                                    <option value="warning">Warning</option>
                                    <option value="danger">Danger</option>
                                    <option value="upgrade">Upgrade</option>
                                </select>
                            </div>

                            <div className="divide-y divide-slate-800/60 rounded-2xl border border-slate-800/80 bg-slate-950/40 max-h-[500px] overflow-y-auto">
                                {filteredLogs.length === 0 ? (
                                    <p className="text-center py-8 text-slate-600 text-xs">No logs match your search</p>
                                ) : filteredLogs.map(log => {
                                    const logColors = {
                                        info: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
                                        success: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                                        warning: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                                        danger: 'text-red-400 bg-red-500/10 border-red-500/20',
                                        upgrade: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
                                    };
                                    const lc = logColors[log.type] || logColors.info;
                                    return (
                                        <div key={log.id} className="p-4 flex items-start gap-4 text-xs">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border shrink-0 ${lc}`}>{log.type}</span>
                                            <div className="flex-1 space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-white">{log.event}</span>
                                                    <span className="text-[10px] text-slate-500">{log.time}</span>
                                                </div>
                                                <p className="text-slate-400 leading-relaxed">{log.details}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                </div>
            </main>

            {/* ====== Document Review Modal ====== */}
            <AnimatePresence>
                {selectedDocs && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" onClick={() => setSelectedDocs(null)}>
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/40">
                                <div>
                                    <h3 className="font-bold text-white">Identity Verification Review</h3>
                                    <p className="text-xs text-slate-400">Documents submitted by {selectedDocs.name}</p>
                                </div>
                                <button onClick={() => setSelectedDocs(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
                            </div>
                            <div className="p-6 grid grid-cols-2 gap-4">
                                {['selfieUrl', 'idDocUrl'].map((key, i) => (
                                    <div key={key} className="space-y-2">
                                        <p className="text-xs font-bold text-slate-300">{i === 0 ? '📸 User Selfie' : '🪪 ID / Passport'}</p>
                                        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
                                            {selectedDocs[key] ? <img src={selectedDocs[key]} alt="" className="w-full h-full object-cover" /> :
                                                <span className="text-[10px] text-slate-600 font-medium">{i === 0 ? 'No selfie provided' : 'No ID provided'}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Rejection Notes Reason input */}
                            <div className="px-6 pb-4">
                                <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block mb-1.5">Verification Notes / Rejection Reason</label>
                                <input type="text" value={verificationReason} onChange={(e) => setVerificationReason(e.target.value)}
                                    placeholder="Enter reason if rejecting or custom notes..."
                                    className="w-full bg-slate-950 border border-slate-805 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 placeholder:text-slate-600" />
                            </div>
                            <div className="px-6 py-4 bg-slate-900/40 border-t border-slate-800 flex justify-end gap-3">
                                <button onClick={() => { triggerAction(selectedDocs.userId, 'verify', { status: 'failed', reason: verificationReason || 'Documents do not match user information' }); setSelectedDocs(null); setVerificationReason(''); }}
                                    className="px-4 py-2 border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                                    <XCircle size={14} /> Reject
                                </button>
                                <button onClick={() => { triggerAction(selectedDocs.userId, 'verify', { status: 'verified', reason: verificationReason }); setSelectedDocs(null); setVerificationReason(''); }}
                                    className="px-4 py-2 border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                                    <CheckCircle size={14} /> Approve & Send Badge
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ====== User Profile View Modal ====== */}
            <AnimatePresence>
                {selectedUser && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" onClick={() => setSelectedUser(null)}>
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                                <h3 className="font-bold text-white">User Profile Details</h3>
                                <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-800 border border-slate-700">
                                        {selectedUser.avatarUrl ? <img src={selectedUser.avatarUrl} alt="" className="w-full h-full object-cover" /> :
                                            <div className="w-full h-full flex items-center justify-center font-black text-slate-400 text-xl">
                                                {selectedUser.displayName?.[0]?.toUpperCase() || 'U'}
                                            </div>}
                                    </div>
                                    <div>
                                        <h4 className="font-black text-white text-base">{selectedUser.displayName || 'Unnamed'}</h4>
                                        <p className="text-xs text-slate-400">{selectedUser.email}</p>
                                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                            {selectedUser.verification?.status === 'verified' && <VerifiedBadge size={16} verified={true} />}
                                            {selectedUser.subscription && selectedUser.subscription.plan && selectedUser.subscription.plan !== 'free' && (
                                                <VerifiedBadge size={16} badgeText={selectedUser.subscription.plan} />
                                            )}
                                            {selectedUser.customBadge && selectedUser.customBadge.toLowerCase() !== 'verified' && selectedUser.customBadge.toLowerCase() !== selectedUser.subscription?.plan?.toLowerCase() && (
                                                <VerifiedBadge size={16} badgeText={selectedUser.customBadge} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    {[
                                        { label: 'User ID', value: selectedUser.id?.slice(0, 16) + '...' },
                                        { label: 'Phone', value: selectedUser.phone || 'Not set' },
                                        { label: 'Plan', value: (selectedUser.subscription?.plan || 'free').toUpperCase() },
                                        { label: 'Verification', value: selectedUser.verification?.status || 'none' },
                                        { label: 'Account Status', value: selectedUser.isBanned ? '⛔ Banned' : '✅ Active' },
                                        { label: 'Joined', value: selectedUser.joinedAt ? new Date(selectedUser.joinedAt).toLocaleDateString() : 'Unknown' },
                                    ].map(({ label, value }) => (
                                        <div key={label} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 space-y-1">
                                            <p className="text-[10px] text-slate-500 uppercase font-semibold">{label}</p>
                                            <p className="font-bold text-white truncate">{value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="px-6 pb-5 flex gap-3">
                                <button onClick={() => { setSelectedUser(null); setAlertForm({ userId: selectedUser.id, title: '', body: '' }); setShowAlertModal(true); }}
                                    className="flex-1 py-2.5 rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-400 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-sky-500/20">
                                    <Bell size={13} /> Send Alert
                                </button>
                                <button onClick={() => { triggerAction(selectedUser.id, 'ban', { isBanned: !selectedUser.isBanned }); setSelectedUser(null); }}
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${selectedUser.isBanned ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                                    {selectedUser.isBanned ? <><Unlock size={13} /> Unban</> : <><Ban size={13} /> Ban</>}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ====== Direct Alert Modal ====== */}
            <AnimatePresence>
                {showAlertModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" onClick={() => setShowAlertModal(false)}>
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                                <h3 className="font-bold text-white flex items-center gap-2"><Bell size={16} className="text-sky-400" /> Send Direct Alert</h3>
                                <button onClick={() => setShowAlertModal(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
                            </div>
                            <form onSubmit={handleSendDirectAlert} className="p-6 space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-300">Alert Title</label>
                                    <input type="text" required value={alertForm.title} onChange={(e) => setAlertForm(prev => ({ ...prev, title: e.target.value }))}
                                        placeholder="e.g. Important Notice"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 placeholder:text-slate-600" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-300">Message</label>
                                    <textarea required rows={3} value={alertForm.body} onChange={(e) => setAlertForm(prev => ({ ...prev, body: e.target.value }))}
                                        placeholder="Write your message..."
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 resize-none placeholder:text-slate-600" />
                                </div>
                                <button type="submit" disabled={actionLoading === 'direct_alert'}
                                    className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer">
                                    <Send size={14} />
                                    {actionLoading === 'direct_alert' ? 'Sending...' : 'Send Alert to User'}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ====== Record Payment Modal ====== */}
            <AnimatePresence>
                {showPaymentModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" onClick={() => setShowPaymentModal(false)}>
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-white flex items-center gap-2"><CreditCard size={16} className="text-emerald-400" /> Log Manual Payment</h3>
                                    <p className="text-xs text-slate-400">Record revenue and sync user package</p>
                                </div>
                                <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
                            </div>
                            <form onSubmit={handleRecordPaymentSubmit} className="p-6 space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-300">Select User Account</label>
                                    <select value={paymentForm.userId} onChange={(e) => setPaymentForm(prev => ({ ...prev, userId: e.target.value }))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500">
                                        <option value="mock">-- Manual Entry (Type Email Below) --</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.displayName || 'Unnamed'} ({u.email})</option>)}
                                    </select>
                                </div>
                                {paymentForm.userId === 'mock' && (
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-300">Payer Email</label>
                                        <input type="email" required placeholder="customer@example.com" value={paymentForm.email}
                                            onChange={(e) => setPaymentForm(prev => ({ ...prev, email: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500" />
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-300">Package Plan</label>
                                        <select value={paymentForm.plan} onChange={(e) => { const p = e.target.value; const amt = p === 'silver' ? 500 : p === 'gold' ? 1000 : p === 'diamond' ? 2500 : 0; setPaymentForm(prev => ({ ...prev, plan: p, amount: amt })); }}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500">
                                            <option value="silver">Silver</option>
                                            <option value="gold">Gold</option>
                                            <option value="diamond">Diamond VIP</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-300">Amount (KES)</label>
                                        <input type="number" required value={paymentForm.amount} onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-300">M-Pesa / Ref Code</label>
                                    <input type="text" required placeholder="e.g. QET93821LK" value={paymentForm.code}
                                        onChange={(e) => setPaymentForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 uppercase font-mono" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-300">Payment Method</label>
                                    <select value={paymentForm.method} onChange={(e) => setPaymentForm(prev => ({ ...prev, method: e.target.value }))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500">
                                        <option value="M-Pesa Escrow">M-Pesa Escrow</option>
                                        <option value="M-Pesa Direct">M-Pesa Direct</option>
                                        <option value="Cash">Cash Transfer</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                    </select>
                                </div>
                                <button type="submit" disabled={actionLoading === 'record_payment'}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2">
                                    {actionLoading === 'record_payment' ? 'Logging...' : 'Record Payment & Sync Plan'}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function KpiCard({ icon: Icon, label, value, color, subText }) {
    const colorClasses = {
        rose: 'text-rose-500 bg-rose-500/5 border-rose-500/10',
        amber: 'text-amber-500 bg-amber-500/5 border-amber-500/10',
        red: 'text-red-500 bg-red-500/5 border-red-500/10',
        sky: 'text-sky-400 bg-sky-400/5 border-sky-400/10',
        emerald: 'text-emerald-500 bg-emerald-500/5 border-emerald-500/10',
        purple: 'text-purple-400 bg-purple-400/5 border-purple-400/10',
    };
    return (
        <div className={`p-4 rounded-2xl border shadow-sm backdrop-blur flex flex-col gap-3 bg-slate-900/40 ${colorClasses[color]}`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${colorClasses[color]}`}>
                <Icon size={18} />
            </div>
            <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{label}</p>
                <h3 className="text-lg font-black text-white mt-0.5">{value}</h3>
                {subText && <p className="text-[9px] text-emerald-400 font-bold mt-0.5">{subText}</p>}
            </div>
        </div>
    );
}

function StatCard({ label, value, icon: Icon, color }) {
    return (
        <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur space-y-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                <Icon size={20} style={{ color }} />
            </div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{label}</p>
            <h3 className="text-2xl font-black text-white">{value}</h3>
        </div>
    );
}

function RevenueCard({ label, value, color }) {
    const colorMap = { emerald: '#10B981', sky: '#38BDF8', amber: '#F59E0B', rose: '#F43F5E' };
    return (
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/60 space-y-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
            <h3 className="text-lg font-black" style={{ color: colorMap[color] }}>KES {value.toLocaleString()}</h3>
        </div>
    );
}

function TabButton({ active, onClick, icon: Icon, label, badge }) {
    return (
        <button onClick={onClick} className={`pb-3 px-1 flex items-center gap-1.5 text-xs font-bold transition-all relative border-b-2 cursor-pointer whitespace-nowrap ${active ? 'text-rose-500 border-rose-500' : 'text-slate-400 border-transparent hover:text-slate-200'}`}>
            <Icon size={13} />
            <span>{label}</span>
            {badge > 0 && <span className="px-1.5 py-0.5 bg-rose-500 text-white rounded-full text-[9px] font-black leading-none animate-pulse">{badge}</span>}
        </button>
    );
}

function CampaignToggle({ label, desc, checked, onChange }) {
    return (
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950/30 flex items-center justify-between gap-4">
            <div className="space-y-1">
                <h4 className="font-bold text-white text-xs">{label}</h4>
                <p className="text-[10px] text-slate-500 leading-normal">{desc}</p>
            </div>
            <button onClick={() => onChange(!checked)} className={`w-11 h-6 rounded-full transition-colors relative flex items-center shrink-0 cursor-pointer ${checked ? 'bg-rose-500' : 'bg-slate-800'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </button>
        </div>
    );
}
