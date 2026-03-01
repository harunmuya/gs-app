'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Check, Star, Shield, Zap, MessageCircle, Heart, Eye, Send, ArrowLeft, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const PLANS = [
    {
        id: 'free',
        name: 'Free',
        price: 'KES 0',
        period: 'Forever',
        color: '#6b7280',
        icon: Heart,
        popular: false,
        features: [
            { text: 'Browse profiles', included: true },
            { text: 'Like & pass (10/day)', included: true },
            { text: 'Comment on profiles', included: true },
            { text: 'View match scores', included: true },
            { text: 'Unlimited likes', included: false },
            { text: 'See who liked you', included: false },
            { text: 'Direct messaging', included: false },
            { text: 'Priority support', included: false },
            { text: 'Verified badge', included: false },
        ],
    },
    {
        id: 'silver',
        name: 'Silver',
        price: 'KES 500',
        period: '/month',
        color: '#9ca3af',
        icon: Star,
        popular: false,
        features: [
            { text: 'Everything in Free', included: true },
            { text: 'Unlimited likes', included: true },
            { text: 'See who liked you', included: true },
            { text: '5 super likes/day', included: true },
            { text: 'Direct messaging', included: true },
            { text: 'Priority support', included: false },
            { text: 'Verified badge', included: false },
            { text: 'Profile boost', included: false },
        ],
    },
    {
        id: 'gold',
        name: 'Gold',
        price: 'KES 1,000',
        period: '/month',
        color: '#d97706',
        icon: Crown,
        popular: true,
        features: [
            { text: 'Everything in Silver', included: true },
            { text: 'Unlimited super likes', included: true },
            { text: 'Priority in discover', included: true },
            { text: 'See profile visitors', included: true },
            { text: 'Priority support', included: true },
            { text: 'Verified badge', included: true },
            { text: 'Profile boost (1x/week)', included: true },
            { text: 'Admin connection assist', included: false },
        ],
    },
    {
        id: 'diamond',
        name: 'Diamond',
        price: 'KES 2,500',
        period: '/month',
        color: '#7c3aed',
        icon: Zap,
        popular: false,
        features: [
            { text: 'Everything in Gold', included: true },
            { text: 'Admin connection assist', included: true },
            { text: 'Direct admin hotline', included: true },
            { text: 'Profile boost (daily)', included: true },
            { text: 'Featured member badge', included: true },
            { text: 'Read receipts', included: true },
            { text: 'Priority matching', included: true },
            { text: 'VIP events access', included: true },
        ],
    },
];

