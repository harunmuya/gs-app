'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    BadgeCheck,
    Check,
    Crown,
    Eye,
    Gem,
    Gift,
    Headphones,
    HelpCircle,
    Lock,
    MessageCircle,
    Phone,
    PhoneCall,
    Radio,
    Rocket,
    Send,
    Shield,
    Sparkles,
    Users,
    Wallet,
    Zap,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const TIERS = [
    {
        id: 'basic',
        name: 'Basic Access',
        shortName: 'Basic',
        price: 650,
        label: 'Start messaging',
        icon: Shield,
        color: 'primary',
        summary: 'A clean starter package for real conversations, profile browsing, gifts, and one chosen direct connection request.',
        bestFor: 'Best for new members who want to start safely.',
        highlights: [
            { icon: MessageCircle, title: '30 messages', caption: 'Every day' },
            { icon: Gift, title: 'Gift access', caption: 'Tier 1 gifts' },
            { icon: Users, title: 'One connection', caption: 'Your choice' },
        ],
        services: [
            'Lifetime Basic account access after admin approval',
            '30 messages every day',
            '10 likes, 5 super likes, 30 swipes, and 30 profile views every day',
            'Image sharing in chat',
            'Send Tier 1 gifts using approved credits',
            '50 GS credits added after activation',
            'One direct connection request with the person you choose',
            'Saved finance request so admin can verify your payment',
        ],
    },
    {
        id: 'silver',
        name: 'Silver Plus',
        shortName: 'Silver',
        price: 1200,
        label: 'Recommended',
        icon: Gem,
        color: 'secondary',
        summary: 'The main package for serious members. It unlocks phone reveal, voice notes, calls, stories, boosts, and activity insight.',
        bestFor: 'Best for members who want fast replies and more profile attention.',
        highlights: [
            { icon: Phone, title: 'Phone reveal', caption: 'Approved profiles' },
            { icon: PhoneCall, title: 'Calls', caption: 'Voice and video' },
            { icon: Eye, title: 'Activity view', caption: 'Likes and views' },
        ],
        services: [
            'Lifetime Silver account access after admin approval',
            'Unlimited messaging after approval',
            'Phone number reveal for approved profiles',
            '50 likes and 100 super likes every day',
            'Unlimited swipes and profile views',
            'Voice calls and video calls',
            'Voice notes, images, GIFs, and media in chat',
            'Go Live streaming access',
            '24 hour stories with viewer and like counts',
            'Profile boost for stronger placement across the app',
            'See who liked, viewed, followed, and who you follow',
            'Send gifts up to Tier 3',
            '200 GS credits added after activation',
            'Priority support from Admin Mary G',
        ],
        recommended: true,
    },
    {
        id: 'gold',
        name: 'Gold Elite',
        shortName: 'Gold',
        price: 3550,
        label: 'Highest access',
        icon: Crown,
        color: 'gold',
        summary: 'The strongest package for international visibility, premium gifts, live activity, and guided connection support.',
        bestFor: 'Best for members who want maximum reach and premium support.',
        highlights: [
            { icon: Crown, title: 'Top access', caption: 'Elite account' },
            { icon: Rocket, title: 'Priority boost', caption: 'More visibility' },
            { icon: Gift, title: 'All gifts', caption: 'Tier 4 included' },
        ],
        services: [
            'Lifetime Gold Elite account access',
            'International profile access',
            'Unlimited messaging, likes, super likes, swipes, and profile views',
            'Unlimited voice and video call access',
            'Voice notes, images, GIFs, and all media in chat',
            'Go Live with stronger reach',
            '24 hour stories with viewer and like counts',
            'Profile boost and priority placement',
            'Send every gift tier including Tier 4 exclusives',
            '500 GS credits added after activation',
            'Gold badge style on your profile',
            'Fastest Admin Mary G support',
            'Guided connection help for serious members',
        ],
    },
];

