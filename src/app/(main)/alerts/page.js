'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Heart, Eye, MessageCircle, Bookmark, User, LogIn, Star, Flame, Zap, BellOff, UserCheck, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const ICON_MAP = {
    like: { icon: Heart, color: 'var(--color-primary)', fill: true },
    match: { icon: Star, color: 'var(--color-gold)', fill: true },
    message: { icon: MessageCircle, color: 'var(--color-primary)', fill: false },
    save: { icon: Bookmark, color: '#3B82F6', fill: true },
    view: { icon: Eye, color: 'var(--color-surface)', fill: false },
    login: { icon: LogIn, color: 'var(--color-success)', fill: false },
    profile_update: { icon: UserCheck, color: 'var(--color-surface)', fill: false },
    photo_added: { icon: User, color: 'var(--color-primary)', fill: false },
    request_hookup: { icon: Flame, color: '#EF4444', fill: true },
    connection_request: { icon: Zap, color: '#3B82F6', fill: true },
    meetup_ready: { icon: Flame, color: '#F97316', fill: true },
};

const HOOKUP_TYPES = new Set(['request_hookup', 'connection_request', 'meetup_ready']);
const LONG_MESSAGE_THRESHOLD = 100;

// Telegram SVG icon component
function TelegramIcon({ size = 14, className = '' }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
    );
}

