'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Heart, Eye, MessageCircle, Bookmark, User, LogIn, Star, Flame, Zap, Phone, Send, BellOff, Sparkles, UserCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const ICON_MAP = {
    like: { icon: Heart, color: 'bg-primary', fill: true },
    match: { icon: Star, color: 'bg-gold', fill: true },
    message: { icon: MessageCircle, color: 'bg-accent', fill: false },
    save: { icon: Bookmark, color: 'bg-blue-500', fill: true },
    view: { icon: Eye, color: 'bg-surface-light', fill: false },
    login: { icon: LogIn, color: 'bg-success', fill: false },
    profile_update: { icon: UserCheck, color: 'bg-surface-light', fill: false },
    photo_added: { icon: User, color: 'bg-primary', fill: false },
    request_hookup: { icon: Flame, color: 'bg-red-500', fill: true },
    connection_request: { icon: Zap, color: 'bg-blue-500', fill: true },
    meetup_ready: { icon: Flame, color: 'bg-orange-500', fill: true },
};

const HOOKUP_TYPES = new Set(['request_hookup', 'connection_request', 'meetup_ready']);

// Telegram SVG icon component
function TelegramIcon({ size = 14, className = '' }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
    );
}

export default function AlertsPage() {
    const { user, guest, activity, markActivityRead, requestConnection } = useAuth();
    const router = useRouter();

    const unreadCount = useMemo(() => activity.filter(a => !a.read).length, [activity]);

    if (guest && !user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-surface flex items-center justify-center mb-2">
                    <Bell size={40} className="text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-text-primary">Activity</h2>
                <p className="text-text-secondary">Sign in to track your activity.</p>
                <button onClick={() => router.push('/auth/login')} className="w-full max-w-xs py-3.5 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 block text-center">
                    Sign In
                </button>
            </div>
        );
    }

    return (
        <div className="px-4 pt-4 pb-24">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <Bell size={22} className="text-primary" />
                    <h1 className="text-xl font-bold text-text-primary">Activity</h1>
                    {unreadCount > 0 && (
                        <span className="text-[10px] font-bold text-white bg-primary rounded-full w-5 h-5 flex items-center justify-center">
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
                    <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mx-auto">
                        <BellOff size={32} className="text-text-muted" />
                    </div>
                    <h2 className="text-lg font-bold text-text-primary">No activity yet</h2>
                    <p className="text-text-secondary text-sm">Start swiping to see your activity here!</p>
                </div>
            ) : (
                <div className="space-y-2">
                    <AnimatePresence>
                        {activity.map((item, index) => {
                            const iconData = ICON_MAP[item.type] || ICON_MAP.view;
                            const Icon = iconData.icon;
                            const hasProfile = !!item.profileId;
                            const isHookup = HOOKUP_TYPES.has(item.type);

                            // Build Telegram link with auto-fill message
                            const profileName = (item.title || '').replace(/^.*?([\w]+)\s*(is|wants|sent|liked|viewed|match).*$/i, '$1').trim() || 'a sugar mummy';
                            const telegramMsg = encodeURIComponent(`Hi, need a match connection with ${profileName}`);
                            const telegramLink = `https://t.me/GSADMINMARYGAGENCY?text=${telegramMsg}`;

                            const handleAlertClick = () => {
                                if (hasProfile) {
                                    router.push(`/discover/${item.profileId}`);
                                }
                            };

                            return (
                                <motion.div key={item.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(index * 0.03, 0.5) }}
                                    onClick={handleAlertClick}
                                    className={`relative flex items-start gap-3.5 p-3.5 rounded-2xl transition-colors ${item.read ? 'bg-bg-dark' : 'bg-bg-card card-shadow'} ${hasProfile ? 'cursor-pointer hover:bg-surface/50' : ''}`}
                                    style={{ border: '1px solid rgba(0,0,0,0.06)' }}>

                                    {/* Avatar / Icon */}
                                    <div className="relative shrink-0">
                                        <div className="w-11 h-11 rounded-full overflow-hidden bg-surface ring-1 ring-black/5">
                                            {item.image ? (
                                                <img src={item.image} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Icon size={18} className="text-text-muted" />
                                                </div>
                                            )}
                                        </div>
                                        <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white ${iconData.color}`}>
                                            <Icon size={10} className="text-white" fill={iconData.fill ? 'white' : 'none'} />
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-0.5">
                                            <h3 className={`text-sm font-semibold truncate ${item.read ? 'text-text-secondary' : 'text-text-primary'}`}>
                                                {item.title}
                                            </h3>
                                            <span className="text-[10px] text-text-muted shrink-0">{formatTime(item.timestamp)}</span>
                                        </div>
                                        {item.message && <p className="text-xs text-text-muted truncate">{item.message}</p>}

                                        {/* Request Connection button — opens Telegram (uses button to avoid nested <a>) */}
                                        {isHookup && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    requestConnection?.(profileName, item.profileId);
                                                    window.open(telegramLink, '_blank');
                                                }}
                                                className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-full text-[11px] font-semibold text-white shadow-sm hover:shadow-md transition-all active:scale-95"
                                                style={{ background: '#26A5E4' }}
                                            >
                                                <TelegramIcon size={12} />
                                                Request Connection
                                            </button>
                                        )}
                                    </div>

                                    {!item.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse mt-2" />}
                                </motion.div>
                            );
                        })}
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