const PAYMENT_METHODS = [
    {
        id: 'airtel',
        name: 'Airtel Money',
        title: 'Pay with Airtel Money',
        number: '0738871048',
        steps: ['Open Airtel Money', 'Choose Send Money', 'Enter 0738871048', 'Send the exact package amount', 'Paste the transaction ID below'],
    },
    {
        id: 'mpesa',
        name: 'M Pesa',
        title: 'Ask admin for M Pesa',
        number: 'Admin confirms current number',
        steps: ['Tap Ask Admin', 'Request the current M Pesa number', 'Send the exact package amount', 'Paste the transaction ID below'],
    },
    {
        id: 'tkash',
        name: 'T Kash',
        title: 'Pay from T Kash',
        number: '0738871048',
        steps: ['Choose Send Money', 'Select Airtel Money if asked', 'Enter 0738871048', 'Send the exact package amount', 'Paste the transaction ID below'],
    },
    {
        id: 'other',
        name: 'Other Network',
        title: 'Pay from another network',
        number: '0738871048',
        steps: ['Choose Send Money', 'Select Airtel Money or other network transfer', 'Enter 0738871048', 'Send the exact package amount', 'Paste the transaction ID below'],
    },
];

function currentTier(user) {
    return String(user?.subscription_tier || user?.subscriptionTier || 'free').toLowerCase();
}

function toneClasses(color, active = false) {
    if (color === 'gold') {
        return {
            icon: 'text-gold bg-amber-100',
            pill: 'bg-amber-100 text-gold',
            border: active ? '2px solid rgba(201,130,9,0.65)' : '1px solid rgba(201,130,9,0.22)',
            glow: '0 20px 50px rgba(201,130,9,0.16)',
        };
    }
    if (color === 'secondary') {
        return {
            icon: 'text-secondary bg-secondary/10',
            pill: 'bg-secondary/10 text-secondary',
            border: active ? '2px solid var(--color-secondary)' : '1px solid rgba(240,68,114,0.18)',
            glow: '0 20px 50px rgba(240,68,114,0.16)',
        };
    }
    return {
        icon: 'text-primary bg-primary/10',
        pill: 'bg-primary/10 text-primary',
        border: active ? '2px solid var(--color-primary)' : 'var(--card-border)',
        glow: '0 20px 50px rgba(14,143,131,0.16)',
    };
}

