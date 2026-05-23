'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Sparkles, MessageCircle, Heart, Shield, X, Zap, Star } from 'lucide-react';
import Link from 'next/link';

const BENEFITS = [
    { icon: MessageCircle, text: 'Unlimited direct messages with no limits', color: '#6366F1' },
    { icon: Heart, text: 'Unlimited daily profile interactions', color: '#EC4899' },
    { icon: Shield, text: 'GS Verified status next to your name', color: '#F59E0B' },
    { icon: Star, text: 'Top positioning in searches and listings', color: '#8B5CF6' },
    { icon: Zap, text: 'Fast-track priority admin matching support', color: '#10B981' },
    { icon: Sparkles, text: 'Access to verified sugar mum direct numbers', color: '#F97316' },
];

export default function PromoPopup({ isOpen, onClose }) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 30 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 30 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                        onClick={e => e.stopPropagation()}
                        className="w-full max-w-md rounded-[32px] overflow-hidden relative border border-purple-500/30"
                        style={{
                            background: 'linear-gradient(165deg, #130a24 0%, #09090e 100%)',
                            boxShadow: '0 0 50px rgba(168, 85, 247, 0.15), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        }}
                    >
                        {/* Dismiss button */}
                        <button
                            onClick={onClose}
                            className="absolute top-5 right-5 z-10 w-9 h-9 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                        >
                            <X size={18} />
                        </button>

                        {/* Luxury header banner */}
                        <div className="px-6 pt-10 pb-6 text-center relative border-b border-white/5">
                            {/* Animated glowing crown emblem */}
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center relative bg-gradient-to-br from-purple-600 to-pink-500 shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                                <Crown size={30} className="text-white" />
                                <motion.div
                                    animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
                                    transition={{ duration: 2.5, repeat: Infinity }}
                                    className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 blur-md -z-10"
                                />
                            </div>

                            <h2 className="text-2xl font-black text-white tracking-tight">
                                GS VIP CLUB INVITATION
                            </h2>
                            <p className="text-xs text-purple-200/60 mt-1 max-w-[280px] mx-auto">
                                Upgrade today for secure escrow matching and premium privileges
                            </p>
                        </div>

                        {/* Clean Benefits Grid */}
                        <div className="p-6 space-y-3">
                            {BENEFITS.map(({ icon: Icon, text, color }, i) => (
                                <div key={i} className="flex items-center gap-3.5 px-4 py-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ background: `${color}15` }}>
                                        <Icon size={16} style={{ color }} />
                                    </div>
                                    <span className="text-xs text-white/90 font-semibold tracking-wide">{text}</span>
                                </div>
                            ))}
                        </div>

                        {/* Upgrade pricing tag */}
                        <div className="px-6 text-center">
                            <p className="text-[11px] text-white/40 tracking-wider">
                                Subscriptions start at just <span className="text-emerald-400 font-extrabold">KES 500 per month</span>
                            </p>
                        </div>

                        {/* Premium CTA actions */}
                        <div className="p-6 flex flex-col gap-3">
                            <Link
                                href="/subscribe"
                                onClick={onClose}
                                className="w-full py-4 rounded-2xl text-white text-sm font-black text-center tracking-wider block transition-all active:scale-98 bg-gradient-to-r from-purple-600 to-pink-600 shadow-[0_4px_20px_rgba(168,85,247,0.35)] hover:shadow-[0_4px_25px_rgba(168,85,247,0.5)]"
                            >
                                JOIN VIP MATCH CLUB NOW
                            </Link>
                            <button
                                onClick={onClose}
                                className="w-full py-2.5 rounded-2xl text-white/30 text-xs font-semibold tracking-wider transition-all hover:text-white/50 cursor-pointer"
                            >
                                Return to browsing
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
