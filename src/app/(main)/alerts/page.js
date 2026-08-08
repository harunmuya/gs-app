'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Bell, Camera, CheckCheck, Gift, Mail, MessageCircle, PackageCheck,
    PhoneCall, Radio, ShieldCheck, ExternalLink, Headphones, Megaphone, KeyRound,
    CreditCard, GsVerifiedHeart, GsMatch, GsTrust,
} from '@/components/icons';
import { useAuth } from '@/contexts/AuthContext';
import { unreadActivityValue, unreadMessageValue } from '@/lib/inboxCounts';

/**
 * Alerts.
 *
 * Rebuilt from a flat list of up to 100 undifferentiated rows. What changed and
 * why, since each one was a real defect rather than a matter of taste:
 *
 *  - Opening a single alert called markAllRead(), so reading one silently marked
 *    every other as read. A member had no way to tell what they had actually
 *    seen. Items are now marked individually.
 *  - Everything shared one bell icon and one colour, so a payment confirmation
 *    and a profile view were indistinguishable at a glance.
 *  - The list was ungrouped, so "3 minutes ago" sat directly above "2 months
 *    ago" with nothing marking the boundary. It is now grouped by day.
 *  - A 5-second timer re-rendered the whole list purely to refresh relative
 *    timestamps. That is now a minute, which is the resolution the labels have.
 *  - The unread highlight was still the pre-rebrand teal.
 *  - The tabs were mislabelled: the "Messages" filter included verification,
 *    package and security notices, which are not messages.
 */

/** Type -> icon and accent. Anything unmapped falls back to a neutral bell. */
const KIND = {
    message:        { icon: MessageCircle,    tone: 'var(--color-primary)', label: 'Message' },
    member_message: { icon: MessageCircle,    tone: 'var(--color-primary)', label: 'Message' },
    match:          { icon: GsMatch,          tone: 'var(--accent-match)',              label: 'Match' },
    like:           { icon: GsVerifiedHeart,  tone: 'var(--accent-match)',              label: 'Like' },
    superlike:      { icon: GsVerifiedHeart,  tone: 'var(--accent-match)',              label: 'Super like' },
    follow:         { icon: GsVerifiedHeart,  tone: 'var(--accent-social)',              label: 'Follow' },
    gift:           { icon: Gift,             tone: 'var(--accent-gift)',              label: 'Gift' },
    package:        { icon: PackageCheck,     tone: 'var(--color-success)', label: 'Package' },
    package_request:{ icon: CreditCard,       tone: 'var(--color-success)', label: 'Payment' },
    verification:   { icon: ShieldCheck,      tone: 'var(--accent-verify)',              label: 'Verification' },
    security:       { icon: KeyRound,         tone: 'var(--color-danger)',  label: 'Security' },
    broadcast:      { icon: Megaphone,        tone: 'var(--accent-social)',              label: 'Announcement' },
    support:        { icon: Headphones,       tone: 'var(--accent-support)',              label: 'Support' },
    gs_support:     { icon: Headphones,       tone: 'var(--accent-support)',              label: 'Support' },
    ticket_auto_response: { icon: Headphones, tone: 'var(--accent-support)',              label: 'Support' },
    welcome:        { icon: GsTrust,          tone: 'var(--color-primary)', label: 'Welcome' },
    profile_reminder: { icon: Bell,           tone: 'var(--accent-gift)',              label: 'Reminder' },
    incoming_call:  { icon: PhoneCall,        tone: 'var(--accent-call)',              label: 'Call' },
    call_status:    { icon: PhoneCall,        tone: 'var(--accent-call)',              label: 'Call' },
    followed_live:  { icon: Radio,            tone: 'var(--color-danger)',  label: 'Live' },
    story:          { icon: Camera,           tone: 'var(--accent-social)',              label: 'Story' },
    story_like:     { icon: GsVerifiedHeart,  tone: 'var(--accent-match)',              label: 'Story' },
    default:        { icon: Bell,             tone: 'var(--color-text-muted)', label: 'Update' },
};

const kindFor = (type) => KIND[type] || KIND.default;

/** Message-like types, for the Messages filter. */
const MESSAGE_TYPES = new Set(['message', 'member_message', 'admin_email']);