export default function PackagesPage() {
    const { user, addMessage } = useAuth();
    const [selectedTier, setSelectedTier] = useState('silver');
    const [methodId, setMethodId] = useState('airtel');
    const [paymentRef, setPaymentRef] = useState('');
    const [note, setNote] = useState('');
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);
    const [packages, setPackages] = useState(TIERS);
    const activeTier = currentTier(user);
    const selected = useMemo(() => packages.find((item) => item.id === selectedTier) || packages[0] || TIERS[0], [packages, selectedTier]);
    const method = useMemo(() => PAYMENT_METHODS.find((item) => item.id === methodId) || PAYMENT_METHODS[0], [methodId]);
    const unlocked = Boolean(!user?.package_locked && ['basic', 'silver', 'gold', 'diamond'].includes(activeTier));

    useEffect(() => {
        let alive = true;
        fetch('/api/packages')
            .then((res) => res.json())
            .then((data) => {
                if (!alive || !Array.isArray(data.packages)) return;
                setPackages(TIERS.map((fallback) => {
                    const remote = data.packages.find((pkg) => pkg.id === fallback.id);
                    return {
                        ...fallback,
                        price: Number(remote?.price_ksh ?? fallback.price),
                        badgeLabel: remote?.badge_label || fallback.label,
                    };
                }));
            })
            .catch(() => {});
        return () => { alive = false; };
    }, []);

    async function requestPackage() {
        if (!user?.email) {
            window.location.href = '/auth/login';
            return;
        }
        const ref = paymentRef.trim();
        if (ref.length < 3) {
            setStatus('Paste your payment transaction ID before sending the request.');
            return;
        }
        setLoading(true);
        setStatus('');
        try {
            const res = await fetch('/api/members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'request_package',
                    memberId: user.id,
                    email: user.email,
                    display_name: user.display_name,
                    tier: selected.id,
                    payment_reference: ref,
                    note: `${method.name}: ${note}`.slice(0, 500),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Package request failed.');
            setStatus(`${selected.name} request sent. Admin will verify payment ${ref} and unlock your account.`);
            addMessage?.({
                type: 'package_request',
                sender: 'GS Finance',
                title: `${selected.name} request received`,
                body: `Your KSh ${selected.price.toLocaleString()} request is waiting for admin approval. Payment ID: ${ref}`,
            });
        } catch (error) {
            setStatus(error.message || 'Package request failed.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="px-4 py-4 pb-28 space-y-5">
            <section className="rounded-[28px] overflow-hidden text-white shadow-lg" style={{ background: 'linear-gradient(135deg,#6B1D42 0%,#9B2C5E 30%,#D4A03C 70%,#B8860B 100%)' }}>
                <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-black uppercase text-white/75">GS Premium Access</p>
                            <h1 className="mt-1 text-3xl font-black leading-tight">Upgrade your account</h1>
                            <p className="mt-2 text-sm leading-relaxed text-white/85">Choose a lifetime package, send payment, paste the transaction ID, and admin verifies your unlock.</p>
                        </div>
                        <div className="h-12 w-12 rounded-2xl bg-white/18 flex items-center justify-center shrink-0"><Gem size={24} /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <HeroMetric icon={MessageCircle} label="Chat" />
                        <HeroMetric icon={PhoneCall} label="Calls" />
                        <HeroMetric icon={Rocket} label="Boost" />
                    </div>
                </div>
            </section>

            <section className="rounded-2xl p-4 flex items-center gap-3" style={{ background: unlocked ? 'rgba(5,150,105,0.08)' : 'rgba(245,158,11,0.08)', border: unlocked ? '1px solid rgba(5,150,105,0.18)' : '1px solid rgba(245,158,11,0.2)' }}>
                {unlocked ? <BadgeCheck size={24} className="text-success" /> : <Lock size={24} className="text-gold" />}
                <div className="min-w-0">
                    <p className="text-sm font-black text-text-primary">Current account: {activeTier.toUpperCase()}</p>
                    <p className="text-xs text-text-muted">{unlocked ? 'Your package is active.' : 'Paid features open when your package is active.'}</p>
                </div>
            </section>

            <section className="grid gap-4">
                {packages.map((tier) => <TierCard key={tier.id} tier={tier} active={selectedTier === tier.id} onSelect={() => setSelectedTier(tier.id)} selected={selected} />)}
            </section>

            <section className="rounded-[28px] p-4 space-y-4" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)', boxShadow: 'var(--shadow-card)' }}>
                <div className="flex items-center gap-2">
                    <Wallet size={18} className="text-primary" />
                    <h2 className="text-lg font-black text-text-primary">Payment</h2>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map((item) => (
                        <button key={item.id} onClick={() => setMethodId(item.id)} className={`min-h-11 rounded-2xl px-3 text-sm font-black transition-all active:scale-[0.97] ${methodId === item.id ? 'gradient-primary text-white' : 'text-text-secondary'}`} style={methodId !== item.id ? { background: 'var(--color-surface)' } : {}}>
                            {item.name}
                        </button>
                    ))}
                </div>
                <div className="rounded-2xl p-3 space-y-3" style={{ background: 'rgba(155,44,94,0.06)', border: '1px solid rgba(155,44,94,0.12)' }}>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-black text-text-primary">{method.title}</p>
                            <p className="text-xs font-bold text-primary">Number: {method.number}</p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-primary">KSh {selected.price.toLocaleString()}</span>
                    </div>
                    <ol className="space-y-2">
                        {method.steps.map((step, index) => (
                            <li key={step} className="flex gap-2 text-sm font-bold text-text-secondary">
                                <span className="text-primary">{index + 1}.</span>
                                <span>{step}</span>
                            </li>
                        ))}
                    </ol>
                    <a href="https://t.me/GSADMINMARYGAGENCY" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-3 text-xs font-black text-primary"><HelpCircle size={14} /> Ask Admin Mary G</a>
                </div>
                <input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value.toUpperCase())} placeholder="Payment transaction ID" className="w-full rounded-2xl py-3 px-3 text-base font-bold text-text-primary" style={{ background: 'var(--color-surface)', border: 'var(--card-border)' }} />
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note for finance" rows={3} className="w-full rounded-2xl py-3 px-3 text-sm resize-none" style={{ background: 'var(--color-surface)', border: 'var(--card-border)' }} />
                <button disabled={loading} onClick={requestPackage} className="w-full min-h-13 rounded-2xl text-base font-black text-white gradient-primary flex items-center justify-center gap-2 disabled:opacity-60">
                    {loading ? <MessageCircle size={19} /> : <Send size={19} />} Submit for Approval
                </button>
                {status && <p className="rounded-2xl bg-primary/10 p-3 text-sm font-bold text-primary">{status}</p>}
            </section>

            <section className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                <h2 className="text-sm font-black text-text-primary flex items-center gap-2"><Headphones size={16} className="text-secondary" /> Direct support</h2>
                <p className="text-sm text-text-secondary leading-relaxed">Need help choosing a package or confirming payment? Contact Admin Mary G and include your account email plus payment transaction ID.</p>
                <a href="https://t.me/GSADMINMARYGAGENCY" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 text-sm font-black text-white gradient-primary"><HelpCircle size={16} /> Open Telegram Support</a>
            </section>
        </div>
    );
}

