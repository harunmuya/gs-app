'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Bell, Eye, Filter, Gift, Heart, Loader2, MapPin, MessageCircle, Phone, PhoneCall, RefreshCw, Search, Sparkles, UserPlus, Users } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import VerifiedBadge from '@/components/VerifiedBadge';
import LiveNowStrip from '@/components/LiveNowStrip';
import BoostedMembersStrip from '@/components/BoostedMembersStrip';
import StoriesStrip from '@/components/StoriesStrip';
import { useAuth } from '@/contexts/AuthContext';
import { fallbackProfileImageSrc, useProfileImageFallback } from '@/lib/profileImages';
import { distanceText } from '@/lib/geo';

const MODES = [
    { id: 'all', label: 'Show All' },
    { id: 'following', label: 'Following' },
    { id: 'online', label: 'Online Now' },
    { id: 'nearby', label: 'Near Me' },
];

const FEED_MODES = [
    { id: 'mixed', label: 'Mixed', note: 'Real, seed, featured' },
    { id: 'random', label: 'Random', note: 'Fresh order' },
    { id: 'featured', label: 'Featured', note: 'Boosted first' },
    { id: 'new', label: 'New', note: 'Newest visible' },
];

const PROFILE_LABELS = [
    { id: 'all', label: 'All Types' },
    { id: 'sugar_mummy', label: 'Sugar Mummy' },
    { id: 'sugar_daddy', label: 'Sugar Daddy' },
    { id: 'mistress', label: 'Mistress' },
    { id: 'toyboy', label: 'Sugar Guy / Toyboy' },
];

const MEMBERS_PAGE_SIZE = 40;

function labelText(label) {
    return PROFILE_LABELS.find((item) => item.id === label)?.label || 'Member';
}

function profileSummary(member) {
    return `${labelText(member.profileLabel)}${member.lookingFor ? ` - Looking for ${member.lookingFor}` : ''}`;
}

function planText(plan) {
    const value = String(plan || 'free').toLowerCase();
    if (value === 'diamond') return 'Diamond';
    if (value === 'gold') return 'Gold';
    if (value === 'silver') return 'Silver';
    return 'Free';
}

