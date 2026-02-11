'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Heart, Eye, MessageCircle, Bookmark, User, LogIn, Star } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

const ICON_MAP = {
    like: { icon: Heart, color: 'bg-primary', fill: true },
    match: { icon: Star, color: 'bg-gold', fill: true },
    message: { icon: MessageCircle, color: 'bg-accent', fill: false },
    save: { icon: Bookmark, color: 'bg-blue-500', fill: true },
    view: { icon: Eye, color: 'bg-surface-light', fill: false },
    login: { icon: LogIn, color: 'bg-success', fill: false },
    profile_update: { icon: User, color: 'bg-surface-light', fill: false },
    photo_added: { icon: User, color: 'bg-primary', fill: false },
};

export default function AlertsPage() {
    const { user, guest, activity, markActivityRead } = useAuth();

    const unreadCount = useMemo(() => activity.filter(a => !a.read).length, [activity]);

    if (guest && !user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-surface flex items-center justify-center mb-2">
                    <Bell size={40} className="text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-white">Activity</h2>
                <p className="text-text-secondary">Sign in to track your activity.</p>
                <Link href="/auth/login" className="w-full max-w-xs py-3.5 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 block text-center">
                    Sign In
                </Link>
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
                    <div className="text-5xl opacity-50">🔕</div>
                    <h2 className="text-lg font-bold text-text-primary">No activity yet</h2>
                    <p className="text-text-secondary text-sm">Start swiping to see your activity here!</p>
                </div>
            ) : (
                <div className="space-y-2">
                    <AnimatePresence>
                        {activity.map((item, index) => {
                            const iconData = ICON_MAP[item.type] || ICON_MAP.view;
                            const Icon = iconData.icon;

                            return (
                                <motion.div key={item.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(index * 0.03, 0.5) }}
                                    className={`relative flex items-center gap-3.5 p-3.5 rounded-2xl transition-colors ${item.read ? 'bg-bg-card/50' : 'bg-bg-card card-shadow'}`}
                                    style={{ border: '1px solid rgba(255,255,255,0.04)' }}>

                                    {/* Avatar / Icon */}
                                    <div className="relative shrink-0">
                                        <div className="w-11 h-11 rounded-full overflow-hidden bg-surface ring-1 ring-white/5">
                                            {item.image ? (
                                                <img src={item.image} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Icon size={18} className="text-text-muted" />
                                                </div>
                                            )}
                                        </div>
                                        <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-bg-card ${iconData.color}`}>
                                            <Icon size={10} className="text-white" fill={iconData.fill ? 'white' : 'none'} />
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-0.5">
                                            <h3 className={`text-sm font-semibold truncate ${item.read ? 'text-text-secondary' : 'text-white'}`}>
                                                {item.title}
                                            </h3>
                                            <span className="text-[10px] text-text-muted shrink-0">{formatTime(item.timestamp)}</span>
                                        </div>
                                        {item.message && <p className="text-xs text-text-muted truncate">{item.message}</p>}
                                    </div>

                                    {!item.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse" />}
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
