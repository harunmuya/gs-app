'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Heart, Eye, MessageCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function AlertsPage() {
    const { user, guest, likes, matches } = useAuth();

    // Generate alerts from localStorage data
    const alerts = useMemo(() => {
        const notifications = [];

        // Add match notifications
        if (matches && matches.length > 0) {
            matches.forEach(match => {
                notifications.push({
                    id: `match-${match.wpId}`,
                    type: 'match',
                    title: 'New Match! 💖',
                    message: `You matched with ${match.name || 'Someone'}`,
                    image: match.imageUrl,
                    time: match.matchedAt || new Date().toISOString(),
                    read: false,
                });
            });
        }

        // Add like notifications
        if (likes && likes.length > 0) {
            likes.forEach(like => {
                // Don't duplicate if already a match
                if (matches?.find(m => m.wpId === like.wpId)) return;
                notifications.push({
                    id: `like-${like.wpId}`,
                    type: 'like',
                    title: 'You Liked 💘',
                    message: `You liked ${like.name || 'a profile'}`,
                    image: like.imageUrl,
                    time: like.likedAt || new Date().toISOString(),
                    read: true,
                });
            });
        }

        // Sort by time
        notifications.sort((a, b) => new Date(b.time) - new Date(a.time));
        return notifications;
    }, [likes, matches]);

    if (guest && !user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-surface flex items-center justify-center mb-2">
                    <Bell size={40} className="text-primary" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">Activity Alerts</h2>
                    <p className="text-text-secondary">
                        Sign in to see your likes, matches, and activity.
                    </p>
                </div>
                <Link
                    href="/auth/login"
                    className="w-full max-w-xs py-3.5 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 block text-center"
                >
                    Sign In to Unlock
                </Link>
            </div>
        );
    }

    return (
        <div className="px-5 pt-4 pb-24">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Bell size={24} className="text-primary" />
                    <h1 className="text-xl font-bold text-text-primary">Alerts</h1>
                </div>
                <span className="text-xs text-text-muted bg-surface rounded-full px-2.5 py-0.5">
                    {alerts.filter(a => !a.read).length} new
                </span>
            </div>

            {alerts.length === 0 ? (
                <div className="text-center py-16 space-y-4">
                    <div className="text-5xl opacity-50">🔕</div>
                    <p className="text-text-secondary">No alerts yet. Start swiping to get alerts!</p>
                </div>
            ) : (
                <div className="space-y-3">
                    <AnimatePresence>
                        {alerts.map((alert, index) => (
                            <motion.div
                                key={alert.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className={`relative flex items-center gap-4 p-4 rounded-2xl ${alert.read ? 'bg-bg-card' : 'bg-surface card-shadow'
                                    } hover:bg-surface-light transition-colors`}
                                style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                            >
                                {/* Icon/Avatar */}
                                <div className="relative shrink-0">
                                    <div className="w-12 h-12 rounded-full overflow-hidden bg-bg-dark ring-2 ring-surface">
                                        {alert.image ? (
                                            <img src={alert.image} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-surface">
                                                <Heart size={20} className="text-text-muted" />
                                            </div>
                                        )}
                                    </div>
                                    <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-bg-card ${alert.type === 'like' ? 'bg-primary' :
                                        alert.type === 'match' ? 'bg-gold' : 'bg-accent'
                                        }`}>
                                        {alert.type === 'like' && <Heart size={12} fill="white" className="text-white" />}
                                        {alert.type === 'match' && <MessageCircle size={12} fill="white" className="text-white" />}
                                        {alert.type === 'view' && <Eye size={12} className="text-white" />}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-0.5">
                                        <h3 className={`text-sm font-semibold truncate ${alert.read ? 'text-text-secondary' : 'text-white'
                                            }`}>
                                            {alert.title}
                                        </h3>
                                        <span className="text-[10px] text-text-muted shrink-0 ml-2">
                                            {formatTime(alert.time)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-text-muted truncate">
                                        {alert.message}
                                    </p>
                                </div>

                                {!alert.read && (
                                    <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}

function formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diff = (now - date) / 1000;

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}