function timeSince(date) {
    if (!date) return '';
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
    if (seconds < 60) return 'online now';
    if (seconds < 3600) return `active ${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `active ${Math.floor(seconds / 3600)} hr ago`;
    if (seconds < 172800) return 'active yesterday';
    return 'Recently active';
}

function presenceTone(member) {
    if (member.isOnline) return 'bg-success ring-success/30';
    const seen = member.lastSeenAt ? Date.now() - new Date(member.lastSeenAt).getTime() : Infinity;
    if (seen < 24 * 60 * 60 * 1000) return 'bg-amber-400 ring-amber-200';
    return 'bg-gray-300 ring-gray-200';
}

function lookingTone(member) {
    const text = `${member.lookingFor || ''} ${member.profileLabel || ''}`.toLowerCase();
    if (text.includes('sugar mummy')) return 'from-rose-500 to-pink-500';
    if (text.includes('sugar daddy')) return 'from-sky-500 to-indigo-500';
    if (text.includes('mistress')) return 'from-teal-500 to-emerald-500';
    if (text.includes('toyboy') || text.includes('sugar guy')) return 'from-amber-500 to-orange-500';
    return 'from-primary to-secondary';
}

function lookingLabel(member) {
    return member.lookingFor || labelText(member.profileLabel);
}

function memberPath(member, suffix = '') {
    if (member?.detailPath) return `${member.detailPath}${suffix}`;
    return member?.id ? `/members/${member.id}${suffix}` : '/members';
}


function canUseMemberActions(member) {
    const id = String(member?.id || '');
    return Boolean(id && !id.startsWith('wp-') && !id.startsWith('seed-local-'));
}

function getActorKey() {
    if (typeof window === 'undefined') return 'guest';
    const key = 'gscom_actor_key';
    let value = localStorage.getItem(key);
    if (!value) {
        value = `guest-${crypto.randomUUID?.() || Date.now()}`;
        localStorage.setItem(key, value);
    }
    return value;
}

export default function MembersPage() {
    const router = useRouter();
    const { user, guest } = useAuth();
    const [members, setMembers] = useState([]);
    const [mode, setMode] = useState('all');
    const [feedMode, setFeedMode] = useState('mixed');
    const [mixToken, setMixToken] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const [label, setLabel] = useState('all');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState('');
    const [schemaReady, setSchemaReady] = useState(true);
    const [followed, setFollowed] = useState({});
    const [notice, setNotice] = useState('');

    const query = useMemo(() => {
        const params = new URLSearchParams({ mode, label, feed: feedMode, mix: mixToken });
        if (search.trim()) params.set('search', search.trim());
        if (user?.id) params.set('viewer_id', user.id);
        if (user?.id) params.set('include_self', '1');
        return params.toString();
    }, [mode, label, feedMode, mixToken, search, user?.id]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setFollowed(JSON.parse(localStorage.getItem('gscom_followed_members') || '{}'));
        }
    }, []);

    async function loadMembersPage(pageNumber = 1, { replace = false } = {}) {
        if (replace) {
            setLoading(true);
            setError('');
            setHasMore(true);
        } else {
            setLoadingMore(true);
        }
        try {
            const separator = query ? '&' : '';
            const res = await fetch(`/api/members?${query}${separator}page=${pageNumber}&per_page=${MEMBERS_PAGE_SIZE}`, { cache: 'no-store' });
            const data = res ? await res.json().catch(() => ({})) : {};
            const rows = data.members || [];
            setMembers((current) => {
                if (replace) return rows;
                const byId = new Map(current.map((member) => [member.id, member]));
                rows.forEach((member) => byId.set(member.id, member));
                return Array.from(byId.values());
            });
            setPage(pageNumber);
            setHasMore(rows.length >= MEMBERS_PAGE_SIZE);
            setSchemaReady(data.schemaReady !== false && !data.setupRequired);
            if (res && !res.ok) setError(data.error || 'Members are unavailable right now.');
        } catch {
            setError('Members are unavailable right now.');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }

    useEffect(() => {
        setMembers([]);
        setPage(1);
        setHasMore(true);
        loadMembersPage(1, { replace: true });
    }, [query]);

    useEffect(() => {
        function onLocationUpdated() {
            setMembers([]);
            setPage(1);
            setHasMore(true);
            loadMembersPage(1, { replace: true });
        }
        window.addEventListener('gs-location-updated', onLocationUpdated);
        return () => window.removeEventListener('gs-location-updated', onLocationUpdated);
    }, [query]);

    useEffect(() => {
        function onScroll() {
            if (loading || loadingMore || !hasMore) return;
            const remaining = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
            if (remaining < 900) loadMembersPage(page + 1);
        }
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [loading, loadingMore, hasMore, page, query]);

    function memberDistanceText(member) {
        return member.distanceText || distanceText(user, member);
    }

    const visibleMembers = (mode === 'following' ? members.filter((member) => followed[member.id]) : members)
        .filter((member) => mode !== 'nearby' || member.distanceKm || memberDistanceText(member))
        .sort((a, b) => mode === 'nearby' ? (Number(a.distanceKm || 999999) - Number(b.distanceKm || 999999)) : 0);

    async function toggleFollow(memberId) {
        if (!user?.id) { router.push('/auth/login'); return; }
        if (String(memberId || '').startsWith('wp-') || String(memberId || '').startsWith('seed-local-')) {
            setFollowed((current) => {
                const next = { ...current, [memberId]: !current[memberId] };
                if (!next[memberId]) delete next[memberId];
                localStorage.setItem('gscom_followed_members', JSON.stringify(next));
                return next;
            });
            return;
        }
        const res = await fetch('/api/profiles/follows', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, targetId: memberId }),
        });
        const data = await res.json();
        if (!res.ok) return;
        setMembers((items) => items.map((item) => item.id === memberId ? { ...item, followersCount: data.followersCount ?? item.followersCount } : item));
        setFollowed((current) => {
            const next = { ...current, [memberId]: data.following };
            if (!data.following) delete next[memberId];
            localStorage.setItem('gscom_followed_members', JSON.stringify(next));
            return next;
        });
    }

    async function openMember(member, section = '') {
        if (guest || !user?.id) { router.push('/auth/login'); return; }
        if (!canUseMemberActions(member) || String(member.id || '').startsWith('seed-local-')) {
            router.push(memberPath(member, section));
            return;
        }
        const res = await fetch('/api/members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'view', memberId: member.id, actorUserId: user.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            setNotice(data.error || 'Your daily quota has exhausted. Pay for a package to unlock unlimited access.');
            window.setTimeout(() => router.push(data.redirectTo || '/packages'), 900);
            return;
        }
        router.push(memberPath(member, section));
    }

    function canMessage() {
        return Boolean(user?.id);
    }

    function openMessage(member) {
        if (!canMessage()) {
            setNotice('Create an account or sign in to message members.');
            window.setTimeout(() => router.push('/auth/login'), 900);
            return;
        }
        if (canUseMemberActions(member)) {
            router.push(`/messages/${member.id}`);
            return;
        }
        setNotice('This featured profile is not available for direct chat right now. Try another online member.');
        openMember(member);
    }

    function canGift() {
        const tier = String(user?.subscription_tier || 'free').toLowerCase();
        return Boolean(!user?.package_locked && ['basic', 'silver', 'gold', 'diamond'].includes(tier));
    }

    function canCall() {
        const tier = String(user?.subscription_tier || 'free').toLowerCase();
        return Boolean(!user?.package_locked && ['silver', 'gold', 'diamond'].includes(tier));
    }

    function openGift(member) {
        if (!canGift()) {
            setNotice('Gifts require an active package. Upgrade to send premium GS gifts.');
            window.setTimeout(() => router.push('/packages'), 900);
            return;
        }
        openMember(member, '#gift');
    }

    function openCall(member) {
        if (member.id === user?.id) {
            setNotice('You cannot call yourself. Choose another member to start a call.');
            return;
        }
        if (!canUseMemberActions(member)) {
            openMember(member);
            return;
        }
        if (!canCall()) {
            setNotice('Voice calls require an active Silver or Gold package.');
            window.setTimeout(() => router.push('/packages'), 900);
            return;
        }
        router.push(`/calls/${member.id}?type=voice`);
    }

    return (
        <div className="px-4 py-4 pb-28 space-y-5">
            <section className="space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-black text-text-primary">Members</h1>
                        <p className="text-xs text-text-muted mt-0.5">{visibleMembers.length} visible profiles</p>
                    </div>
                    <Link href="/profile" className="w-10 h-10 rounded-full flex items-center justify-center text-white gradient-primary shadow-lg" aria-label="Create profile">
                        <UserPlus size={18} />
                    </Link>
                </div>
                {notice && <div className="rounded-2xl p-3 text-xs font-bold text-primary bg-primary/10">{notice}</div>}
                <StoriesStrip title="Member Stories" />
                <LiveNowStrip title="Members Live Now" />
                <BoostedMembersStrip title="Boosted Members" />

                <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4">
                    <Link href="/profile" className="shrink-0 text-center space-y-1">
                        <div className="relative">
                            <UserAvatar name="You" size={58} />
                            <span className="absolute -right-0.5 -bottom-0.5 w-5 h-5 rounded-full gradient-primary text-white text-sm leading-5 font-bold">+</span>
                        </div>
                        <p className="text-[10px] font-semibold text-text-secondary">Your Profile</p>
                    </Link>
                    {visibleMembers.slice(0, 12).map((member) => (
                        <button key={member.id} type="button" onClick={() => openMember(member)} className="shrink-0 text-center space-y-1">
                            <div className="p-0.5 rounded-full" style={{ background: member.isOnline ? 'var(--gradient-primary)' : 'rgba(148,163,184,0.35)' }}>
                                <UserAvatar name={member.name} src={member.avatarUrl} size={54} />
                            </div>
                            <p className="w-16 truncate text-[10px] font-semibold text-text-secondary">{member.name}</p>
                        </button>
                    ))}
                </div>
            </section>

            <section className="space-y-3">
                <div className="relative">
                    <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search members, countries, interests" className="w-full rounded-2xl py-3 pl-10 pr-4 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/40" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }} />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
                    {MODES.map((item) => (
                        <button key={item.id} onClick={() => setMode(item.id)} className={`shrink-0 px-3 py-2 rounded-full text-xs font-bold transition-all ${mode === item.id ? 'text-white gradient-primary' : 'text-text-secondary'}`} style={mode === item.id ? {} : { background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                            {item.label}
                        </button>
                    ))}
                </div>

                <div className="rounded-2xl p-2 space-y-2" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                    <div className="flex items-center justify-between gap-2 px-1">
                        <div className="min-w-0">
                            <p className="text-xs font-black text-text-primary flex items-center gap-1"><Sparkles size={13} className="text-primary" /> Member Flow</p>
                            <p className="text-[10px] text-text-muted truncate">Refresh the front page with a new mix anytime.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setMixToken(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)}
                            className="shrink-0 rounded-xl px-3 py-2 text-xs font-black text-white gradient-primary inline-flex items-center gap-1"
                        >
                            <RefreshCw size={13} /> Shuffle
                        </button>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                        {FEED_MODES.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setFeedMode(item.id)}
                                className={`min-h-[54px] rounded-xl px-2 py-2 text-center transition-all ${feedMode === item.id ? 'text-white gradient-primary' : 'text-text-secondary'}`}
                                style={feedMode === item.id ? {} : { background: 'var(--color-surface)' }}
                            >
                                <span className="block text-[11px] font-black leading-tight">{item.label}</span>
                                <span className="block text-[9px] opacity-80 leading-tight mt-0.5">{item.note}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Filter size={15} className="text-text-muted" />
                    <select value={label} onChange={(event) => setLabel(event.target.value)} className="flex-1 rounded-xl px-3 py-2 text-xs font-semibold text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/40" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                        {PROFILE_LABELS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>
                </div>
            </section>

            {!schemaReady && !loading && (
                <div className="rounded-2xl p-4 space-y-2" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)' }}>
                    <div className="flex items-center gap-2 text-amber-700 font-bold text-sm"><Bell size={16} /> Supabase setup needed</div>
                    <p className="text-xs text-text-secondary leading-relaxed">Run the member seed migration and set the Supabase environment variables to populate this page.</p>
                </div>
            )}

            {error && !loading && <div className="rounded-2xl p-4 text-sm text-danger" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}>{error}</div>}

            {loading ? (
                <div className="flex items-center justify-center py-14 text-primary"><Loader2 size={28} className="animate-spin" /></div>
            ) : visibleMembers.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center"><Users size={30} className="text-primary" /></div>
                    <h2 className="text-lg font-black text-text-primary">No members found</h2>
                    <p className="text-sm text-text-muted max-w-xs mx-auto">Try a different search or filter.</p>
                </div>
            ) : (
                <section className="grid grid-cols-2 gap-3">
                    {visibleMembers.map((member, index) => (
                        <motion.article key={member.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.015 }} className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                            <button type="button" onClick={() => openMember(member)} className="block w-full text-left">
                                <div className="relative aspect-[3/4] bg-primary/5">
                                    <img
                                        src={member.avatarUrl || fallbackProfileImageSrc(member.name)}
                                        alt={member.name}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                        onError={(event) => useProfileImageFallback(event, member.name)}
                                    />
                                    <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/75 to-transparent text-white">
                                        <div className="flex items-center gap-1 min-w-0"><h2 className="text-sm font-black truncate">{member.name}</h2><VerifiedBadge verified={member.verified} size={15} /></div>
                                        <p className="text-[11px] opacity-85 truncate">{member.age ? `${member.age} - ` : ''}{profileSummary(member)}</p>
                                    </div>
                                    <span className="absolute top-2 left-2 px-2 py-1 rounded-full text-[10px] font-bold text-white bg-black/55 backdrop-blur-sm">{labelText(member.profileLabel)}</span>
                                    {String(member.id) === String(user?.id || '') && <span className="absolute top-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded-full text-[10px] font-black text-white gradient-primary shadow-sm">YOU</span>}
                                    {member.isBoosted && <span className="absolute left-2 top-9 rounded-full bg-secondary px-2 py-1 text-[10px] font-black text-white shadow-sm">BOOSTED</span>}
                                    <span className={`absolute top-2 right-2 w-3.5 h-3.5 rounded-full ring-4 ring-white/80 ${presenceTone(member)}`} title={timeSince(member.lastSeenAt) || 'offline'} aria-label={timeSince(member.lastSeenAt) || 'offline'} />
                                </div>
                            </button>
                            <div className="p-2.5 space-y-2">
                                <div className="min-h-[46px] space-y-1">
                                    {member.location && <p className="flex items-center gap-1 text-[11px] text-text-muted truncate"><MapPin size={11} /> {member.location}</p>}
                                    {memberDistanceText(member) && <p className="flex items-center gap-1 text-[11px] font-bold text-primary truncate"><MapPin size={11} /> {memberDistanceText(member)}</p>}
                                    <div className="flex items-center justify-between gap-1"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-primary bg-primary/10">{planText(member.subscriptionTier)}</span><span className="text-[10px] text-text-muted">{member.followersCount || 0} follows</span></div>
                                    <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${presenceTone(member)}`} title={timeSince(member.lastSeenAt)} aria-label={timeSince(member.lastSeenAt)} />
                                        <span className="truncate">{timeSince(member.lastSeenAt) || 'offline'}</span>
                                    </div>
                                    <div className={`inline-flex max-w-full rounded-full bg-gradient-to-r ${lookingTone(member)} px-2 py-1 text-[10px] font-black text-white shadow-sm`}>
                                        <span className="truncate">Looking for {lookingLabel(member)}</span>
                                    </div>
                                </div>
                                <div className="rounded-xl px-2 py-1.5 flex items-center justify-between gap-1.5" style={{ background: 'var(--color-surface)' }}>
                                    <span className="min-w-0 flex items-center gap-1.5"><Phone size={12} className="text-text-muted shrink-0" /><span className="text-[11px] font-black tracking-wide text-text-secondary truncate select-none">{member.phoneMasked || 'Hidden'}</span></span>
                                    <span className="text-[9px] font-black text-primary bg-primary/10 rounded-full px-1.5 py-0.5">Silver+</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    <button onClick={() => toggleFollow(member.id)} className={`min-h-9 flex-1 basis-[46%] rounded-xl px-2 text-[10px] font-black inline-flex items-center justify-center gap-1 ${followed[member.id] ? 'gradient-primary text-white' : 'bg-primary/10 text-primary'}`}>
                                        <Heart size={12} />
                                        {followed[member.id] ? 'Following' : 'Follow'}
                                    </button>
                                    <button onClick={() => openMessage(member)} className="min-h-9 flex-1 basis-[46%] rounded-xl bg-secondary/10 px-2 text-[10px] font-black text-secondary inline-flex items-center justify-center gap-1">
                                        <MessageCircle size={12} />
                                        Message
                                    </button>
                                    <button onClick={() => openGift(member)} className="min-h-9 flex-1 basis-[30%] rounded-xl bg-amber-100 px-2 text-[10px] font-black text-gold inline-flex items-center justify-center gap-1">
                                        <Gift size={12} />
                                        Gift
                                    </button>
                                    {member.id === user?.id ? <span className="min-h-9 flex-1 basis-[30%] rounded-xl bg-gray-100 px-2 text-[10px] font-black text-text-muted flex items-center justify-center">You</span> : <button onClick={() => openCall(member)} className="min-h-9 flex-1 basis-[30%] rounded-xl bg-sky-100 px-2 text-[10px] font-black text-sky-700 inline-flex items-center justify-center gap-1">
                                        <PhoneCall size={12} />
                                        Call
                                    </button>}
                                    <button onClick={() => openMember(member)} className="min-h-9 flex-1 basis-[30%] rounded-xl bg-gray-100 px-2 text-[10px] font-black text-text-secondary inline-flex items-center justify-center gap-1">
                                        <Eye size={12} />
                                        View Profile
                                    </button>
                                </div>
                            </div>
                        </motion.article>
                    ))}
                </section>
            )}
            {!loading && visibleMembers.length > 0 && hasMore && (
                <div className="flex justify-center py-4">
                    <button onClick={() => loadMembersPage(page + 1)} disabled={loadingMore} className="rounded-2xl px-5 py-3 text-xs font-black text-white gradient-primary disabled:opacity-60">
                        {loadingMore ? 'Loading more...' : 'Load more members'}
                    </button>
                </div>
            )}
        </div>
    );
}