function timeAgo(ts) {
    const diff = Math.max(0, (Date.now() - new Date(ts || Date.now()).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function fullTime(ts) {
    try { return new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
    catch { return ''; }
}

/** Day bucket, so the list reads as a timeline rather than a wall. */
function dayGroup(ts) {
    const then = new Date(ts);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.floor((startOfToday - new Date(then.getFullYear(), then.getMonth(), then.getDate())) / 86400000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return 'This week';
    if (days < 30) return 'This month';
    return 'Earlier';
}

const GROUP_ORDER = ['Today', 'Yesterday', 'This week', 'This month', 'Earlier'];

function normalizeMessage(message) {
    const unreadCount = unreadMessageValue(message);
    return {
        id: message.id,
        source: 'message',
        type: message.type || 'message',
        title: message.title || message.sender || 'Message',
        body: message.body || message.message || '',
        image: message.senderImage || message.image || '',
        timestamp: message.timestamp || message.created_at || new Date().toISOString(),
        read: unreadCount === 0,
        conversationId: message.conversationId,
        memberId: message.memberId || message.profileId,
        actionLink: message.actionLink || '',
        sender: message.sender || 'GS Admin',
    };
}

function normalizeActivity(item) {
    return {
        id: item.id,
        source: 'activity',
        type: item.type || 'default',
        title: item.title || 'Activity',
        body: item.message || item.body || '',
        image: item.image || '',
        timestamp: item.timestamp || item.created_at || new Date().toISOString(),
        read: unreadActivityValue(item) === 0,
        memberId: item.memberId || item.profileId,
        actionLink: item.actionLink || '',
        sender: item.sender || 'Genuine Sugar Mummies',
    };
}

function Avatar({ item }) {
    const { icon: Icon, tone } = kindFor(item.type);
    if (item.image) {
        return (
            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full">
                <img src={item.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-white" style={{ background: tone }}>
                    <Icon size={11} className="text-white" />
                </span>
            </span>
        );
    }
    return (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${tone} 12%, transparent)` }}>
            <Icon size={19} style={{ color: tone }} />
        </span>
    );
}

export default function AlertsPage() {
    const router = useRouter();
    const { activity, messages, markActivityRead, markMessagesRead } = useAuth();
    const [tab, setTab] = useState('all');
    const [selected, setSelected] = useState(null);
    const [tick, setTick] = useState(0);

    // Relative labels change by the minute, not the second.
    useEffect(() => {
        const interval = setInterval(() => setTick((v) => v + 1), 60000);
        return () => clearInterval(interval);
    }, []);

    const inbox = useMemo(() => {
        const items = [
            ...(messages || []).map(normalizeMessage),
            ...(activity || []).filter((i) => i.type !== 'login').map(normalizeActivity),
        ];

        /**
         * Collapse the same event arriving from both sources.
         *
         * Sending a message writes to `messages` *and* logs to `activity`, with a
         * different generated id in each. Deduping on id therefore caught nothing,
         * and about a quarter of the inbox was the same notice twice — "New
         * message from Franc" directly above "Message from Franc", identical body,
         * identical timestamp.
         *
         * The signature is the body plus the minute it happened, which is specific
         * enough that two genuinely distinct notices will not collide and loose
         * enough to catch the pair. Where both exist, the richer one wins: the
         * entry carrying an avatar or a conversation to open.
         */
        const signature = (item) => {
            const minute = new Date(item.timestamp).toISOString().slice(0, 16);
            const body = String(item.body || item.title || '').trim().toLowerCase().slice(0, 120);
            return `${minute}|${body}`;
        };
        const richness = (item) =>
            (item.conversationId ? 2 : 0) + (item.image ? 1 : 0) + (item.memberId ? 1 : 0);

        const unique = new Map();
        for (const item of items) {
            const key = item.body || item.title ? signature(item) : (item.id || `${item.type}-${item.timestamp}`);
            const existing = unique.get(key);
            if (!existing) { unique.set(key, item); continue; }
            // Keep the more useful record, but stay unread if either side is.
            const winner = richness(item) > richness(existing) ? item : existing;
            unique.set(key, { ...winner, read: existing.read && item.read });
        }

        return [...unique.values()].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        // `tick` is intentionally a dependency: it refreshes the relative labels.
    }, [messages, activity, tick]);

    const unreadCount = inbox.filter((i) => !i.read).length;

    const visible = tab === 'unread' ? inbox.filter((i) => !i.read)
        : tab === 'messages' ? inbox.filter((i) => MESSAGE_TYPES.has(i.type))
        : inbox;

    // Group for display, preserving recency order inside each bucket.
    const grouped = useMemo(() => {
        const buckets = new Map();
        for (const item of visible) {
            const key = dayGroup(item.timestamp);
            if (!buckets.has(key)) buckets.set(key, []);
            buckets.get(key).push(item);
        }
        return GROUP_ORDER.filter((g) => buckets.has(g)).map((g) => [g, buckets.get(g)]);
    }, [visible]);

    /** Mark exactly the item that was opened — not the whole inbox. */
    function markOneRead(item) {
        if (item.read) return;
        if (item.source === 'message') markMessagesRead?.(item.id);
        else markActivityRead?.(item.id);
    }

    function openItem(item) {
        markOneRead(item);
        // Something to open? Go straight there. A detail screen for a one-line
        // notice is a dead end the member has to back out of.
        if (item.conversationId && item.memberId) { router.push(`/messages/${item.memberId}`); return; }
        // The server tells us where each alert leads: a live room, a call, the
        // story that was liked. Only in-app paths are followed — an alert is not
        // allowed to send a member to another origin.
        if (item.actionLink && item.actionLink.startsWith('/') && !item.actionLink.startsWith('//')) {
            router.push(item.actionLink);
            return;
        }
        if (item.memberId) {
            const id = String(item.memberId);
            router.push(id.startsWith('wp-') ? `/discover/${id.slice(3)}` : `/members/${id}`);
            return;
        }
        setSelected({ ...item, read: true });
    }

    /* ---------------- detail ---------------- */
    if (selected) {
        const { icon: Icon, tone, label } = kindFor(selected.type);
        return (
            <div className="px-4 py-4 pb-28 space-y-4">
                <div className="flex items-center gap-2">
                    <button onClick={() => setSelected(null)} aria-label="Back to alerts"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                        style={{ background: 'var(--color-surface)' }}>
                        <ArrowLeft size={18} className="text-text-primary" />
                    </button>
                    <h1 className="type-heading text-text-primary">{label}</h1>
                </div>

                <article className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)', boxShadow: 'var(--elevation-2)' }}>
                    <header className="flex items-start gap-3">
                        <Avatar item={selected} />
                        <div className="min-w-0 flex-1">
                            <h2 className="type-body-strong text-text-primary">{selected.title}</h2>
                            <p className="type-caption text-text-muted">{selected.sender} · {fullTime(selected.timestamp)}</p>
                        </div>
                    </header>

                    {selected.body && (
                        <p className="type-body whitespace-pre-wrap text-text-secondary">{selected.body}</p>
                    )}

                    {selected.memberId && (
                        <button onClick={() => openItem(selected)}
                            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl type-body-strong text-white gradient-primary">
                            <ExternalLink size={16} /> {selected.conversationId ? 'Open chat' : 'Open profile'}
                        </button>
                    )}
                </article>
            </div>
        );
    }

    /* ---------------- list ---------------- */
    return (
        <div className="px-4 py-4 pb-28 space-y-4">
            <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="type-title text-text-primary">Alerts</h1>
                    <p className="type-caption text-text-muted">
                        {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
                    </p>
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={() => { markActivityRead?.(); markMessagesRead?.(); }}
                        className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl px-3 type-caption font-semibold text-primary"
                        style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}
                    >
                        <CheckCheck size={15} /> Mark all read
                    </button>
                )}
            </header>

            <div role="tablist" aria-label="Filter alerts" className="grid grid-cols-3 gap-1 rounded-xl p-1" style={{ background: 'var(--color-surface)' }}>
                {[['all', 'All'], ['unread', `Unread${unreadCount ? ` (${unreadCount})` : ''}`], ['messages', 'Messages']].map(([id, label]) => (
                    <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                        className={`min-h-[40px] rounded-lg px-2 type-caption font-semibold transition-colors ${tab === id ? 'text-white gradient-primary' : 'text-text-secondary'}`}>
                        {label}
                    </button>
                ))}
            </div>

            {visible.length === 0 ? (
                <div className="space-y-3 py-16 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}>
                        {tab === 'unread' ? <CheckCheck size={28} className="text-primary" /> : <Mail size={28} className="text-primary" />}
                    </div>
                    <h2 className="type-heading text-text-primary">
                        {tab === 'unread' ? 'Nothing unread' : tab === 'messages' ? 'No messages yet' : 'No alerts yet'}
                    </h2>
                    <p className="mx-auto max-w-xs type-caption text-text-muted">
                        {tab === 'unread' ? 'You have read everything here.'
                            : tab === 'messages' ? 'Messages from other members and from support will appear here.'
                            : 'Likes, matches, gifts, payments and verification updates will appear here.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-5">
                    {grouped.map(([group, items]) => (
                        <section key={group} className="space-y-1.5">
                            <h2 className="px-1 type-micro text-text-muted">{group}</h2>
                            <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                                <AnimatePresence initial={false}>
                                    {items.map((item, index) => (
                                        <motion.button
                                            key={item.id || `${item.type}-${index}`}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            onClick={() => openItem(item)}
                                            className="flex w-full items-start gap-3 px-4 py-3 text-left"
                                            style={{
                                                background: item.read ? 'transparent' : 'color-mix(in srgb, var(--color-primary) 6%, transparent)',
                                                borderBottom: index === items.length - 1 ? 'none' : '1px solid rgba(20,16,26,0.06)',
                                            }}
                                        >
                                            <Avatar item={item} />
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-baseline gap-2">
                                                    <span className={`min-w-0 flex-1 truncate ${item.read ? 'type-body text-text-secondary' : 'type-body-strong text-text-primary'}`}>
                                                        {item.title}
                                                    </span>
                                                    <span className="shrink-0 type-caption text-text-muted">{timeAgo(item.timestamp)}</span>
                                                </span>
                                                {item.body && <span className="mt-0.5 block line-clamp-2 type-caption text-text-muted">{item.body}</span>}
                                            </span>
                                            {!item.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--color-primary)' }} />}
                                        </motion.button>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}