function HeroMetric({ icon: Icon, label }) {
    return (
        <div className="rounded-2xl bg-white/14 p-3 text-center">
            <Icon size={18} className="mx-auto" />
            <p className="mt-1 text-xs font-black">{label}</p>
        </div>
    );
}

function TierCard({ tier, active, onSelect, selected }) {
    const Icon = tier.icon;
    const tone = toneClasses(tier.color, active);
    return (
        <div className="rounded-[28px] overflow-hidden transition-all" style={{ background: 'var(--color-bg-card)', border: tone.border, boxShadow: active ? tone.glow : 'var(--shadow-card)' }}>
            <button onClick={onSelect} className="relative w-full p-4 text-left transition-all active:scale-[0.99]">
                {tier.recommended && <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black text-white gradient-primary"><BadgeCheck size={11} /> Best Value</span>}
                <div className="flex items-start gap-3 pr-24">
                    <div className={`h-13 w-13 rounded-2xl flex items-center justify-center ${tone.icon}`}><Icon size={24} /></div>
                    <div className="min-w-0">
                        <p className={`mb-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${tone.pill}`}>{tier.label}</p>
                        <h2 className="text-2xl font-black text-text-primary">{tier.name}</h2>
                        <p className="text-lg font-black text-primary">KSh {tier.price.toLocaleString()}</p>
                        <p className="mt-1 text-xs font-bold text-text-muted">{tier.bestFor}</p>
                    </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                    {tier.highlights.map((item) => {
                        const FeatureIcon = item.icon;
                        return (
                            <div key={item.title} className="rounded-2xl p-2 text-center" style={{ background: 'var(--color-surface)' }}>
                                <FeatureIcon size={17} className={`mx-auto mb-1 ${tier.color === 'gold' ? 'text-gold' : tier.color === 'secondary' ? 'text-secondary' : 'text-primary'}`} />
                                <p className="text-[11px] font-black text-text-primary">{item.title}</p>
                                <p className="text-[9px] font-bold text-text-muted">{item.caption}</p>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-black text-success"><Check size={14} /> Lifetime access</span>
                    <span className={`rounded-full px-3 py-1.5 text-xs font-black transition-all ${active ? 'gradient-primary text-white' : 'text-text-secondary'}`} style={!active ? { background: 'var(--color-surface)' } : {}}>{active ? '✓ Selected' : 'Choose'}</span>
                </div>
            </button>
            {active && selected && selected.id === tier.id && (
                <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px dashed rgba(155,44,94,0.15)' }}>
                    <p className="pt-3 text-sm leading-relaxed text-text-secondary">{selected.summary}</p>
                    <div className="rounded-2xl p-3" style={{ background: 'var(--color-surface)' }}>
                        <p className="mb-2 text-xs font-black text-text-primary">What you get</p>
                        <ol className="space-y-1.5">
                            {selected.services.map((service, index) => (
                                <li key={service} className="flex gap-2.5 items-start rounded-xl p-2" style={{ background: 'rgba(255,255,255,0.7)' }}>
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full gradient-primary text-[10px] font-black text-white">{index + 1}</span>
                                    <span className="text-[13px] font-bold leading-snug text-text-secondary">{service}</span>
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>
            )}
        </div>
    );
}
