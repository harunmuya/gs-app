'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Ban, Bell, Eye, Filter, Gift, Loader2, Lock, MapPin, GsMatch, MessageSquareText, Phone, PhoneCall, RefreshCw, Search, UserPlus, UserRoundCheck, Users } from '@/components/icons';
import UserAvatar from '@/components/UserAvatar';
import VerifiedBadge from '@/components/VerifiedBadge';
import LiveNowStrip from '@/components/LiveNowStrip';
import BoostedMembersStrip from '@/components/BoostedMembersStrip';
import StoriesStrip from '@/components/StoriesStrip';
import { useAuth } from '@/contexts/AuthContext';
import { getProfileImageSrc, useProfileImageFallback } from '@/lib/profileImages';
import { distanceText } from '@/lib/geo';
import { useEntitlements } from '@/lib/useEntitlements';
import PresenceDot, { PresenceLine } from '@/components/PresenceDot';

const MODES = [
    { id: 'all', label: 'Show All' },
    { id: 'following', label: 'Following' },
    { id: 'online', label: 'Online Now' },
    { id: 'nearby', label: 'Near Me' },
];

const FEED_MODES = [
    { id: 'mixed', label: 'Mixed', note: 'Best variety' },
    { id: 'random', label: 'Random', note: 'Fresh order' },
    { id: 'featured', label: 'Featured', note: 'Top profiles' },
    { id: 'new', label: 'New', note: 'Just joined' },
];

const PROFILE_LABELS = [
    { id: 'all', label: 'All Types' },
    { id: 'sugar_mummy', label: 'Sugar Mummy' },
    { id: 'sugar_daddy', label: 'Sugar Daddy' },
    { id: 'mistress', label: 'Mistress' },
    { id: 'toyboy', label: 'Sugar Guy / Toyboy' },
];

