'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Heart, Eye, MessageCircle, ChevronRight, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import SkeletonCard from '@/components/SkeletonCard'; // Not ideal for list, create custom skeleton later

export default function AlertsPage() {
    const { user, guest } = useAuth();
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            fetchAlerts();
        } else {
            setLoading(false);
        }
    }, [user]);

    const fetchAlerts = async () => {
        try {
            const res = await fetch('/api/alerts');
            const data = await res.json();
            setAlerts(data.alerts || []);
        } catch (error) {
            console.error('Error fetching alerts:', error);
        } finally {
            setLoading(false);
        }
    };

    if (guest && !user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-surface flex items-center justify-center mb-2">
                    <Bell size={40} className="text-primary" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">Activity Alerts</h2>
                    <p className="text-text-secondary">
                        Sign in to see who likes you, who viewed your profile, and your new matches.
                    </p>
                </div>
                <Link
                    href="/auth/login"
                    className="w-full max-w-xs py-3.5 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 block"
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
                <button className="text-xs text-primary font-medium">Mark all read</button>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-surface/50 animate-pulse">
                            <div className="w-12 h-12 rounded-full bg-white/10" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 w-3/4 bg-white/10 rounded" />
                                <div className="h-3 w-1/2 bg-white/10 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : alerts.length === 0 ? (
                <div className="text-center py-16 space-y-4">
                    <div className="text-5xl opacity-50">🔕</div>
                    <p className="text-text-secondary">No new alerts yet.</p>
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
                                                <User size={20} className="text-text-muted" />
                                            </div>
                                        )}
                                    </div>
                                    <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-bg-card ${alert.type === 'like' ? 'bg-primary' :
                                        alert.type === 'match' ? 'bg-gold' :
                                            'bg-accent'
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
    const diff = (now - date) / 1000; // seconds

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}
