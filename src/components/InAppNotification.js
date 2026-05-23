'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Bell, AlertTriangle, Sparkles, X } from 'lucide-react';

// Global notification queue — can be called from anywhere
let _addNotification = null;

export function showNotification(title, body = '', type = 'info') {
    if (_addNotification) {
        _addNotification({ id: Date.now(), title, body, type });
    }
}

const TYPE_CONFIG = {
    success: {
        icon: CheckCircle,
        bg: 'rgba(16, 185, 129, 0.12)',
        border: 'rgba(16, 185, 129, 0.35)',
        iconColor: '#10B981',
        bar: '#10B981',
        label: 'Success',
    },
    info: {
        icon: Bell,
        bg: 'rgba(59, 130, 246, 0.12)',
        border: 'rgba(59, 130, 246, 0.35)',
        iconColor: '#3B82F6',
        bar: '#3B82F6',
        label: 'Info',
    },
    warning: {
        icon: AlertTriangle,
        bg: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(245, 158, 11, 0.35)',
        iconColor: '#F59E0B',
        bar: '#F59E0B',
        label: 'Alert',
    },
    promo: {
        icon: Sparkles,
        bg: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(236,72,153,0.15))',
        border: 'rgba(139, 92, 246, 0.4)',
        iconColor: '#C084FC',
        bar: 'linear-gradient(90deg, #8B5CF6, #EC4899)',
        label: 'Offer',
    },
    verification: {
        icon: CheckCircle,
        bg: 'rgba(16, 185, 129, 0.12)',
        border: 'rgba(16, 185, 129, 0.35)',
        iconColor: '#10B981',
        bar: '#10B981',
        label: 'Verified',
    },
};

const DURATION = 5500;

function NotifItem({ notif, onDismiss }) {
    const [progress, setProgress] = useState(100);
    const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.info;
    const Icon = cfg.icon;

    useEffect(() => {
        const start = Date.now();
        const interval = setInterval(() => {
            const elapsed = Date.now() - start;
            const pct = Math.max(0, 100 - (elapsed / DURATION) * 100);
            setProgress(pct);
            if (pct === 0) clearInterval(interval);
        }, 50);
        const timer = setTimeout(() => onDismiss(notif.id), DURATION);
        return () => { clearInterval(interval); clearTimeout(timer); };
    }, [notif.id, onDismiss]);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 80, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            style={{
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
            }}
            className="relative w-80 rounded-2xl overflow-hidden shadow-2xl"
        >
            <div className="p-4 flex items-start gap-3">
                {/* GS badge for verification type, icon otherwise */}
                {notif.type === 'verification' ? (
                    <img src="/gs-logo.png" alt="GS" className="w-9 h-9 rounded-full shrink-0"
                        style={{ border: '1.5px solid #F59E0B', boxShadow: '0 0 6px rgba(245,158,11,0.4)' }} />
                ) : (
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `${cfg.iconColor}18` }}>
                        <Icon size={18} style={{ color: cfg.iconColor }} />
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-white leading-tight truncate">{notif.title}</p>
                    {notif.body && (
                        <p className="text-[11px] text-white/60 leading-snug mt-0.5 line-clamp-2">{notif.body}</p>
                    )}
                </div>

                <button
                    onClick={() => onDismiss(notif.id)}
                    className="text-white/30 hover:text-white/70 transition-colors ml-1 shrink-0 mt-0.5"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Progress bar */}
            <div className="h-0.5 w-full bg-white/10">
                <div
                    className="h-full transition-all"
                    style={{
                        width: `${progress}%`,
                        background: cfg.bar,
                    }}
                />
            </div>
        </motion.div>
    );
}

export default function InAppNotification() {
    const [notifs, setNotifs] = useState([]);

    const addNotification = useCallback((notif) => {
        setNotifs(prev => [notif, ...prev.slice(0, 4)]); // max 5 at once
    }, []);

    useEffect(() => {
        _addNotification = addNotification;
        return () => { _addNotification = null; };
    }, [addNotification]);

    const dismiss = useCallback((id) => {
        setNotifs(prev => prev.filter(n => n.id !== id));
    }, []);

    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
            <AnimatePresence mode="popLayout">
                {notifs.map(n => (
                    <div key={n.id} className="pointer-events-auto">
                        <NotifItem notif={n} onDismiss={dismiss} />
                    </div>
                ))}
            </AnimatePresence>
        </div>
    );
}
