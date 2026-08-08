'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    Activity,
    Ban,
    BarChart3,
    Bell,
    Check,
    Crown,
    Database,
    Eye,
    Gift,
    Lock,
    Mail,
    Megaphone,
    MessageCircle,
    RefreshCw,
    Search,
    ShieldCheck,
    SlidersHorizontal,
    Unlock,
    UserCheck,
    Users,
    X,
} from '@/components/icons';
import Logo from '@/components/Logo';

const TABS = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'seed', label: 'Seed Mgmt', icon: Database },
    { id: 'verification', label: 'Verification', icon: ShieldCheck },
    { id: 'finance', label: 'Finance', icon: Crown },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'tickets', label: 'Tickets', icon: MessageCircle },
    { id: 'broadcast', label: 'Broadcast', icon: Megaphone },
    { id: 'limits', label: 'Ads & Limits', icon: SlidersHorizontal },
    { id: 'logs', label: 'Logs', icon: Activity },
];

const TIERS = ['free', 'basic', 'silver', 'gold'];
const USER_FILTERS = [
    ['all', 'All'],
    ['attention', 'Needs Attention'],
    ['new', 'New Users'],
    ['needs_photo', 'Needs Photo'],
    ['verify_pending', 'Verify Pending'],
    ['package_locked', 'Package Locked'],
    ['seeded', 'Seeded'],
    ['featured', 'Public'],
    ['male', 'Male'],
    ['female', 'Female'],
    ['online', 'Online'],
    ['banned', 'Banned'],
];

function tierText(value) {
    return String(value || 'free').toUpperCase();
}

function statusColor(user) {
    if (user.is_suspended || user.is_banned) return 'text-danger bg-danger/10';
    if (user.verified) return 'text-success bg-success/10';
    if (user.verification_status === 'pending_admin') return 'text-gold bg-amber-100';
    return 'text-text-muted bg-gray-100';
}

function dateText(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
}

function isSeedUser(user) {
    return Boolean(user.is_seed_profile || String(user.email || '').startsWith('seed+'));
}

function profilePhoto(user) {
    return user.avatar_url || (Array.isArray(user.photos) && user.photos[0]) || '';
}

function needsPhoto(user) {
    return !profilePhoto(user) && !user.is_banned && !user.is_suspended;
}

function needsUserAttention(user) {
    return needsPhoto(user) || !user.username || user.verification_status === 'pending_admin' || user.package_locked || user.is_suspended || user.is_banned;
}

function genderSymbol(user) {
    const label = String(user.profile_label || user.member_category || '').toLowerCase();
    if (['sugar_daddy', 'toyboy'].includes(label)) return { symbol: 'M', className: 'bg-sky-100 text-sky-700' };
    if (['sugar_mummy', 'mistress'].includes(label)) return { symbol: 'F', className: 'bg-rose-100 text-rose-700' };
    return { symbol: 'GS', className: 'bg-primary/10 text-primary' };
}

function matchesUserFilter(user, filter) {
    const label = String(user.profile_label || user.member_category || '').toLowerCase();
    const created = user.created_at ? new Date(user.created_at).getTime() : 0;
    const seen = user.last_seen_at ? new Date(user.last_seen_at).getTime() : 0;
    if (filter === 'attention') return needsUserAttention(user);
    if (filter === 'new') return !isSeedUser(user) && created > Date.now() - 7 * 24 * 60 * 60 * 1000;
    if (filter === 'needs_photo') return needsPhoto(user);
    if (filter === 'verify_pending') return user.verification_status === 'pending_admin';
    if (filter === 'package_locked') return user.package_locked;
    if (filter === 'seeded') return isSeedUser(user);
    if (filter === 'featured') return user.show_in_public;
    if (filter === 'male') return ['sugar_daddy', 'toyboy'].includes(label);
    if (filter === 'female') return ['sugar_mummy', 'mistress'].includes(label);
    if (filter === 'online') return seen > Date.now() - 5 * 60 * 1000;
    if (filter === 'banned') return user.is_banned || user.is_suspended;
    return true;
}

function attentionForTab(attention, tabId) {
    return Number(attention?.[tabId] || 0);
}

function shortId(id) {
    return String(id || '').slice(0, 8) || 'missing';
}

function userHandle(user) {
    const fallback = String(user.display_name || user.email || 'member')
        .trim()
        .toLowerCase()
        .replace(/@.*/, '')
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 24) || 'member';
    return user.username || `${fallback}_${shortId(user.id).toLowerCase()}`;
}

