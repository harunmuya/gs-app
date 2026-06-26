'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Sparkles, MessageCircle, Shield, X, Zap, Star, Heart, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';

const BENEFITS = [
    { icon: Sparkles, text: 'Unlock private WhatsApp and Telegram channels with active sugar mummy contacts', color: '#F97316', darkColor: '#FB923C' },
    { icon: MessageCircle, text: 'Connect directly with verified, high-net-worth Sugar Mummies without intermediaries', color: '#6366F1', darkColor: '#818CF8' },
    { icon: Shield, text: '100% secure escrow system protecting all arrangements and allowances', color: '#10B981', darkColor: '#34D399' },
    { icon: Crown, text: 'Distinct gold crown badge on your profile showing you are a verified premium member', color: '#F59E0B', darkColor: '#FBBF24' },
    { icon: Zap, text: 'Direct access to a dedicated matchmaking administrator for personalized introductions', color: '#EC4899', darkColor: '#F472B6' },
    { icon: Star, text: 'Enjoy 10x higher visibility and appear at the top of every sugar mummy search feed', color: '#8B5CF6', darkColor: '#A78BFA' },
    { icon: TrendingUp, text: 'Priority matching algorithm connects you with high-value members in your area first', color: '#06B6D4', darkColor: '#22D3EE' },
    { icon: Users, text: 'Exclusive access to VIP members-only events and meetups across East Africa', color: '#EF4444', darkColor: '#F87171' },
];

export default function PromoPopup({ isOpen, onClose }) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9998] flex items-end justify-center"
                    style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                        onClick={e => e.stopPropagation()}
                        className="w-full max-w-xl rounded-t-[32px] rounded-b-none overflow-hidden relative flex flex-col h-[62vh] max-h-[62vh]"
                        style={{
                            background: 'var(--color-bg-card)',
                            border: 'var(--card-border)',
                            boxShadow: '0 -10px 60px rgba(0, 0, 0, 0.15), 0 25px 50px -12px rgba(0, 0, 0, 0.15)',
                        }}
                    >
                        {/* Drag indicator */}
                        <div className="w-12 h-1 rounded-full mx-auto my-3 shrink-0" style={{ background: 'var(--color-border)' }} />

                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-3 right-5 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer"
                            style={{ color: 'var(--color-text-muted)', background: 'var(--color-surface)' }}
                        >
                            <X size={18} />
                        </button>

                        {/* Premium header block */}
                        <div className="px-6 pb-3.5 pt-1 shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
                            {/* Animated crown glow */}
                            <div className="flex items-center gap-2 mb-2 justify-center sm:justify-start">
                                <motion.div
                                    animate={{ scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                >
                                    <Crown className="text-amber-500 shrink-0" size={20} />
                                </motion.div>
                                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full"
                                    style={{ background: 'rgba(245,158,11,0.1)', color: '#D97706', border: '1px solid rgba(245,158,11,0.2)' }}>
                                    VIP Privilege Invitation
                                </span>
                            </div>
                            <h2 className="text-xl sm:text-2xl font-black leading-tight tracking-tight text-center sm:text-left"
                                style={{ color: 'var(--color-text-primary)' }}>
                                Unlock Genuine Premium Matches
                            </h2>
                            <p className="text-xs mt-0.5 text-center sm:text-left" style={{ color: 'var(--color-text-muted)' }}>
                                Join the secure network of high-net-worth Sugar Mummies and verified connections.
                            </p>
                        </div>

                        {/* Scrollable benefits list */}
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5 scrollbar-none">
                            {BENEFITS.map(({ icon: Icon, text, color, darkColor }, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.06, duration: 0.3 }}
                                    className="flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all"
                                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                                >
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ background: `${color}15` }}>
                                        <Icon size={17} style={{ color }} />
                                    </div>
                                    <span className="text-xs font-bold leading-relaxed tracking-wide"
                                        style={{ color: 'var(--color-text-secondary)' }}>{text}</span>
                                </motion.div>
                            ))}

                            {/* Social proof */}
                            <div className="flex items-center justify-center gap-2 py-2">
                                <div className="flex -space-x-2">
                                    {['🇰🇪', '🇺🇬', '🇹🇿'].map((flag, i) => (
                                        <div key={i} className="w-7 h-7 rounded-full flex items-center justify-center text-sm ring-2"
                                            style={{ background: 'var(--color-surface)', ringColor: 'var(--color-bg-card)' }}>
                                            {flag}
                                        </div>
                                    ))}
                                </div>
                                <span className="text-[10px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                                    2,400+ active premium members across East Africa
                                </span>
                            </div>
                        </div>

                        {/* Bottom: Pricing + CTA footer */}
                        <div className="shrink-0 px-6 py-5 flex flex-col gap-3"
                            style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
                            {/* Price badge */}
                            <div className="text-center">
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full"
                                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                                    <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Starting at</span>
                                    <span className="text-sm font-black" style={{ color: '#10B981' }}>KES 650</span>
                                    <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>/month</span>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2">
                                <Link
                                    href="/subscribe"
                                    onClick={onClose}
                                    className="flex-1 py-3.5 px-4 rounded-2xl text-white text-xs font-black text-center tracking-wider block transition-all active:scale-[0.98]"
                                    style={{
                                        background: 'linear-gradient(135deg, #6366F1, #EC4899)',
                                        boxShadow: '0 6px 20px rgba(99,102,241,0.3)',
                                    }}
                                >
                                    <Crown size={13} className="inline mr-1.5 -mt-0.5" />
                                    JOIN VIP MATCH CLUB NOW
                                </Link>
                                <button
                                    onClick={onClose}
                                    className="py-3 px-6 rounded-2xl text-xs font-bold tracking-wider transition-all cursor-pointer"
                                    style={{ color: 'var(--color-text-muted)', background: 'var(--color-surface)' }}
                                >
                                    Maybe later
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