function ActivityItem({ item, index, router, requestConnection, markSingleActivityRead }) {
    const [expanded, setExpanded] = useState(false);
    const [showFullMessage, setShowFullMessage] = useState(false);

    const iconData = ICON_MAP[item.type] || ICON_MAP.view;
    const Icon = iconData.icon;
    const hasProfile = !!item.profileId;
    const isHookup = HOOKUP_TYPES.has(item.type);
    const isLongMessage = item.message && item.message.length > LONG_MESSAGE_THRESHOLD;

    // Build Telegram link with auto-fill message
    const profileName = (item.title || '').replace(/^.*?([\w]+)\s*(is|wants|sent|liked|viewed|match).*$/i, '$1').trim() || 'a sugar mummy';
    const telegramMsg = encodeURIComponent(`Hi, need a match connection with ${profileName}`);
    const telegramLink = `https://t.me/GSADMINMARYGAGENCY?text=${telegramMsg}`;

    const handleToggleExpand = useCallback((e) => {
        e.stopPropagation();
        setExpanded(prev => {
            const next = !prev;
            if (next && !item.read && markSingleActivityRead) {
                markSingleActivityRead(item.id);
            }
            return next;
        });
    }, [item.id, item.read, markSingleActivityRead]);

    const handleShowMore = useCallback((e) => {
        e.stopPropagation();
        setShowFullMessage(prev => !prev);
    }, []);

    const handleViewProfile = useCallback((e) => {
        e.stopPropagation();
        if (hasProfile) {
            router.push(`/discover/${item.profileId}`);
        }
    }, [hasProfile, item.profileId, router]);

    const displayMessage = item.message
        ? (isLongMessage && !showFullMessage ? item.message.slice(0, LONG_MESSAGE_THRESHOLD) + '…' : item.message)
        : null;

    return (
        <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(index * 0.03, 0.5) }}
            onClick={handleToggleExpand}
            style={{
                background: item.read ? 'var(--color-bg)' : 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                boxShadow: item.read ? 'none' : 'var(--card-shadow)',
                borderRadius: '16px',
                padding: '14px',
                cursor: 'pointer',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: '0',
                transition: 'background 0.2s ease, box-shadow 0.2s ease',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                {/* Avatar / Icon */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div
                        style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            background: 'var(--color-surface)',
                            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {item.image ? (
                            <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <Icon size={18} style={{ color: 'var(--color-text-muted)' }} />
                        )}
                    </div>
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '-2px',
                            right: '-2px',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '2px solid var(--color-bg-card)',
                            background: iconData.color,
                        }}
                    >
                        <Icon size={10} style={{ color: '#fff' }} fill={iconData.fill ? 'white' : 'none'} />
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '2px' }}>
                        <h3
                            style={{
                                fontSize: '14px',
                                fontWeight: 600,
                                color: item.read ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                                margin: 0,
                                lineHeight: 1.4,
                            }}
                        >
                            {item.title}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{formatTime(item.timestamp)}</span>
                            {expanded
                                ? <ChevronUp size={14} style={{ color: 'var(--color-text-muted)' }} />
                                : <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />
                            }
                        </div>
                    </div>

                    {/* Message text — full by default, show more toggle for long ones */}
                    {displayMessage && (
                        <div>
                            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
                                {displayMessage}
                            </p>
                            {isLongMessage && (
                                <button
                                    onClick={handleShowMore}
                                    style={{
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        color: 'var(--color-primary)',
                                        background: 'none',
                                        border: 'none',
                                        padding: '2px 0',
                                        cursor: 'pointer',
                                        marginTop: '2px',
                                    }}
                                >
                                    {showFullMessage ? 'Show less' : 'Show more'}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Hookup: Request Connection button */}
                    {isHookup && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                requestConnection?.(profileName, item.profileId);
                                window.open(telegramLink, '_blank');
                            }}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                marginTop: '8px',
                                padding: '6px 12px',
                                borderRadius: '9999px',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: '#fff',
                                background: '#26A5E4',
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 2px 6px rgba(38,165,228,0.3)',
                                transition: 'box-shadow 0.2s ease, transform 0.1s ease',
                            }}
                        >
                            <TelegramIcon size={12} />
                            Request Connection
                        </button>
                    )}
                </div>

                {/* Unread indicator */}
                {!item.read && (
                    <div
                        style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: 'var(--color-primary)',
                            flexShrink: 0,
                            marginTop: '8px',
                            animation: 'pulseSoft 2s ease-in-out infinite',
                        }}
                    />
                )}
            </div>

            {/* Expanded details panel */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div
                            style={{
                                marginTop: '12px',
                                paddingTop: '12px',
                                borderTop: '1px solid var(--color-border)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                            }}
                        >
                            {/* Full title */}
                            <div>
                                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Title</span>
                                <p style={{ fontSize: '13px', color: 'var(--color-text-primary)', margin: '2px 0 0', lineHeight: 1.5 }}>
                                    {item.title}
                                </p>
                            </div>

                            {/* Full message */}
                            {item.message && (
                                <div>
                                    <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Message</span>
                                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '2px 0 0', lineHeight: 1.5 }}>
                                        {item.message}
                                    </p>
                                </div>
                            )}

                            {/* Timestamp */}
                            {item.timestamp && (
                                <div>
                                    <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Time</span>
                                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                                        {formatFullTime(item.timestamp)}
                                    </p>
                                </div>
                            )}

                            {/* Profile link */}
                            {hasProfile && (
                                <button
                                    onClick={handleViewProfile}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        marginTop: '4px',
                                        padding: '8px 16px',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        color: '#fff',
                                        background: 'var(--color-primary)',
                                        border: 'none',
                                        cursor: 'pointer',
                                        boxShadow: 'var(--btn-shadow)',
                                        transition: 'opacity 0.2s ease, transform 0.1s ease',
                                        alignSelf: 'flex-start',
                                    }}
                                >
                                    <ExternalLink size={12} />
                                    View Profile
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

export default function AlertsPage() {
    const { user, activity, markActivityRead, markSingleActivityRead, requestConnection } = useAuth();
    const router = useRouter();

    const unreadCount = useMemo(() => activity.filter(a => !a.read).length, [activity]);

    return (
        <div className="px-4 pt-4 pb-24">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <Bell size={22} className="text-primary" />
                    <h1 className="text-xl font-bold text-text-primary">Activity</h1>
                    {unreadCount > 0 && (
                        <span
                            className="text-[10px] font-bold text-white rounded-full w-5 h-5 flex items-center justify-center"
                            style={{ background: 'var(--color-primary)' }}
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </div>
                {unreadCount > 0 && (
                    <button onClick={markActivityRead} className="text-xs text-primary font-medium hover:underline">
                        Mark all read
                    </button>
                )}
            </div>

            {activity.length === 0 ? (
                <div className="text-center py-16 space-y-4">
                    <div
                        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                        style={{ background: 'var(--color-surface)' }}
                    >
                        <BellOff size={32} className="text-text-muted" />
                    </div>
                    <h2 className="text-lg font-bold text-text-primary">No activity yet</h2>
                    <p className="text-text-secondary text-sm">Start swiping to see your activity here!</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <AnimatePresence>
                        {activity.map((item, index) => (
                            <ActivityItem
                                key={item.id}
                                item={item}
                                index={index}
                                router={router}
                                requestConnection={requestConnection}
                                markSingleActivityRead={markSingleActivityRead}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}

function formatTime(iso) {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
}

function formatFullTime(iso) {
    if (!iso) return '';
    try {
        const date = new Date(iso);
        return date.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    } catch {
        return iso;
    }
}