export default function AdminPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    // Session lives in an httpOnly cookie the browser attaches automatically;
    // this flag only tracks whether the last probe succeeded.
    const [authed, setAuthed] = useState(false);
    const [checkingSession, setCheckingSession] = useState(true);
    const [activeTab, setActiveTab] = useState('users');
    const [data, setData] = useState({ users: [], messages: [], gifts: [], packageRequests: [], tickets: [], broadcasts: [], logs: [], callRequests: [], emailOutbox: [], notifications: [], ticketResponses: [], limits: [], stats: {}, attention: {}, tableErrors: {} });
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [loading, setLoading] = useState(false);
    const [broadcast, setBroadcast] = useState({ title: '', body: '', targetSegment: 'all' });
    const [ticket, setTicket] = useState({ subject: '', body: '', priority: 'normal' });
    const [ticketReplies, setTicketReplies] = useState({});
    const [emailForms, setEmailForms] = useState({});
    const [testEmail, setTestEmail] = useState('principlessmart@gmail.com');
    const [walletForms, setWalletForms] = useState({});
    const [limits, setLimits] = useState({ dailyMessageLimit: 5, dailyGiftLimit: 20, maxPhotosPerUser: 6, requireManualVerification: true, adsEnabled: false });
    const [userFilter, setUserFilter] = useState('all');
    const [userSearch, setUserSearch] = useState('');
    const [userSort, setUserSort] = useState('attention');

    useEffect(() => {
        // Probe the cookie session. A 401 simply means the login form is shown.
        let cancelled = false;
        (async () => {
            const res = await fetch('/api/admin', { credentials: 'same-origin' }).catch(() => null);
            if (cancelled) return;
            if (res?.ok) {
                const body = await res.json().catch(() => null);
                if (body) { applyAdminData(body); setAuthed(true); }
            }
            setCheckingSession(false);
        })();
        return () => { cancelled = true; };
    }, []);

    const stats = data.stats || {};
    const attention = data.attention || {};
    const pendingUsers = useMemo(() => (data.users || []).filter((user) => !user.show_in_public || user.verification_status === 'pending_admin'), [data.users]);
    const verificationRequests = useMemo(() => data.verificationRequests || pendingUsers.filter((user) => user.verification_status === 'pending_admin' && (user.verification_selfie_url || user.verification_document_url)), [data.verificationRequests, pendingUsers]);
    const userFilterCounts = useMemo(() => Object.fromEntries(USER_FILTERS.map(([id]) => [id, (data.users || []).filter((user) => matchesUserFilter(user, id)).length])), [data.users]);
    const visibleUsers = useMemo(() => {
        const needle = userSearch.trim().toLowerCase();
        return (data.users || [])
            .filter((user) => matchesUserFilter(user, userFilter))
            .filter((user) => {
                if (!needle) return true;
                return [user.id, user.username, user.display_name, user.email, user.phone_number, user.phone, user.location, user.profile_label, user.member_category, user.looking_for, user.verification_status, user.subscription_tier]
                    .some((value) => String(value || '').toLowerCase().includes(needle));
            })
            .sort((a, b) => {
                if (userSort === 'attention') return Number(needsUserAttention(b)) - Number(needsUserAttention(a)) || new Date(b.created_at || 0) - new Date(a.created_at || 0);
                if (userSort === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
                if (userSort === 'followers') return (b.followers_count || 0) - (a.followers_count || 0);
                if (userSort === 'gifts') return (b.gifts_received_count || 0) - (a.gifts_received_count || 0);
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            });
    }, [data.users, userFilter, userSearch, userSort]);

    async function login(event) {
        event.preventDefault();
        setError('');
        const res = await fetch('/api/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', email, password }),
        });
        const body = await res.json();
        if (!res.ok) { setError(body.error || 'Login failed'); return; }
        // No token is returned or stored: the server set an httpOnly cookie.
        setPassword('');
        setAuthed(true);
        await loadAdmin();
    }

    function applyAdminData(body) {
        setData(body);
        const firstLimit = body.limits?.[0];
        if (firstLimit) {
            setLimits({
                dailyMessageLimit: firstLimit.daily_message_limit || 5,
                dailyGiftLimit: firstLimit.daily_gift_limit || 20,
                maxPhotosPerUser: firstLimit.max_photos_per_user || 6,
                requireManualVerification: firstLimit.require_manual_verification !== false,
                adsEnabled: Boolean(firstLimit.ads_enabled),
            });
        }
    }

    async function loadAdmin() {
        setLoading(true);
        setError('');
        const res = await fetch('/api/admin', { credentials: 'same-origin' });
        const body = await res.json().catch(() => ({}));
        setLoading(false);
        if (res.status === 401) { setAuthed(false); return; }
        if (!res.ok) { setError(body.error || 'Could not load admin data'); return; }
        applyAdminData(body);
    }

    async function adminAction(payload, success = 'Saved.') {
        setError('');
        setNotice('');
        const res = await fetch('/api/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
        });
        const body = await res.json().catch(() => ({}));
        if (res.status === 401) { setAuthed(false); setError('Your admin session expired. Sign in again.'); return false; }
        if (!res.ok) { setError(body.error || 'Action failed. Run the admin SQL if this table is missing.'); return false; }
        setNotice(success);
        await loadAdmin();
        return true;
    }

    if (checkingSession) {
        return (
            <main className="min-h-dvh flex items-center justify-center px-5" style={{ background: 'linear-gradient(180deg,#f5f3ff,#fff)' }}>
                <p className="text-sm text-text-muted">Checking session…</p>
            </main>
        );
    }

    if (!authed) {
        return (
            <main className="min-h-dvh flex items-center justify-center px-5" style={{ background: 'linear-gradient(180deg,#f5f3ff,#fff)' }}>
                <form onSubmit={login} className="w-full max-w-sm rounded-2xl p-5 space-y-4" style={{ background: 'white', border: '1px solid rgba(124,58,237,.15)' }}>
                    <Logo size={48} />
                    <h1 className="text-xl font-black text-text-primary">Admin Login</h1>
                    <input className="w-full rounded-xl px-3 py-3" style={{ border: '1px solid #ddd' }} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="username" />
                    <input className="w-full rounded-xl px-3 py-3" style={{ border: '1px solid #ddd' }} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
                    {error && <p className="text-sm text-danger">{error}</p>}
                    <button className="w-full rounded-xl py-3 text-white font-bold gradient-primary">Login</button>
                </form>
            </main>
        );
    }

    return (
        <main className="min-h-dvh bg-bg-dark px-4 py-4 space-y-4 max-w-7xl mx-auto">
            <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                <div className="flex items-center gap-3"><Logo size={42} /><div><h1 className="text-xl font-black text-text-primary">Admin Control Panel</h1><p className="text-xs text-text-muted">Users, verification, finance, messages, analytics, tickets, ads and limits.</p></div></div>
                <div className="flex items-center gap-2">
                    <button onClick={loadAdmin} className="px-3 py-2 rounded-xl text-sm font-bold bg-primary/10 text-primary flex items-center gap-2"><RefreshCw size={15} /> Refresh</button>
                    <button onClick={async () => {
                        await fetch('/api/admin', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'same-origin',
                            body: JSON.stringify({ action: 'logout' }),
                        }).catch(() => {});
                        setAuthed(false);
                    }} className="px-3 py-2 rounded-xl text-sm font-bold bg-gray-100">Logout</button>
                </div>
            </header>

            <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
                {[
                    ['Users', stats.totalUsers || 0], ['New Users', stats.newUsers || 0], ['Needs Photo', stats.usersMissingPhotos || 0], ['Verification', stats.pendingVerification || 0],
                    ['Finance', (stats.pendingPackageRequests || 0) + (stats.pendingWalletTransactions || 0)], ['Tickets', stats.openTickets || 0], ['Unread', stats.unreadMessages || 0], ['Banned', stats.bannedUsers || 0],
                ].map(([label, value]) => <div key={label} className="rounded-2xl p-3" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}><p className="text-[11px] font-bold text-text-muted">{label}</p><p className="text-xl font-black text-primary">{value}</p></div>)}
            </section>

            {attention.total > 0 && (
                <section className="rounded-2xl p-3 flex flex-wrap items-center gap-2 text-xs font-semibold" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.24)' }}>
                    <Bell size={16} className="text-gold" />
                    <span className="text-text-primary">{attention.total} section item{attention.total === 1 ? '' : 's'} need attention:</span>
                    {TABS.filter((tab) => attentionForTab(attention, tab.id) > 0).map((tab) => (
                        <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === 'users') { setUserFilter('attention'); setUserSort('attention'); } }} className="rounded-full bg-white px-3 py-1 text-gold">
                            {tab.label} {attentionForTab(attention, tab.id)}
                        </button>
                    ))}
                </section>
            )}

            <nav className="flex gap-2 overflow-x-auto pb-1">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const count = attentionForTab(attention, tab.id);
                    return <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`relative shrink-0 rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-2 ${activeTab === tab.id ? 'gradient-primary text-white' : 'bg-white text-text-secondary'}`}><Icon size={15} /> {tab.label}{count > 0 && <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-danger/10 text-danger'}`}>{count > 99 ? '99+' : count}</span>}</button>;
                })}
            </nav>

            {error && <div className="rounded-xl p-3 text-sm text-danger bg-danger/10">{error}</div>}
            {notice && <div className="rounded-xl p-3 text-sm text-success bg-success/10">{notice}</div>}
            {loading && <p className="text-sm text-primary font-bold">Loading...</p>}
            {Object.values(data.tableErrors || {}).filter(Boolean).length > 0 && <div className="rounded-xl p-3 text-xs text-gold bg-amber-100">Some admin tables or RLS policies are missing. Run <b>supabase/migrations/20260707_010_rls_profile_photo_admin_repair.sql</b> in Supabase SQL Editor.</div>}

            {activeTab === 'users' && (
                <section className="space-y-3">
                    <div className="rounded-2xl p-3 space-y-3" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                        <div className="flex flex-col gap-2 md:flex-row">
                            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-surface px-3">
                                <Search size={15} className="text-primary" />
                                <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search ID, username, name, email, phone, location..." className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" />
                            </label>
                            <select value={userSort} onChange={(e) => setUserSort(e.target.value)} className="rounded-xl bg-surface px-3 py-3 text-sm font-bold">
                                <option value="attention">Needs attention first</option>
                                <option value="newest">Newest first</option>
                                <option value="oldest">Oldest first</option>
                                <option value="followers">Most followers</option>
                                <option value="gifts">Most gifts received</option>
                            </select>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {USER_FILTERS.map(([id, label]) => (
                                <button key={id} onClick={() => setUserFilter(id)} className={`shrink-0 rounded-xl px-3 py-2 text-[11px] font-semibold ${userFilter === id ? 'gradient-primary text-white' : 'bg-white text-text-secondary'}`}>
                                    {label} <span className="ml-1 opacity-75">{userFilterCounts[id] || 0}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {visibleUsers.map((user) => {
                        const gender = genderSymbol(user);
                        const photo = profilePhoto(user);
                        const verificationReady = user.verification_status === 'pending_admin' && (user.verification_selfie_url || user.verification_document_url);
                        return (
                        <article key={user.id} className="rounded-2xl p-3 space-y-3" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                            <div className="flex gap-3">
                                {photo ? <img src={photo} alt="" className="w-16 h-16 rounded-xl object-cover"  loading="lazy" decoding="async" /> : <div className="w-16 h-16 rounded-xl bg-danger/10 text-danger flex items-center justify-center text-[10px] font-semibold text-center px-1">Needs Photo</div>}
                                <div className="min-w-0 flex-1">
                                    <p className="font-black truncate flex items-center gap-1"><span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${gender.className}`}>{gender.symbol}</span>{user.display_name || user.email}</p>
                                    <p className="text-xs font-semibold text-primary truncate">@{userHandle(user)}</p>
                                    <p className="text-[11px] text-text-muted truncate font-mono">ID: {user.id || 'missing-id'}</p>
                                    <p className="text-xs text-text-muted truncate">{user.email}</p>
                                    <p className="text-xs text-text-muted truncate">{user.profile_label || user.member_category || 'member'} - {user.phone_number || user.phone || 'no phone'}</p>
                                    {user.looking_for && <p className="text-xs font-bold text-primary truncate">Looking for: {user.looking_for}</p>}
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor(user)}`}>{user.verification_status || 'new'}</span>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">{tierText(user.subscription_tier)}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${user.show_in_public ? 'bg-success/10 text-success' : 'bg-gray-100 text-text-muted'}`}>{user.show_in_public ? 'PUBLIC' : 'HIDDEN'}</span>
                                        {needsPhoto(user) && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-danger/10 text-danger">PHOTO REQUIRED</span>}
                                        {!user.username && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-gold">USERNAME AUTO</span>}
                                        {verificationReady && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-gold">BADGE REVIEW</span>}
                                        {user.package_locked && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-danger/10 text-danger">PACKAGE LOCKED</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface p-2 text-[11px]">
                                {[
                                    ['Joined', dateText(user.created_at)],
                                    ['Last seen', dateText(user.last_seen_at)],
                                    ['Views', user.total_profile_views || 0],
                                    ['Followers', user.followers_count || 0],
                                    ['Gifts', user.gifts_received_count || 0],
                                    ['Short ID', shortId(user.id)],
                                ].map(([label, value]) => (
                                    <div key={label} className="min-w-0 rounded-lg bg-white px-2 py-1.5">
                                        <p className="font-black text-text-muted">{label}</p>
                                        <p className="truncate font-bold text-text-primary">{value}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <button onClick={() => adminAction({ action: user.show_in_public ? 'hide_user' : 'show_user', userId: user.id }, user.show_in_public ? 'User hidden' : 'User shown')} className="min-h-10 rounded-xl px-3 py-2 text-xs font-semibold bg-primary/10 text-primary">{user.show_in_public ? 'Hide From Members' : 'Show In Members'}</button>
                                <button onClick={() => adminAction({ action: user.package_locked ? 'unlock_package' : 'lock_package', userId: user.id }, user.package_locked ? 'Package unlocked' : 'Package locked')} className="min-h-10 rounded-xl px-3 py-2 text-xs font-semibold bg-amber-100 text-gold flex items-center justify-center gap-1">{user.package_locked ? <Unlock size={13} /> : <Lock size={13} />} {user.package_locked ? 'Unlock Package' : 'Lock Package'}</button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                {TIERS.map((tier) => <button key={tier} onClick={() => adminAction({ action: 'set_package', userId: user.id, tier, locked: false }, `${tier} package set`)} className={`min-h-9 px-2 py-2 rounded-lg text-[10px] font-semibold ${String(user.subscription_tier || 'free') === tier ? 'gradient-primary text-white' : 'bg-gray-100 text-text-secondary'}`}>{tier}</button>)}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <button onClick={() => adminAction({ action: user.is_suspended || user.is_banned ? 'restore_user' : 'suspend_user', userId: user.id }, user.is_suspended || user.is_banned ? 'User restored' : 'User suspended')} className="min-h-10 rounded-xl px-3 py-2 text-xs font-semibold bg-gray-900 text-white">{user.is_suspended || user.is_banned ? 'Restore Account' : 'Suspend Account'}</button>
                                <button onClick={() => adminAction({ action: user.is_banned ? 'unban_user' : 'ban_user', userId: user.id }, user.is_banned ? 'User unbanned' : 'User banned')} className="min-h-10 rounded-xl px-3 py-2 text-xs font-semibold bg-danger/10 text-danger">{user.is_banned ? 'Unban User' : 'Ban User'}</button>
                            </div>

                            <button onClick={() => window.confirm(`Permanently delete ${user.display_name || user.email || 'this account'}? This removes the profile, messages, activity, and login, then blocks the same email from silently returning.`) && adminAction({ action: 'delete_user_forever', userId: user.id }, 'User permanently deleted')} className="w-full min-h-10 rounded-xl px-3 py-2 text-xs font-semibold bg-danger text-white">Delete Forever</button>

                            <div className="rounded-xl p-2 space-y-2 bg-surface">
                                <input value={emailForms[user.id]?.subject || ''} onChange={(e) => setEmailForms({ ...emailForms, [user.id]: { ...(emailForms[user.id] || {}), subject: e.target.value } })} placeholder="Email subject" className="w-full rounded-lg p-2 text-xs bg-white" />
                                <textarea value={emailForms[user.id]?.message || ''} onChange={(e) => setEmailForms({ ...emailForms, [user.id]: { ...(emailForms[user.id] || {}), message: e.target.value } })} placeholder="Message to user account and email" className="w-full rounded-lg p-2 text-xs bg-white resize-none" rows={2} />
                                <button onClick={() => adminAction({ action: 'email_user', userId: user.id, subject: emailForms[user.id]?.subject || 'Message from Genuine Sugar Mummies', message: emailForms[user.id]?.message || 'Admin sent you a message.' }, 'Email and account message sent')} className="w-full rounded-lg py-2 text-xs font-semibold bg-sky-100 text-sky-700">Email User + Inbox</button>
                            </div>
                        </article>
                    );})}
                    </div>
                </section>
            )}
            {activeTab === 'seed' && <Panel title="Seed Management" items={[`Seeded profiles: ${(data.users || []).filter((u) => u.email?.startsWith('seed+')).length}`, `Public profiles: ${(data.users || []).filter((u) => u.show_in_public).length}`, `Sugar mummies: ${(data.users || []).filter((u) => u.profile_label === 'sugar_mummy').length}`, `Sugar daddies: ${(data.users || []).filter((u) => u.profile_label === 'sugar_daddy').length}`, `Mistresses: ${(data.users || []).filter((u) => u.profile_label === 'mistress').length}`]} />}

            {activeTab === 'verification' && (
                <section className="grid gap-3 md:grid-cols-2">
                    {verificationRequests.map((user) => (
                        <article key={user.id} className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h2 className="font-black truncate">{user.display_name || user.email}</h2>
                                    <p className="text-xs text-text-muted truncate">{user.email}</p>
                                    <p className="text-xs text-text-muted">Phone: {user.verification_phone || user.phone_number || user.phone || 'No phone'}</p>
                                    <p className="text-xs text-text-muted">Submitted: {dateText(user.verification_submitted_at)}</p>
                                </div>
                                <span className="shrink-0 text-xs font-semibold text-primary bg-primary/10 rounded-full px-2 py-1">{user.verification_document_type || 'document'}</span>
                            </div>
                            <AccountDetails account={user.account || user} label="Verification" />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <EvidenceCard title="Selfie" src={user.verification_selfie_url} fileName={`${user.display_name || user.id}-selfie`} />
                                <EvidenceCard title="ID / Passport" src={user.verification_document_url} fileName={`${user.display_name || user.id}-document`} />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button onClick={() => adminAction({ action: 'approve_verification', userId: user.id }, 'Verification approved')} className="min-h-10 flex-1 rounded-xl px-3 py-2 text-xs font-semibold text-white bg-success flex items-center justify-center gap-1"><Check size={14} /> Approve Badge</button>
                                <button onClick={() => adminAction({ action: 'reject_verification', userId: user.id, reason: 'Please upload clearer verification documents.' }, 'Verification rejected')} className="min-h-10 flex-1 rounded-xl px-3 py-2 text-xs font-semibold text-white bg-danger flex items-center justify-center gap-1"><X size={14} /> Reject</button>
                            </div>
                        </article>
                    ))}
                </section>
            )}

            {activeTab === 'finance' && (
                <section className="space-y-3">
                    {(data.packageRequests || []).map((request) => (
                        <article key={request.id} className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                            <AccountDetails account={request.account} fallback={request} label="Package request" />
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h2 className="font-black">{tierText(request.tier)} package</h2>
                                    <p className="text-xs text-text-muted">KSh {request.amount_ksh} · {request.status} · {dateText(request.created_at)}</p>
                                    <p className="text-xs text-text-muted">Ref: {request.payment_reference || 'N/A'}</p>
                                    {request.note && <p className="text-xs text-text-secondary">Note: {request.note}</p>}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => adminAction({ action: 'approve_package_request', requestId: request.id, userId: request.user_id, tier: request.tier }, 'Package approved')} className="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-success">Approve</button>
                                    <button onClick={() => adminAction({ action: 'reject_package_request', requestId: request.id }, 'Package rejected')} className="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-danger">Reject</button>
                                </div>
                            </div>
                        </article>
                    ))}
                    <ActionList title="Wallet Top-ups & Ledger" items={data.walletTransactions || []} empty="No wallet transactions yet." render={(tx) => <><AccountDetails account={tx.account} fallback={tx} label="Wallet user" /><div className="mt-3 flex items-start justify-between gap-2"><div><h2 className="font-black">{tx.wallet_type} {tx.direction}</h2><p className="text-xs text-text-muted">Transaction ID: {tx.id}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${tx.status === 'posted' ? 'bg-success/10 text-success' : tx.status === 'rejected' ? 'bg-danger/10 text-danger' : 'bg-amber-100 text-gold'}`}>{tx.status}</span></div><p className="text-sm text-text-secondary">Amount: {tx.amount} · Balance after: {tx.balance_after ?? 'pending'}</p><p className="text-xs text-text-muted">Ref: {tx.reference || 'N/A'} · {dateText(tx.created_at)}</p>{tx.status === 'pending' && <div className="mt-3 flex flex-wrap gap-2"><button onClick={() => adminAction({ action: 'approve_wallet_transaction', transactionId: tx.id }, 'Wallet top-up approved')} className="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-success">Approve Top-up</button><button onClick={() => adminAction({ action: 'reject_wallet_transaction', transactionId: tx.id }, 'Wallet top-up rejected')} className="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-danger">Reject</button></div>}</>} footer={<div className="rounded-2xl p-4 space-y-2" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}><h3 className="text-sm font-bold">Manual Wallet Adjustment</h3><input value={walletForms.userId || ''} onChange={(e) => setWalletForms({ ...walletForms, userId: e.target.value })} placeholder="User ID" className="w-full rounded-xl p-3 text-sm bg-surface" /><div className="grid grid-cols-3 gap-2"><select value={walletForms.walletType || 'credit'} onChange={(e) => setWalletForms({ ...walletForms, walletType: e.target.value })} className="rounded-xl p-3 text-sm bg-surface"><option value="credit">Credit</option><option value="money">Money</option></select><select value={walletForms.direction || 'credit'} onChange={(e) => setWalletForms({ ...walletForms, direction: e.target.value })} className="rounded-xl p-3 text-sm bg-surface"><option value="credit">Credit</option><option value="debit">Debit</option></select><input value={walletForms.amount || ''} onChange={(e) => setWalletForms({ ...walletForms, amount: e.target.value.replace(/\D/g, '') })} placeholder="Amount" className="rounded-xl p-3 text-sm bg-surface" /></div><button onClick={() => adminAction({ action: 'adjust_wallet', userId: walletForms.userId, walletType: walletForms.walletType || 'credit', direction: walletForms.direction || 'credit', amount: Number(walletForms.amount || 0) }, 'Wallet adjusted')} className="rounded-xl px-4 py-2 text-xs font-semibold text-white gradient-primary">Apply Wallet Change</button></div>} />
                </section>
            )}

            {activeTab === 'analytics' && <Panel title="Analytics" items={[`Profile views: ${(data.users || []).reduce((sum, user) => sum + (user.total_profile_views || 0), 0)}`, `Followers: ${(data.users || []).reduce((sum, user) => sum + (user.followers_count || 0), 0)}`, `Gifts sent: ${(data.gifts || []).length}`, `Saved messages: ${(data.messages || []).length}`, `Pending package requests: ${stats.pendingPackageRequests || 0}`]} />}

            {activeTab === 'tickets' && <ActionList title="Tickets" items={data.tickets || []} empty="No tickets yet." render={(item) => <><AccountDetails account={item.account} fallback={item} label="Ticket user" /><div className="mt-3 flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="font-black truncate">{item.subject}</h2><p className="text-[11px] text-text-muted">Ticket ID: {item.id}</p></div><span className="shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold bg-primary/10 text-primary">{String(item.service || 'general').replace(/_/g, ' ')}</span></div><p className="mt-2 text-sm text-text-secondary">{item.body}</p><div className="mt-2 flex flex-wrap gap-1.5"><span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold text-text-muted">{item.status}</span><span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-gold">{item.priority || 'normal'}</span><span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">{dateText(item.created_at)}</span></div><div className="mt-3 space-y-2"><textarea value={ticketReplies[item.id] || ''} onChange={(e) => setTicketReplies({ ...ticketReplies, [item.id]: e.target.value })} placeholder="Reply to this user" className="w-full rounded-xl p-3 text-sm bg-surface resize-none" rows={2} /><div className="flex flex-wrap gap-2"><button onClick={() => adminAction({ action: 'respond_ticket', ticketId: item.id, message: ticketReplies[item.id] || '' }, 'Ticket response sent to account and email queue')} className="px-3 py-2 rounded-xl text-xs font-semibold text-white gradient-primary">Respond</button>{item.status !== 'closed' && <button onClick={() => adminAction({ action: 'close_ticket', ticketId: item.id }, 'Ticket closed and removed from queue')} className="px-3 py-2 rounded-xl text-xs font-semibold bg-gray-100">Close</button>}<button onClick={() => adminAction({ action: 'delete_ticket', ticketId: item.id }, 'Ticket deleted')} className="px-3 py-2 rounded-xl text-xs font-semibold bg-danger/10 text-danger">Delete</button></div></div></>} footer={<div className="rounded-2xl p-4 space-y-2" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}><input value={ticket.subject} onChange={(e) => setTicket({ ...ticket, subject: e.target.value })} placeholder="Ticket subject" className="w-full rounded-xl p-3 text-sm bg-surface" /><textarea value={ticket.body} onChange={(e) => setTicket({ ...ticket, body: e.target.value })} placeholder="Ticket note" className="w-full rounded-xl p-3 text-sm bg-surface" /><button onClick={() => adminAction({ action: 'create_ticket', ...ticket }, 'Ticket created')} className="rounded-xl px-4 py-2 text-xs font-semibold text-white gradient-primary">Create Ticket</button></div>} />}
            {activeTab === 'broadcast' && <ActionList title="Broadcasts" items={data.broadcasts || []} empty="No broadcasts yet." render={(item) => <><h2 className="font-black">{item.title}</h2><p className="text-sm text-text-secondary">{item.body}</p><p className="text-xs text-text-muted">{item.target_segment} - {dateText(item.created_at)}</p></>} footer={<div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}><input value={broadcast.title} onChange={(e) => setBroadcast({ ...broadcast, title: e.target.value })} placeholder="Broadcast title" className="w-full rounded-xl p-3 text-sm bg-surface" /><textarea value={broadcast.body} onChange={(e) => setBroadcast({ ...broadcast, body: e.target.value })} placeholder="Message to users and email inboxes" className="w-full rounded-xl p-3 text-sm bg-surface" /><select value={broadcast.targetSegment} onChange={(e) => setBroadcast({ ...broadcast, targetSegment: e.target.value })} className="w-full rounded-xl p-3 text-sm bg-surface"><option value="all">All users</option><option value="free">Free users</option><option value="basic">Basic users</option><option value="silver">Silver users</option><option value="gold">Gold users</option><option value="sugar_mummy">Sugar mummies</option><option value="sugar_daddy">Sugar daddies</option><option value="mistress">Mistresses</option><option value="toyboy">Toyboys</option></select><div className="flex flex-wrap gap-2"><button onClick={() => adminAction({ action: 'create_broadcast', ...broadcast }, 'Broadcast sent to accounts and emails')} className="rounded-xl px-4 py-2 text-xs font-semibold text-white gradient-primary">Send Broadcast</button><button onClick={() => adminAction({ action: 'send_subscription_reminders' }, 'Subscription reminders sent')} className="rounded-xl px-4 py-2 text-xs font-semibold bg-amber-100 text-gold">Send Subscription Reminders</button></div><div className="flex gap-2"><input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="Test email" className="min-w-0 flex-1 rounded-xl p-3 text-sm bg-surface" /><button onClick={() => adminAction({ action: 'test_email', to: testEmail }, 'Test email sent')} className="rounded-xl px-4 py-2 text-xs font-semibold bg-sky-100 text-sky-700">Send Test</button></div></div>} />}

            {activeTab === 'limits' && (
                <div className="space-y-5">
                    <PackageTierEditor tiers={data.packageTiers || []} onSave={adminAction} />

                    <section className="rounded-2xl p-4 space-y-3 max-w-xl" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                        <h2 className="font-black">Site settings</h2>
                        <p className="type-caption text-text-muted">
                            Photo limit, verification and ads. Package entitlements are edited above.
                        </p>
                        <label className="block type-caption font-semibold text-text-muted">Max photos per user
                            <input type="number" value={limits.maxPhotosPerUser} onChange={(e) => setLimits({ ...limits, maxPhotosPerUser: e.target.value })} className="mt-1 w-full rounded-xl p-3 text-sm bg-surface text-text-primary" />
                        </label>
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={limits.requireManualVerification} onChange={(e) => setLimits({ ...limits, requireManualVerification: e.target.checked })} /> Require manual verification</label>
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={limits.adsEnabled} onChange={(e) => setLimits({ ...limits, adsEnabled: e.target.checked })} /> Ads enabled</label>
                        <button onClick={() => adminAction({ action: 'update_limits', ...limits }, 'Site settings updated')} className="rounded-xl px-4 py-2 text-xs font-semibold text-white gradient-primary">Save settings</button>
                    </section>
                </div>
            )}

            {activeTab === 'logs' && <ActionList title="Logs, Messages & Gifts" items={[...(data.messages || []).map((m) => ({ ...m, type: 'message' })), ...(data.gifts || []).map((g) => ({ ...g, type: 'gift' })), ...(data.callRequests || []).map((c) => ({ ...c, type: 'call' })), ...(data.emailOutbox || []).map((e) => ({ ...e, type: 'email' })), ...(data.notifications || []).map((n) => ({ ...n, type: 'account message' })), ...(data.logs || []).map((l) => ({ ...l, type: 'log' }))]} empty="No logs yet." render={(item) => <><p className="text-xs font-semibold text-primary">{item.type}</p><p className="text-sm text-text-primary">{item.body || item.gift_name || item.action || `${item.call_type || ''} call request`}</p>{item.attachment_type === 'image' && item.attachment_url && <img src={item.attachment_url} alt={item.attachment_name || 'Attachment'} className="mt-2 w-24 h-24 rounded-xl object-cover"  loading="lazy" decoding="async" />}{item.attachment_type === 'gif' && <p className="mt-2 inline-flex rounded-xl bg-amber-100 text-gold px-3 py-1 text-xs font-semibold">GIF {item.attachment_name || 'reaction'}</p>}{item.voice_url && <audio src={item.voice_url} controls className="mt-2 w-full" />}<p className="text-xs text-text-muted">{item.sender_name || item.requester_name || item.to_email || item.sender_key || item.requester_key || ''} {dateText(item.created_at)}</p>{item.type === 'message' && !item.is_read && <button onClick={() => adminAction({ action: 'mark_message_read', messageId: item.id }, 'Message marked read')} className="mt-2 rounded-xl px-3 py-2 text-xs font-semibold bg-primary/10 text-primary">Mark Read</button>}{item.type === 'call' && item.status === 'pending' && <div className="mt-2 flex gap-2"><button onClick={() => adminAction({ action: 'approve_call_request', callId: item.id }, 'Call request approved')} className="rounded-xl px-3 py-2 text-xs font-semibold text-white bg-success">Approve Call</button><button onClick={() => adminAction({ action: 'reject_call_request', callId: item.id }, 'Call request rejected')} className="rounded-xl px-3 py-2 text-xs font-semibold text-white bg-danger">Reject</button></div>}</>} />}
        </main>
    );
}

/**
 * Per-tier entitlement editor.
 *
 * Writes to `package_tiers`, the table the entitlement layer actually reads, so a
 * saved change applies on the next request. The tab previously shown here wrote
 * three numbers to a single global `app_limits` row that nothing in the
 * enforcement path ever consulted — the settings looked editable and did nothing.
 *
 * The limit convention is surfaced in the UI rather than left as folklore: 0
 * means unlimited, which is what the seeded silver and gold rows already use.
 */
function PackageTierEditor({ tiers, onSave }) {
    const [drafts, setDrafts] = useState({});
    const [saving, setSaving] = useState('');

    const NUMERIC = [
        ['priceKsh', 'price_ksh', 'Price (KSh)'],
        ['dailyMessageLimit', 'daily_message_limit', 'Messages / day'],
        ['dailyLikeLimit', 'daily_like_limit', 'Likes / day'],
        ['dailySuperLikeLimit', 'daily_super_like_limit', 'Super likes / day'],
        ['dailySwipeLimit', 'daily_swipe_limit', 'Swipes / day'],
        ['dailyProfileViewLimit', 'daily_profile_view_limit', 'Profile views / day'],
        ['dailyGiftLimit', 'daily_gift_limit', 'Gifts / day'],
        ['startingCredits', 'starting_credits', 'Starting credits'],
        ['maxGiftTier', 'max_gift_tier', 'Max gift tier'],
    ];

    const FLAGS = [
        ['phoneReveal', 'phone_reveal', 'Phone reveal'],
        ['voiceVideoAccess', 'voice_video_access', 'Voice & video calls'],
        ['canSendGifts', 'can_send_gifts', 'Send gifts'],
        ['canSendImages', 'can_send_images', 'Send images'],
        ['canSendVoiceNotes', 'can_send_voice_notes', 'Send voice notes'],
        ['canGoLive', 'can_go_live', 'Go live'],
        ['canSeeWhoLiked', 'can_see_who_liked', 'See who liked'],
        ['canSeeWhoViewed', 'can_see_who_viewed', 'See who viewed'],
        ['canUseNearby', 'can_use_nearby', 'Nearby discovery'],
        ['priorityVisibility', 'priority_visibility', 'Priority visibility'],
        ['internationalAccess', 'international_access', 'International access'],
    ];

    function valueFor(tier, camel, column, fallback) {
        const draft = drafts[tier.id];
        if (draft && camel in draft) return draft[camel];
        return tier[column] ?? fallback;
    }

    function setValue(tierId, camel, value) {
        setDrafts((current) => ({ ...current, [tierId]: { ...(current[tierId] || {}), [camel]: value } }));
    }

    async function save(tier) {
        setSaving(tier.id);
        const payload = { action: 'update_package_tier', tierId: tier.id, name: tier.name };
        NUMERIC.forEach(([camel, column]) => { payload[camel] = valueFor(tier, camel, column, 0); });
        FLAGS.forEach(([camel, column]) => { payload[camel] = Boolean(valueFor(tier, camel, column, false)); });
        payload.tagline = valueFor(tier, 'tagline', 'tagline', '');
        payload.isActive = Boolean(valueFor(tier, 'isActive', 'is_active', true));
        await onSave(payload, `${tier.name} updated`);
        setDrafts((current) => ({ ...current, [tier.id]: undefined }));
        setSaving('');
    }

    if (!tiers.length) {
        return (
            <section className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                <h2 className="font-black">Package entitlements</h2>
                <p className="mt-2 type-caption text-text-muted">
                    No rows in <code>package_tiers</code>. Run migration
                    <code> 20260808_040_entitlements_atomic_quota_and_admin_control.sql</code> to create and seed them.
                </p>
            </section>
        );
    }

    return (
        <section className="space-y-3">
            <div>
                <h2 className="font-black">Package entitlements</h2>
                <p className="type-caption text-text-muted">
                    These values are enforced server-side on every request. <strong>0 means unlimited.</strong> Changes apply immediately — no deploy needed.
                </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
                {tiers.map((tier) => {
                    const dirty = Boolean(drafts[tier.id] && Object.keys(drafts[tier.id]).length);
                    return (
                        <article key={tier.id} className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                            <header className="flex items-center justify-between gap-2">
                                <div>
                                    <h3 className="type-heading text-text-primary">{tier.name}</h3>
                                    <p className="type-micro text-text-muted">{tier.id}</p>
                                </div>
                                {dirty && <span className="rounded-full bg-amber-400 px-2 py-1 type-micro text-black">Unsaved</span>}
                            </header>

                            <div className="grid grid-cols-2 gap-2">
                                {NUMERIC.map(([camel, column, label]) => (
                                    <label key={camel} className="block type-caption text-text-muted">
                                        {label}
                                        <input
                                            type="number" min="0"
                                            value={valueFor(tier, camel, column, 0) ?? 0}
                                            onChange={(e) => setValue(tier.id, camel, e.target.value)}
                                            className="mt-1 w-full rounded-lg p-2 text-sm bg-surface text-text-primary"
                                        />
                                    </label>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t pt-3" style={{ borderColor: 'rgba(20,16,26,0.08)' }}>
                                {FLAGS.map(([camel, column, label]) => (
                                    <label key={camel} className="flex items-center gap-2 type-caption text-text-secondary">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(valueFor(tier, camel, column, false))}
                                            onChange={(e) => setValue(tier.id, camel, e.target.checked)}
                                        />
                                        {label}
                                    </label>
                                ))}
                            </div>

                            <button
                                onClick={() => save(tier)}
                                disabled={saving === tier.id}
                                className="w-full rounded-xl px-4 py-2.5 type-caption font-semibold text-white gradient-primary disabled:opacity-60"
                            >
                                {saving === tier.id ? 'Saving…' : `Save ${tier.name}`}
                            </button>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}

function Panel({ title, items }) {
    return <section className="rounded-2xl p-4 space-y-3 max-w-xl" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}><h2 className="font-black">{title}</h2>{items.map((item) => <p key={item} className="text-sm text-text-secondary flex items-center gap-2"><Eye size={14} className="text-primary" /> {item}</p>)}</section>;
}

function ActionList({ title, items, empty, render, footer }) {
    return <section className="space-y-3"><div className="flex items-center gap-2"><Mail size={17} className="text-primary" /><h2 className="font-black">{title}</h2></div>{footer}{items.length === 0 && <p className="text-sm text-text-muted">{empty}</p>}<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={`${item.type || 'item'}-${item.id}`} className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>{render(item)}</article>)}</div></section>;
}

function AccountDetails({ account, fallback = {}, label = 'Account' }) {
    const data = account || {};
    const name = data.display_name || fallback.display_name || fallback.email || 'Unknown user';
    const email = data.email || fallback.email || '';
    const phone = data.phone_number || data.phone || fallback.phone_number || fallback.phone || '';
    const photo = profilePhoto(data);
    const id = data.id || fallback.user_id || fallback.userId || '';
    const handle = data.id || data.username ? userHandle(data) : 'not linked';
    return (
        <div className="rounded-2xl bg-surface p-3">
            <div className="flex items-start gap-3">
                {photo ? <img src={photo} alt="" className="h-12 w-12 rounded-xl object-cover"  loading="lazy" decoding="async" /> : <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-[10px] font-semibold text-primary">USER</div>}
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-bold text-text-primary">{name}</p>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary">{label}</span>
                    </div>
                    <p className="truncate text-xs font-semibold text-primary">@{handle}</p>
                    <p className="truncate text-[11px] text-text-muted">{email || 'No email'} · {phone || 'No phone'}</p>
                    <p className="truncate text-[10px] font-mono text-text-muted">ID: {id || 'not linked'}</p>
                </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
                {[
                    ['Profile', data.profile_label || data.member_category || 'member'],
                    ['Package', tierText(data.subscription_tier)],
                    ['Verify', data.verification_status || (data.verified ? 'verified' : 'unsubmitted')],
                    ['Seen', dateText(data.last_seen_at)],
                ].map(([key, value]) => (
                    <div key={key} className="min-w-0 rounded-lg bg-white px-2 py-1">
                        <p className="font-black text-text-muted">{key}</p>
                        <p className="truncate font-bold text-text-primary">{value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function EvidenceCard({ title, src, fileName }) {
    if (!src) {
        return (
            <div className="rounded-2xl p-3 text-center text-xs font-bold text-danger bg-danger/10">
                Missing {title}
            </div>
        );
    }
    return (
        <div className="rounded-2xl p-2 space-y-2 bg-surface">
            <img src={src} alt={title} className="w-full aspect-square object-cover rounded-xl"  loading="lazy" decoding="async" />
            <div className="flex gap-2">
                <a href={src} target="_blank" rel="noreferrer" className="flex-1 rounded-xl px-3 py-2 text-center text-xs font-semibold bg-primary/10 text-primary">View</a>
                <a href={src} download={fileName} className="flex-1 rounded-xl px-3 py-2 text-center text-xs font-semibold bg-gray-100 text-text-secondary">Download</a>
            </div>
        </div>
    );
}