export default function SubscribePage() {
    const router = useRouter();
    const { user, subscription, updateSubscription } = useAuth();
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [showPayment, setShowPayment] = useState(false);
    const currentPlan = subscription?.plan || 'free';

    const handleSelectPlan = (plan) => {
        if (plan.id === currentPlan || plan.id === 'free') return;
        setSelectedPlan(plan);
        setShowPayment(true);
    };

    const TELEGRAM_URL = 'https://t.me/GSADMINMARYGAGENCY';
    const PHONE = '+254 700 000 000';

    return (
        <div className="px-4 pt-4 pb-24">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <button onClick={() => router.back()} className="p-1">
                    <ArrowLeft size={22} className="text-text-primary" />
                </button>
                <div className="flex items-center gap-2">
                    <Crown size={22} className="text-gold" />
                    <h1 className="text-xl font-bold text-text-primary">Membership Plans</h1>
                </div>
            </div>

            <p className="text-sm text-text-secondary mb-6">
                Upgrade your experience. Get unlimited likes, see who liked you, direct messaging, and more.
            </p>

            {/* Plan Cards */}
            <div className="space-y-4 mb-8">
                {PLANS.map((plan, idx) => {
                    const Icon = plan.icon;
                    const isCurrent = plan.id === currentPlan;
                    return (
                        <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.08 }}
                            onClick={() => handleSelectPlan(plan)}
                            className={`rounded-3xl p-5 relative transition-all cursor-pointer ${isCurrent ? 'ring-2 ring-primary' : ''} ${plan.popular ? 'ring-2 ring-gold' : ''}`}
                            style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}
                        >
                            {plan.popular && (
                                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white bg-gold rounded-full px-3 py-0.5 shadow">
                                    MOST POPULAR
                                </span>
                            )}
                            {isCurrent && (
                                <span className="absolute -top-2.5 right-4 text-[10px] font-bold text-white bg-primary rounded-full px-3 py-0.5 shadow">
                                    CURRENT
                                </span>
                            )}

                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${plan.color}15` }}>
                                        <Icon size={22} style={{ color: plan.color }} />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-text-primary">{plan.name}</h3>
                                        <p className="text-xs text-text-muted">{plan.period}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-xl font-extrabold text-text-primary">{plan.price}</span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                {plan.features.map((f, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${f.included ? 'bg-success/15' : 'bg-surface'}`}>
                                            {f.included ? <Check size={10} className="text-success" /> : <span className="text-[8px] text-text-muted">—</span>}
                                        </div>
                                        <span className={`text-xs ${f.included ? 'text-text-primary' : 'text-text-muted line-through'}`}>{f.text}</span>
                                    </div>
                                ))}
                            </div>

                            {!isCurrent && plan.id !== 'free' && (
                                <button
                                    className="w-full mt-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98]"
                                    style={{ background: plan.color }}
                                >
                                    Choose {plan.name}
                                </button>
                            )}
                        </motion.div>
                    );
                })}
            </div>

            {/* Payment Info */}
            <div className="rounded-3xl p-5 space-y-4" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <Shield size={14} className="text-success" /> How to Subscribe
                </h3>
                <div className="space-y-3 text-sm text-text-secondary">
                    <div className="flex gap-3">
                        <span className="w-6 h-6 rounded-full gradient-primary text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                        <p>Choose your preferred plan above.</p>
                    </div>
                    <div className="flex gap-3">
                        <span className="w-6 h-6 rounded-full gradient-primary text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                        <p>Send payment via <strong>M-Pesa</strong> to Admin Mary G.</p>
                    </div>
                    <div className="flex gap-3">
                        <span className="w-6 h-6 rounded-full gradient-primary text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
                        <p>Send payment confirmation on <strong>Telegram</strong>.</p>
                    </div>
                    <div className="flex gap-3">
                        <span className="w-6 h-6 rounded-full gradient-primary text-white text-xs font-bold flex items-center justify-center shrink-0">4</span>
                        <p>Your plan will be activated within <strong>1 hour</strong>.</p>
                    </div>
                </div>

                {/* Contact Admin */}
                <div className="pt-3 space-y-2">
                    <a
                        href={TELEGRAM_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-white text-sm transition-all active:scale-[0.98]"
                        style={{ background: '#0088cc' }}
                    >
                        <Send size={16} />
                        Contact Admin on Telegram
                    </a>
                    <a
                        href={`tel:${PHONE}`}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-text-primary text-sm transition-all active:scale-[0.98]"
                        style={{ background: 'var(--color-surface)' }}
                    >
                        <Phone size={16} />
                        Call Admin
                    </a>
                </div>
            </div>

            {/* Bottom info */}
            <p className="text-center text-[10px] text-text-muted mt-6 px-4">
                Payments are processed manually by Admin Mary G via M-Pesa.<br />
                Genuine Sugar Mummies Kenya · genuinesugarmummies.co.ke
            </p>

            {/* Payment confirmation modal */}
            {showPayment && selectedPlan && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setShowPayment(false)}>
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-lg rounded-t-3xl p-6 space-y-4"
                        style={{ background: 'var(--color-bg-card)' }}
                    >
                        <div className="w-10 h-1 rounded-full bg-surface mx-auto" />
                        <h3 className="text-lg font-bold text-text-primary text-center">
                            Subscribe to {selectedPlan.name}
                        </h3>
                        <p className="text-center text-2xl font-extrabold" style={{ color: selectedPlan.color }}>
                            {selectedPlan.price}<span className="text-sm font-normal text-text-muted">{selectedPlan.period}</span>
                        </p>
                        <div className="text-sm text-text-secondary space-y-2 text-center">
                            <p>Send <strong>{selectedPlan.price}</strong> via M-Pesa to Admin Mary G.</p>
                            <p>Then message your confirmation on Telegram with your <strong>email</strong> and <strong>M-Pesa confirmation code</strong>.</p>
                        </div>
                        <a
                            href={`${TELEGRAM_URL}?text=Hi%20Mary,%20I%20want%20to%20subscribe%20to%20${selectedPlan.name}%20plan%20(${encodeURIComponent(selectedPlan.price)}).%20My%20email:%20${encodeURIComponent(user?.email || '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white text-sm transition-all active:scale-[0.98]"
                            style={{ background: '#0088cc' }}
                        >
                            <Send size={16} />
                            Message Admin on Telegram
                        </a>
                        <button onClick={() => setShowPayment(false)} className="w-full py-3 rounded-2xl text-sm font-medium text-text-muted">
                            Cancel
                        </button>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
