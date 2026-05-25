'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Sparkles, MessageCircle, Shield, X, Zap, Star } from 'lucide-react';
import Link from 'next/link';

const BENEFITS = [
    { icon: Sparkles, text: 'Unlock private WhatsApp and Telegram channels with active sugar mummy contacts', color: '#F97316' },
    { icon: MessageCircle, text: 'Connect directly with verified, high-net-worth Sugar Mummies without intermediaries', color: '#6366F1' },
    { icon: Shield, text: '100% secure escrow system protecting all arrangements and allowances', color: '#10B981' },
    { icon: Crown, text: 'Distinct gold crown badge on your profile showing you are a verified premium member', color: '#F59E0B' },
    { icon: Zap, text: 'Direct access to a dedicated matchmaking administrator for personalized introductions', color: '#EC4899' },
    { icon: Star, text: 'Enjoy 10x higher visibility and appear at the top of every sugar mummy search feed', color: '#8B5CF6' },
];

export default function PromoPopup({ isOpen, onClose }) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9998] flex items-end justify-center bg-slate-950/40 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                        onClick={e => e.stopPropagation()}
                        className="w-full max-w-xl rounded-t-[32px] rounded-b-none overflow-hidden relative border-t border-x border-slate-200 flex flex-col h-[55vh] max-h-[55vh]"
                        style={{
                            background: 'linear-gradient(165deg, #FFFFFF 0%, #FAFAFC 100%)',
                            boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.06), 0 25px 50px -12px rgba(0, 0, 0, 0.1)',
                        }}
                    >
                        {/* Drag indicator/handle for standard mobile bottom sheets */}
                        <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto my-3 shrink-0" />

                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-3 right-5 z-10 w-8 h-8 rounded-full flex items-center justify-center text-slate-450 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                        >
                            <X size={18} />
                        </button>

                        {/* Premium header block */}
                        <div className="px-6 pb-3.5 pt-1 border-b border-slate-100 shrink-0">
                            <div className="flex items-center gap-2 mb-1 justify-center sm:justify-start">
                                <Crown className="text-amber-500 shrink-0" size={18} />
                                <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-100">
                                    VIP Privilege Invitation
                                </span>
                            </div>
                            <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight tracking-tight text-center sm:text-left">
                                Unlock Genuine Premium Matches
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5 text-center sm:text-left">
                                Join the secure network of high-net-worth Sugar Mummies and verified connections.
                            </p>
                        </div>

                        {/* Middle: Premium scrollable benefits list */}
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5 scrollbar-none">
                            {BENEFITS.map(({ icon: Icon, text, color }, i) => (
                                <div key={i} className="flex items-center gap-3.5 px-4 py-3 rounded-2xl bg-slate-50/50 border border-slate-100 transition-all hover:bg-slate-100/50">
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ background: `${color}10` }}>
                                        <Icon size={16} style={{ color }} />
                                    </div>
                                    <span className="text-xs text-slate-700 font-bold leading-relaxed tracking-wide">{text}</span>
                                </div>
                            ))}
                        </div>

                        {/* Bottom: Pricing + CTA footer fixed to the bottom of sheet */}
                        <div className="shrink-0 border-t border-slate-100 bg-slate-50/90 backdrop-blur-md px-6 py-5 flex flex-col gap-2.5">
                            <div className="text-center">
                                <p className="text-[10px] text-slate-450 tracking-wider">
                                    Subscriptions start at just <span className="text-emerald-600 font-black">KES 500 per month</span>
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2">
                                <Link
                                    href="/subscribe"
                                    onClick={onClose}
                                    className="flex-1 py-3 px-4 rounded-xl text-white text-xs font-black text-center tracking-wider block transition-all active:scale-98 bg-gradient-to-r from-purple-600 to-pink-600 shadow-[0_4px_15px_rgba(168,85,247,0.2)] hover:shadow-[0_4px_20px_rgba(168,85,247,0.3)]"
                                >
                                    JOIN VIP MATCH CLUB NOW
                                </Link>
                                <button
                                    onClick={onClose}
                                    className="py-3 px-6 rounded-xl text-slate-450 text-xs font-bold tracking-wider transition-all hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                                >
                                    Return to browsing
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