// 40 cards meant 40 profile photos on first paint — roughly 4MB from a public/
// folder holding 44MB of seed imagery, all of it billed as Vercel edge requests
// and bandwidth. The grid already loads more on scroll, so the only thing the
// larger page bought was a slower first render and a bigger bill.
const MEMBERS_PAGE_SIZE = 12;

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
    // Seeded and WordPress-imported profiles have no account behind them; the
    // server marks them with requiresFacilitation.
    if (member?.requiresFacilitation) return false;
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
    const { features } = useEntitlements(user?.id);
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
        if (label === 'all') params.set('scope', 'all_types');
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
        setNotice(member?.facilitationNotice || 'This profile is introduced through our facilitation service. Direct messaging is not available — contact support to arrange an introduction.');
        openMember(member);
    }

    /*
      Both of these read the server's effective entitlements rather than
      user.subscription_tier. The stored tier is what the member *asked* for: it
      stays 'silver' after the package expires, and it is already 'silver' before
      an administrator approves the payment. Gating on it let those members press
      Call, sit through the camera prompt, and receive a 402 from the API. The
      entitlement endpoint applies approval, lock and expiry.
    */
    function canGift() {
        return Boolean(features.gifts);
    }

    function canCall() {
        return Boolean(features.calls);
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
                            <p className="text-xs font-semibold text-text-primary flex items-center gap-1"><GsMatch size={13} className="text-primary" /> Browse Members</p>
                            <p className="text-[10px] text-text-muted truncate">Switch how you discover new people.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setMixToken(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)}
                            className="shrink-0 rounded-xl px-3 py-2 text-xs font-semibold text-white gradient-primary inline-flex items-center gap-1"
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
                                <span className="block text-[11px] font-semibold leading-tight">{item.label}</span>
                                <span className="block text-[9px] opacity-80 leading-tight mt-0.5">{item.note}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl p-2 space-y-2" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                    <div className="flex items-center gap-2 px-1">
                        <Filter size={15} className="text-text-muted" />
                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-text-primary">Member categories</p>
                            <p className="text-[10px] text-text-muted">All Types is the default. Tap a category to show only that type.</p>
                        </div>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {PROFILE_LABELS.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setLabel(item.id)}
                                className={`shrink-0 min-h-10 rounded-xl px-3 text-xs font-semibold transition-all active:scale-[0.97] ${label === item.id ? 'text-white gradient-primary shadow-sm' : 'text-text-secondary'}`}
                                style={label === item.id ? {} : { background: 'var(--color-surface)' }}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {!schemaReady && !loading && (
                <div className="rounded-2xl p-4 space-y-2" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)' }}>
                    <div className="flex items-center gap-2 text-amber-700 font-bold text-sm"><Bell size={16} /> Supabase setup needed</div>
                    <p className="text-xs text-text-secondary leading-relaxed">Set up the database and environment variables to populate this page with members.</p>
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
                                        src={getProfileImageSrc(member)}
                                        alt={member.name}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                        onError={(event) => useProfileImageFallback(event, member.name, member.profileLabel, member.isSeedProfile)}
                                    />
                                    <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/75 to-transparent text-white">
                                        {/* Name is the one element that earns weight here; everything
                                            below it steps down so the eye has an order to follow. */}
                                        <div className="flex items-center gap-1 min-w-0"><h2 className="type-body-strong truncate">{member.name}</h2><VerifiedBadge verified={member.verified} size={15} /></div>
                                        <p className="type-caption opacity-85 truncate">{member.age ? `${member.age} · ` : ''}{profileSummary(member)}</p>
                                    </div>
                                    <span className="absolute top-2 left-2 px-2 py-1 rounded-full type-micro text-white bg-black/55 backdrop-blur-sm">{labelText(member.profileLabel)}</span>
                                    {String(member.id) === String(user?.id || '') && <span className="absolute top-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded-full type-micro text-white gradient-primary shadow-sm">YOU</span>}
                                    {member.isBoosted && <span className="absolute left-2 top-9 rounded-full bg-secondary px-2 py-1 type-micro text-white shadow-sm">BOOSTED</span>}
                                    {/* Amber read as a mild caveat. Red is the honest
                                        weight for "you cannot message this". */}
                                    {member.requiresFacilitation && (
                                        <span className="absolute inset-x-2 bottom-12 flex items-center justify-center gap-1 rounded-full px-2 py-1 type-micro text-white shadow-sm" style={{ background: 'var(--color-danger)' }}>
                                            <Ban size={10} strokeWidth={2.6} /> No direct messages
                                        </span>
                                    )}
                                    {/* PresenceDot renders nothing for a listing — see lib/presence. */}
                                    <PresenceDot member={member} size={14} className="absolute top-2 right-2 ring-4 ring-white/80" />
                                </div>
                            </button>
                            <div className="p-2.5 space-y-2">
                                <div className="min-h-[46px] space-y-1">
                                    {member.location && <p className="flex items-center gap-1 type-caption text-text-muted truncate"><MapPin size={11} /> {member.location}</p>}
                                    {memberDistanceText(member) && <p className="flex items-center gap-1 type-caption font-semibold text-primary truncate"><MapPin size={11} /> {memberDistanceText(member)}</p>}
                                    <div className="flex items-center justify-between gap-1"><span className="px-2 py-0.5 rounded-full type-micro text-primary bg-primary/10">{planText(member.subscriptionTier)}</span><span className="type-caption text-text-muted">{member.followersCount || 0} follows</span></div>
                                    <div className="flex items-center gap-1.5 type-caption text-text-muted">
                                        <PresenceLine member={member} />
                                    </div>
                                    <div className={`inline-flex max-w-full rounded-full bg-gradient-to-r ${lookingTone(member)} px-2 py-1 type-micro text-white shadow-sm`}>
                                        <span className="truncate">Looking for {lookingLabel(member)}</span>
                                    </div>
                                </div>
                                <div className="rounded-xl px-2 py-1.5 flex items-center justify-between gap-1.5" style={{ background: 'var(--color-surface)' }}>
                                    <span className="min-w-0 flex items-center gap-1.5"><Phone size={12} className="text-text-muted shrink-0" /><span className="text-[11px] font-semibold tracking-wide text-text-secondary truncate select-none">{member.phoneMasked || 'Hidden'}</span></span>
                                    <span className="text-[9px] font-semibold text-primary bg-primary/10 rounded-full px-1.5 py-0.5">Silver+</span>
                                </div>
                                {/*
                                  Icon-only actions.

                                  Was five labelled buttons at 8.5px text, 20px wide — below
                                  the 24px tap minimum and barely readable. Labels on a card
                                  this size cost more than they explain: a heart, a speech
                                  bubble, a gift and a handset are understood without words.

                                  "View profile" is gone because the card itself already
                                  opens the profile, so it was a button competing with the
                                  thing it sat inside.

                                  Message is the primary action and carries the filled
                                  treatment; the rest are tinted. Every one has an
                                  aria-label and a title — an icon-only control with no
                                  accessible name is unusable with a screen reader, and a
                                  tooltip covers anyone unsure on desktop.
                                */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => toggleFollow(member.id)}
                                        aria-label={followed[member.id] ? `Unfollow ${member.name}` : `Follow ${member.name}`}
                                        aria-pressed={Boolean(followed[member.id])}
                                        title={followed[member.id] ? 'Following' : 'Follow'}
                                        className={`flex h-11 flex-1 items-center justify-center rounded-xl transition-colors ${followed[member.id] ? 'gradient-primary text-white' : 'bg-primary/10 text-primary'}`}
                                    >
                                        <UserRoundCheck size={19} strokeWidth={2.2} />
                                    </button>

                                    <button
                                        onClick={() => openMessage(member)}
                                        aria-label={`Message ${member.name}`}
                                        title="Message"
                                        className="flex h-11 items-center justify-center rounded-xl text-white gradient-primary"
                                        style={{ flex: '1.6 1 0%' }}
                                    >
                                        <MessageSquareText size={20} strokeWidth={2.2} />
                                    </button>

                                    <button
                                        onClick={() => openGift(member)}
                                        aria-label={`Send a gift to ${member.name}`}
                                        title="Send gift"
                                        className="flex h-11 flex-1 items-center justify-center rounded-xl text-gold"
                                        style={{ background: 'rgba(166,124,46,0.12)' }}
                                    >
                                        <Gift size={19} strokeWidth={2.2} />
                                    </button>

                                    {member.id === user?.id ? (
                                        <span
                                            className="flex h-11 flex-1 items-center justify-center rounded-xl type-micro text-text-muted"
                                            style={{ background: 'var(--color-surface)' }}
                                            title="This is you"
                                        >
                                            YOU
                                        </span>
                                    ) : (
                                        /*
                                          Calling is Silver and Gold only. The control stays
                                          present and tappable for everyone — tapping it
                                          explains the gate and routes to /packages — but it
                                          reads as locked rather than available, so the
                                          restriction is visible before the tap. A small lock
                                          badge does that without a text label the icon-only
                                          row has no room for.
                                        */
                                        <button
                                            onClick={() => openCall(member)}
                                            aria-label={canCall() ? `Call ${member.name}` : `Calling ${member.name} requires Silver or Gold`}
                                            title={canCall() ? 'Voice or video call' : 'Calls are included with Silver and Gold'}
                                            className={`relative flex h-11 flex-1 items-center justify-center rounded-xl ${canCall() ? 'text-sky-700' : 'text-text-muted'}`}
                                            style={{ background: canCall() ? 'rgba(2,132,199,0.10)' : 'var(--color-surface)' }}
                                        >
                                            <PhoneCall size={19} strokeWidth={2.2} />
                                            {!canCall() && (
                                                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-white" style={{ background: 'var(--color-primary)' }}>
                                                    <Lock size={9} strokeWidth={2.6} />
                                                </span>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.article>
                    ))}
                </section>
            )}
            {!loading && visibleMembers.length > 0 && hasMore && (
                <div className="flex justify-center py-4">
                    <button onClick={() => loadMembersPage(page + 1)} disabled={loadingMore} className="rounded-2xl px-5 py-3 text-xs font-semibold text-white gradient-primary disabled:opacity-60">
                        {loadingMore ? 'Loading more...' : 'Load more members'}
                    </button>
                </div>
            )}
        </div>
    );
}




