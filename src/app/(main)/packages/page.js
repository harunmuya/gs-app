'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
    BadgeCheck,
    Building2,
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
    RadioTower,
    Rocket,
    Send,
    Shield,
    Sparkles,
    Smartphone,
    Users,
    Wallet,
    Zap,
    Loader2,
    GsShilling,
    GsTrust,
    GsPremium,
    GsBoost,
    GsVerifiedHeart,
    GsTier,
    GsPhoneUnlock,
} from '@/components/icons';
import { useAuth } from '@/contexts/AuthContext';
import { SUPPORT } from '@/lib/support';

const TIERS = [
    {
        id: 'basic',
        name: 'Basic Membership',
        shortName: 'Basic',
        price: 650,
        label: 'One-Time Payment',
        icon: GsVerifiedHeart,
        color: 'primary',
        summary: 'Perfect for new members who want to explore the platform, start conversations, and make one meaningful connection.',
        bestFor: 'Best for new members who want an affordable and safe way to experience the platform.',
        sectionTitle: "What's included",
        highlights: [
            { icon: MessageCircle, title: 'Unlimited', caption: 'Messages' },
            { icon: Gift, title: '50 credits', caption: 'GS Credits' },
            { icon: Users, title: 'Direct choice', caption: 'One connection' },
        ],
        services: [
            'Lifetime Basic Membership after activation',
            'Unlimited messages every day',
            '20 likes every day',
            '5 super likes every day',
            '30 swipes every day',
            '30 profile views every day',
            'Photo sharing in chat',
            'Gift sending access for Tier 1 virtual gifts using GS Credits',
            '50 free GS Credits added after account activation',
            'One direct choice connection with a Sugar Mummy, Sugar Daddy, Toyboy, or Mistress, subject to availability and mutual interest',
            'Profile browsing access based on your preferences and location',
            'Secure messaging inside the app',
            'Account support for activation and account assistance',
        ],
        why: [
            'Activate your Basic package',
            'Browse profiles and start messaging',
            'Send gifts and interact with members',
            'Choose one preferred member for a direct connection request',
            'Continue enjoying daily messaging and interaction benefits',
        ],
    },
    {
        id: 'silver',
        name: 'Silver Premium',
        shortName: 'Silver',
        price: 1200,
        label: 'Recommended Plan',
        icon: GsPremium,
        color: 'secondary',
        summary: 'The perfect package for members who want unlimited communication, premium visibility, and direct access to more connections.',
        bestFor: 'Best for serious members who want premium features, unlimited communication, and maximum opportunities.',
        sectionTitle: 'What you get',
        highlights: [
            { icon: GsPhoneUnlock, title: 'Phone reveal', caption: 'Approved profiles' },
            { icon: PhoneCall, title: 'Calls', caption: 'Voice and video' },
            { icon: Eye, title: 'Insights', caption: 'Likes and views' },
        ],
        services: [
            'Lifetime Silver Premium Membership after activation',
            'Unlimited messaging without daily message limits',
            'Phone number reveal for approved Sugar Mummies, Sugar Daddies, Toyboys, and Mistresses',
            'Direct contact by call, SMS, WhatsApp, and private communication without admin intervention',
            'Unlimited likes, follows, swipes, and profile views',
            '50 super likes every day',
            'Unlimited voice calls and video calls',
            'Unlimited voice notes, images, GIFs, and media sharing',
            'Unlimited gift sending across all available tiers',
            'Go Live streaming access',
            '24 hour stories with viewer and like counts',
            'Profile boost for stronger placement across the app',
            'Featured placement on Top Members and premium sections',
            'Community access for member updates and live activity',
            'Area matches and nearby member discovery',
            'Silver Premium badge on your profile',
            'See who liked you, viewed your profile, followed you, and members you follow',
            'Priority support from Admin Mary G',
            'Early access to new features and updates',
            'Advanced profile filters and match recommendations',
        ],
        why: [
            'Unlimited messaging and interactions',
            'Voice and video calls included',
            'Go Live and story features',
            'Direct phone number access',
            'Featured placement and profile boosts',
            'Priority support and premium visibility',
        ],
        recommended: true,
    },
    {
        id: 'gold',
        name: 'Gold Elite',
        shortName: 'Gold',
        price: 3550,
        label: 'Highest Access',
        icon: GsTier,
        color: 'gold',
        summary: 'The ultimate membership for unlimited access, international visibility, VIP placement, and the highest level of support.',
        bestFor: 'Best for members who want the complete VIP experience, worldwide visibility, and maximum opportunities.',
        sectionTitle: 'What you get',
        highlights: [
            { icon: GsTier, title: 'Top access', caption: 'Elite account' },
            { icon: GsBoost, title: 'Priority boost', caption: 'More visibility' },
            { icon: Gift, title: 'All gifts', caption: 'No limits' },
        ],
        services: [
            'Lifetime Gold Elite Membership',
            'Everything included in Silver Premium with no limits',
            'Unlimited messages, likes, super likes, follows, swipes, and profile views',
            'Unlimited voice notes, image sharing, GIF sharing, voice calls, and video calls',
            'Unlimited phone number reveal for approved profiles across all categories',
            'Direct contact through calls, SMS, WhatsApp, and private communication without admin intervention',
            'International profile access locally and worldwide',
            'Unlimited Go Live streaming and unlimited live room access',
            'Stronger live recommendations and visibility',
            '24 hour stories with viewer and like counts',
            'Maximum profile boost and highest ranking across the platform',
            'Always featured in Top Members, Featured Members, Discovery Pages, Search Results, Community Recommendations, and Nearby Matches',
            'Prominent VIP and VVIP status',
            'Gold Elite badge displayed on your profile',
            'Unlimited gift access across every available gift tier, including exclusive Tier 4 gifts',
            'Priority community placement in Area Matches, Nearby Members, Communities, and location recommendations',
            'Complete activity insights for likes, views, follows, following, and profile engagement',
            'Unlimited saved favourites and bookmarks',
            'Priority match recommendations',
            'Priority advertising and promotion across the app, website, featured sections, promotional banners, and community highlights',
            'Guided connection support for serious introductions',
            'Fastest Admin Mary G support, early access to VIP updates, premium verification, and account assistance',
        ],
        why: [
            'Everything is unlimited',
            'International profile access',
            'VIP and VVIP status',
            'Unlimited live streaming and communication',
            'Always featured and promoted',
            'Fastest support and guided connections',
        ],
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

/**
 * What this member actually has, from the server.
 *
 * The tier cards further down are marketing copy maintained by hand. This panel
 * reads the entitlement layer directly, so it cannot claim something the server
 * will then refuse. That gap is worth closing on a paid product: a member who is
 * told they have a feature and is then blocked has been misled, whether or not
 * anyone intended it.
 *
 * It also states plainly when a paid package is not currently in effect —
 * awaiting approval, locked, or expired — rather than silently serving free-tier
 * limits to someone who has paid.
 */
function CurrentPlanPanel({ current, usage }) {
    const TIER_NAMES = { free: 'Free', basic: 'Basic', silver: 'Silver', gold: 'Gold' };
    const FEATURES = [
        ['phoneReveal', 'Phone reveal'],
        ['calls', 'Voice & video calls'],
        ['gifts', 'Send gifts'],
        ['images', 'Send images'],
        ['voiceNotes', 'Voice notes'],
        ['live', 'Go live'],
        ['whoLiked', 'See who liked you'],
        ['whoViewed', 'See who viewed you'],
        ['nearby', 'Nearby discovery'],
        ['priorityVisibility', 'Priority visibility'],
        ['international', 'International access'],
    ];
    const QUOTAS = [
        ['messages', 'Messages'],
        ['likes', 'Likes'],
        ['superlikes', 'Super likes'],
        ['swipes', 'Swipes'],
        ['views', 'Profile views'],
        ['gifts', 'Gifts'],
    ];

    const reasonText = {
        expired: 'Your package has expired, so free limits apply until you renew.',
        locked: 'Your package is locked by an administrator. Contact support.',
        awaiting_approval: 'Your payment is awaiting admin approval. Free limits apply until it clears.',
        inactive: 'Your package is not active, so free limits apply.',
    }[current.reason];

    const active = Object.entries(current.entitlements).filter(([, on]) => on);
    const tracked = QUOTAS.filter(([key]) => usage[key]);

    return (
        <section className="rounded-2xl p-4 space-y-4" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)', boxShadow: 'var(--elevation-2)' }}>
            <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="type-micro text-text-muted">Your plan</p>
                    <h2 className="type-title text-text-primary">{TIER_NAMES[current.effectiveTierId] || 'Free'}</h2>
                </div>
                <span
                    className="shrink-0 rounded-full px-3 py-1 type-micro"
                    style={current.downgraded
                        ? { background: 'color-mix(in srgb, var(--color-danger-text) 10%, transparent)', color: 'var(--color-danger-text)' }
                        : { background: 'color-mix(in srgb, var(--color-success-text) 12%, transparent)', color: 'var(--color-success-text)' }}
                >
                    {current.downgraded ? 'Not active' : 'Active'}
                </span>
            </header>

            {current.downgraded && reasonText && (
                <p className="rounded-xl px-3 py-2.5 type-caption" style={{ background: 'color-mix(in srgb, var(--color-danger-text) 10%, transparent)', color: 'var(--color-danger-text)' }}>
                    You bought <strong>{TIER_NAMES[current.requestedTierId] || current.requestedTierId}</strong>. {reasonText}
                </p>
            )}

            {tracked.length > 0 && (
                <div className="space-y-2">
                    <p className="type-micro text-text-muted">Today’s usage</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {tracked.map(([key, label]) => {
                            const q = usage[key];
                            if (q.unlimited) {
                                return (
                                    <div key={key} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: 'var(--color-surface)' }}>
                                        <span className="type-caption text-text-secondary">{label}</span>
                                        <span className="type-caption font-semibold text-success">Unlimited</span>
                                    </div>
                                );
                            }
                            const pct = q.limit ? Math.min(100, Math.round((q.used / q.limit) * 100)) : 0;
                            const spent = q.remaining === 0;
                            return (
                                <div key={key} className="rounded-xl px-3 py-2 space-y-1.5" style={{ background: 'var(--color-surface)' }}>
                                    <div className="flex items-center justify-between">
                                        <span className="type-caption text-text-secondary">{label}</span>
                                        <span className={`type-caption font-semibold ${spent ? 'text-danger' : 'text-text-primary'}`}>
                                            {q.used} / {q.limit}
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(20,16,26,0.08)' }}>
                                        <div
                                            className="h-full rounded-full"
                                            style={{ width: `${pct}%`, background: spent ? 'var(--color-danger)' : 'var(--color-primary)' }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <p className="type-caption text-text-muted">Counters reset at midnight.</p>
                </div>
            )}

            <div className="space-y-2 border-t pt-3" style={{ borderColor: 'rgba(20,16,26,0.08)' }}>
                <p className="type-micro text-text-muted">Included right now</p>
                {active.length === 0 ? (
                    <p className="type-caption text-text-muted">
                        Your current plan includes browsing and limited messaging. Upgrade below to unlock more.
                    </p>
                ) : (
                    <div className="flex flex-wrap gap-1.5">
                        {FEATURES.filter(([key]) => current.entitlements[key]).map(([key, label]) => (
                            <span key={key} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 type-micro text-primary" style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}>
                                <Check size={11} /> {label}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {current.expiresAt && !current.downgraded && (
                <p className="type-caption text-text-muted">
                    Renews or expires on {new Date(current.expiresAt).toLocaleDateString()}.
                </p>
            )}
        </section>
    );
}

export default function PackagesPage() {
    const { user, addMessage } = useAuth();
    const searchParams = useSearchParams();
    const welcome = searchParams.get('welcome') === '1';
    const queryTier = searchParams.get('tier');
    const [selectedTier, setSelectedTier] = useState(['basic', 'silver', 'gold'].includes(queryTier) ? queryTier : 'silver');
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);
    const [packages, setPackages] = useState(TIERS);
    // What the server actually grants this member, and what they have used today.
    // The tier cards below are marketing copy; this is the enforced truth.
    const [current, setCurrent] = useState(null);
    const [usage, setUsage] = useState({});
    const activeTier = currentTier(user);
    const selected = useMemo(() => packages.find((item) => item.id === selectedTier) || packages[0] || TIERS[0], [packages, selectedTier]);
    const unlocked = Boolean(!user?.package_locked && ['basic', 'silver', 'gold', 'diamond'].includes(activeTier));

    useEffect(() => {
        if (['basic', 'silver', 'gold'].includes(queryTier)) setSelectedTier(queryTier);
    }, [queryTier]);

    useEffect(() => {
        let alive = true;
        fetch('/api/packages')
            .then((res) => res.json())
            .then((data) => {
                if (!alive) return;
                if (data.current) setCurrent(data.current);
                if (data.usage) setUsage(data.usage);
                if (!Array.isArray(data.packages)) return;

                /**
                 * Quantitative claims are generated from the tier row, never
                 * hand-written.
                 *
                 * The static copy had drifted badly: Basic advertised "Unlimited
                 * messages every day" while the enforced limit was 30, and quoted
                 * 30 swipes and 30 profile views where the real figures were 40.
                 * Someone paying KSh 650 for unlimited messaging was cut off at 30.
                 *
                 * Prose claims stay in `services`; anything with a number in it now
                 * comes from the same row the server enforces, so the two cannot
                 * disagree again.
                 */
                const limitText = (value) => (!value || Number(value) <= 0 ? 'Unlimited' : String(Number(value)));

                setPackages(TIERS.map((fallback) => {
                    const remote = data.packages.find((pkg) => pkg.id === fallback.id);
                    if (!remote) return fallback;

                    const quantified = [
                        `${limitText(remote.daily_message_limit)} messages every day`,
                        `${limitText(remote.daily_like_limit)} likes every day`,
                        `${limitText(remote.daily_super_like_limit)} super likes every day`,
                        `${limitText(remote.daily_swipe_limit)} swipes every day`,
                        `${limitText(remote.daily_profile_view_limit)} profile views every day`,
                        `${limitText(remote.daily_gift_limit)} gifts every day`,
                    ];

                    return {
                        ...fallback,
                        price: Number(remote.price_ksh ?? fallback.price),
                        label: remote.badge_label || fallback.label,
                        highlights: [
                            { icon: MessageCircle, title: limitText(remote.daily_message_limit), caption: 'Messages / day' },
                            ...fallback.highlights.slice(1),
                        ],
                        // Drop the hand-written numeric lines; the generated ones replace them.
                        services: [...quantified, ...fallback.services.filter((line) => !/every day/i.test(line))],
                    };
                }));
            })
            .catch(() => {});
        return () => { alive = false; };
    }, []);


    return (
        <div className="px-4 py-4 pb-28 space-y-5">
            {/* Uses the palette token rather than hardcoded hexes. This was a
                four-stop plum-to-marigold ramp written in literal old-palette
                values, so it survived the palette change untouched and kept the
                previous look on the most commercially important screen. */}
            <section className="rounded-[28px] overflow-hidden text-white shadow-lg" style={{ background: 'var(--gradient-primary)' }}>
                <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase text-white/75">GS Premium Access</p>
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

            {current && <CurrentPlanPanel current={current} usage={usage} />}

            {welcome && (
                <section className="rounded-2xl p-4 space-y-2" style={{ background: 'rgba(15,118,110,0.08)', border: '1px solid rgba(15,118,110,0.18)' }}>
                    <div className="flex items-start gap-3">
                        <BadgeCheck size={22} className="text-primary shrink-0" />
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-text-primary">Your free account is open</p>
                            <p className="mt-1 text-xs leading-relaxed text-text-secondary">Basic unlocks unlimited messages, photo chat, 50 GS Credits, and one direct connection request after admin approval. Silver unlocks phone reveal, calls, GIFs, voice notes, activity insights, and stronger visibility.</p>
                        </div>
                    </div>
                </section>
            )}

            <section className="rounded-2xl p-4 flex items-center gap-3" style={{ background: unlocked ? 'rgba(5,150,105,0.08)' : 'rgba(245,158,11,0.08)', border: unlocked ? '1px solid rgba(5,150,105,0.18)' : '1px solid rgba(245,158,11,0.2)' }}>
                {unlocked ? <BadgeCheck size={24} className="text-success" /> : <Lock size={24} className="text-gold" />}
                <div className="min-w-0">
                    <p className="text-sm font-bold text-text-primary">Current account: {activeTier.toUpperCase()}</p>
                    <p className="text-xs text-text-muted">{unlocked ? 'Your package is active.' : 'Paid features open when your package is active.'}</p>
                </div>
            </section>

            <section className="grid gap-4">
                {packages.map((tier) => <TierCard key={tier.id} tier={tier} active={selectedTier === tier.id} onSelect={() => setSelectedTier(tier.id)} selected={selected} />)}
            </section>

            <PaymentCheckout tier={selected} defaultPhone={user?.phone_number || user?.phone || ''} />

            <section className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                <h2 className="text-sm font-bold text-text-primary flex items-center gap-2"><Headphones size={16} className="text-secondary" /> Direct support</h2>
                <p className="text-sm text-text-secondary leading-relaxed">Need help choosing a package or confirming payment? Contact Admin Mary G and include your account email plus payment transaction ID.</p>
                <a href={SUPPORT.telegram.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 text-sm font-bold text-white gradient-primary"><HelpCircle size={16} /> Open Telegram Support</a>
            </section>
        </div>
    );
}

/**
 * Where members actually pay.
 *
 * Deliberately a manual flow: pay to the published till or number, then submit
 * the code from the SMS receipt for confirmation. Automatic STK Push would need a
 * Safaricom Daraja account, and it would not cover Airtel Money at all.
 *
 * What makes this different from the box it replaces — which accepted any text,
 * kept no record, and left the member with no idea whether anything had happened:
 *
 *  - The exact amount and the exact number are shown, both copyable, so there is
 *    no transcription error and no "admin confirms current number" vagueness.
 *  - The code is checked against the provider's real format before submission.
 *  - Codes are unique platform-wide, so a forwarded receipt cannot be reused.
 *  - The submission becomes a visible record with a status the member can watch.
 *  - The wait is stated up front instead of being discovered.
 */

/** Where a member asks for the current payment destination. */
// Re-exported so existing imports keep working. The value lives in SupportContact.
export const ADMIN_TELEGRAM = SUPPORT.telegram.url;

/*
  Payment destinations.

  There is deliberately no fallback number here. This previously read
  `process.env.NEXT_PUBLIC_MPESA_TILL || '5204588'`, with a matching Airtel
  default — figures carried over from older code and never verified. An unset
  environment variable therefore did not produce an error; it produced a
  confident, copyable till number on a payment screen. A member following those
  instructions sends real money to whoever owns that till, and neither they nor
  the admin panel would have any way to trace it.

  So the destination is either configured, or the screen says it is not and sends
  the member to Admin Mary G for the current number. A missing configuration
  should stop a payment, not invent one.
*/
const PROVIDERS = [
    {
        id: 'mpesa',
        name: 'M-Pesa',
        network: 'Safaricom',
        accent: '#00A551',
        payTo: 'Till number',
        target: process.env.NEXT_PUBLIC_MPESA_TILL || '',
        codeHint: '10 characters, e.g. SFJ4K2L9MN',
        steps: [
            'Ask Admin Mary G for the current till number',
            'Open M-Pesa on your phone',
            'Choose Lipa na M-Pesa, then Buy Goods and Services',
            'Enter the till number, the exact amount and your PIN',
            'Copy the code from the confirmation SMS',
        ],
    },
    {
        id: 'airtel',
        name: 'Airtel Money',
        network: 'Airtel',
        accent: '#E4002B',
        payTo: 'Pay to number',
        target: process.env.NEXT_PUBLIC_AIRTEL_NUMBER || '',
        codeHint: 'The reference on your Airtel SMS',
        steps: [
            'Ask Admin Mary G for the current Airtel number',
            'Dial *334# or open the Airtel Money app',
            'Choose Send Money',
            'Enter the number, the exact amount and your PIN',
            'Copy the reference from the confirmation SMS',
        ],
    },
];

/**
 * Shown in place of the number when no destination is configured.
 *
 * Blocking is the point: a member cannot pay correctly without a destination, so
 * offering the transaction-code box underneath would only collect codes for
 * payments sent somewhere arbitrary.
 */
function RequestPaymentNumber({ provider }) {
    return (
        <div className="border-danger-soft tint-danger space-y-3 rounded-xl p-4">
            <p className="flex items-center gap-2 type-body-strong text-danger">
                <Shield size={15} /> Ask for the {provider.name} number first
            </p>
            <p className="type-caption text-text-secondary">
                We do not publish a {provider.payTo.toLowerCase()} in the app. Message Admin Mary G for the
                current one, confirm the amount, then pay and enter your code below.
                <strong className="text-text-primary"> Never send money to a number given by anyone else.</strong>
            </p>
            <a
                href={ADMIN_TELEGRAM}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl type-body-strong text-white gradient-primary"
            >
                <Headphones size={16} /> Get the number from Admin Mary G
            </a>
        </div>
    );
}

function CopyRow({ label, value, accent }) {
    const [copied, setCopied] = useState(false);
    async function copy() {
        try {
            await navigator.clipboard.writeText(String(value));
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch { /* clipboard blocked; the value is visible regardless */ }
    }
    return (
        <div className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-3" style={{ background: 'var(--color-surface)' }}>
            <div className="min-w-0">
                <p className="type-micro text-text-muted">{label}</p>
                <p className="type-title text-text-primary" style={{ letterSpacing: '0.01em' }}>{value}</p>
            </div>
            <button
                type="button"
                onClick={copy}
                className="shrink-0 rounded-lg px-3 py-2 type-caption font-semibold"
                style={{ background: copied ? 'color-mix(in srgb, var(--color-success-text) 12%, transparent)' : 'color-mix(in srgb, var(--color-primary) 10%, transparent)', color: copied ? 'var(--color-success)' : accent }}
            >
                {copied ? 'Copied' : 'Copy'}
            </button>
        </div>
    );
}

function StatusPill({ status }) {
    const map = {
        pending: { label: 'Being reviewed', bg: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', fg: 'var(--color-primary)' },
        approved: { label: 'Approved', bg: 'color-mix(in srgb, var(--color-success-text) 12%, transparent)', fg: 'var(--color-success-text)' },
        rejected: { label: 'Rejected', bg: 'color-mix(in srgb, var(--color-danger-text) 10%, transparent)', fg: 'var(--color-danger-text)' },
    };
    const s = map[status] || map.pending;
    return <span className="shrink-0 rounded-full px-2.5 py-1 type-micro" style={{ background: s.bg, color: s.fg }}>{s.label}</span>;
}

function PaymentCheckout({ tier, defaultPhone }) {
    const [providerId, setProviderId] = useState('mpesa');
    const [code, setCode] = useState('');
    const [phone, setPhone] = useState(defaultPhone || '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);
    const [history, setHistory] = useState([]);

    const provider = PROVIDERS.find((p) => p.id === providerId) || PROVIDERS[0];
    const amount = Number(tier.price || 0);

    const loadHistory = async () => {
        try {
            const res = await fetch('/api/payments', { cache: 'no-store' });
            const data = await res.json().catch(() => ({}));
            if (Array.isArray(data.requests)) setHistory(data.requests);
        } catch { /* history is supplementary */ }
    };

    useEffect(() => { loadHistory(); }, []);

    // Validate before submitting so a typo costs a second, not a review cycle.
    const cleaned = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const codeValid = providerId === 'mpesa' ? /^[A-Z0-9]{10}$/.test(cleaned) : /^[A-Z0-9]{8,20}$/.test(cleaned);

    async function submit() {
        setBusy(true);
        setError('');
        try {
            const res = await fetch('/api/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Tier only — the price is the server's to decide.
                body: JSON.stringify({ tierId: tier.id, provider: providerId, transactionCode: cleaned, phone }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { setError(data.error || 'Could not submit your payment.'); return; }
            setDone(true);
            setCode('');
            loadHistory();
        } catch {
            setError('Network problem. Please try again.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="space-y-4">
            <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)', boxShadow: 'var(--elevation-2)' }}>
                <header className="flex items-start justify-between gap-3 p-5 pb-4">
                    <div>
                        <p className="type-micro text-text-muted">Step 1 — pay</p>
                        <h2 className="type-title text-text-primary">Complete your payment</h2>
                    </div>
                    <span className="shrink-0 rounded-full px-3 py-1.5 type-body-strong text-white gradient-primary">
                        KSh {amount.toLocaleString()}
                    </span>
                </header>

                {/* Provider choice, in each network's own colour so it is recognisable at a glance */}
                <div className="grid grid-cols-2 gap-2 px-5">
                    {PROVIDERS.map((p) => {
                        const active = p.id === providerId;
                        return (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => { setProviderId(p.id); setError(''); }}
                                className="flex min-h-[60px] items-center gap-2 rounded-xl px-2.5 py-2.5 text-left transition-colors"
                                style={{
                                    background: active ? `${p.accent}12` : 'var(--color-surface)',
                                    border: `1.5px solid ${active ? p.accent : 'transparent'}`,
                                }}
                            >
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg type-caption font-bold text-white" style={{ background: p.accent }}>
                                    {p.name.charAt(0)}
                                </span>
                                {/* No truncation: "Airtel Money" clipped to "Airtel M…" at 375px,
                                    which reads as a broken layout on the payment screen of all
                                    places. It wraps to two tight lines instead. */}
                                <span className="min-w-0 flex-1">
                                    <span className="block type-caption font-semibold leading-tight text-text-primary">{p.name}</span>
                                    <span className="block type-micro leading-tight text-text-muted">{p.network}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="space-y-3 p-5">
                    {/* A configured destination is shown and copyable. An unset one
                        sends the member to Admin Mary G rather than to a number
                        this screen made up. */}
                    {provider.target
                        ? <CopyRow label={provider.payTo} value={provider.target} accent={provider.accent} />
                        : <RequestPaymentNumber provider={provider} />}
                    <CopyRow label="Exact amount" value={`KSh ${amount.toLocaleString()}`} accent={provider.accent} />

                    <ol className="space-y-2 pt-1">
                        {provider.steps.map((step, i) => (
                            <li key={step} className="flex gap-2.5 type-caption text-text-secondary">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full type-micro text-white" style={{ background: provider.accent }}>{i + 1}</span>
                                <span className="pt-0.5">{step}</span>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>

            <div className="rounded-3xl p-5 space-y-4" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)', boxShadow: 'var(--elevation-2)' }}>
                <header>
                    <p className="type-micro text-text-muted">Step 2 — confirm</p>
                    <h2 className="type-title text-text-primary">Submit your code</h2>
                </header>

                {done ? (
                    <div className="space-y-3">
                        <div className="flex items-start gap-2.5 rounded-xl px-3.5 py-3" style={{ background: 'color-mix(in srgb, var(--color-success-text) 10%, transparent)' }}>
                            <Check size={16} className="mt-0.5 shrink-0 text-success" />
                            <p className="type-caption text-success">
                                Payment submitted. We verify against the {provider.name} statement and activate your package —
                                usually within a few hours. You will get a notification either way.
                            </p>
                        </div>
                        <button type="button" onClick={() => setDone(false)} className="min-h-[44px] w-full type-caption font-semibold text-primary">
                            Submit another code
                        </button>
                    </div>
                ) : (
                    <>
                        <label className="block space-y-1.5">
                            <span className="type-caption font-semibold text-text-secondary">Transaction code</span>
                            <input
                                value={code}
                                onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }}
                                placeholder={providerId === 'mpesa' ? 'SFJ4K2L9MN' : 'Airtel reference'}
                                autoCapitalize="characters"
                                autoComplete="off"
                                spellCheck={false}
                                className="w-full rounded-xl px-3.5 py-3 type-body font-semibold tracking-[0.12em] text-text-primary focus:outline-none"
                                style={{ background: 'var(--color-bg-input)', border: `1px solid ${code && !codeValid ? 'var(--color-danger)' : 'rgba(20,16,26,0.10)'}` }}
                            />
                            <span className="block type-caption text-text-muted">{provider.codeHint}</span>
                        </label>

                        <label className="block space-y-1.5">
                            <span className="type-caption font-semibold text-text-secondary">Number you paid from</span>
                            <input
                                type="tel" inputMode="tel" autoComplete="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="07XX XXX XXX"
                                className="w-full rounded-xl px-3.5 py-3 type-body text-text-primary focus:outline-none"
                                style={{ background: 'var(--color-bg-input)', border: '1px solid rgba(20,16,26,0.10)' }}
                            />
                        </label>

                        {error && (
                            <p role="alert" className="rounded-xl px-3.5 py-3 type-caption" style={{ background: 'color-mix(in srgb, var(--color-danger-text) 10%, transparent)', color: 'var(--color-danger-text)' }}>
                                {error}
                            </p>
                        )}

                        <button
                            onClick={submit}
                            disabled={busy || !codeValid}
                            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl type-body-strong text-white gradient-primary disabled:opacity-50"
                        >
                            {busy ? <Loader2 size={18} className="animate-spin" /> : <GsShilling size={18} />}
                            {busy ? 'Submitting…' : `Confirm KSh ${amount.toLocaleString()} payment`}
                        </button>
                    </>
                )}

                <div className="flex items-start gap-2 border-t pt-3 type-caption text-text-muted" style={{ borderColor: 'rgba(20,16,26,0.08)' }}>
                    <GsTrust size={14} className="mt-0.5 shrink-0" />
                    <span>Each transaction code can only be used once. We never ask for your M-Pesa or Airtel PIN — nobody from GS will ever request it.</span>
                </div>
            </div>

            {history.length > 0 && (
                <div className="rounded-3xl p-5 space-y-3" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                    <h2 className="type-heading text-text-primary">Your payments</h2>
                    <div className="space-y-2">
                        {history.map((r) => (
                            <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-3" style={{ background: 'var(--color-surface)' }}>
                                <div className="min-w-0">
                                    <p className="type-body-strong text-text-primary truncate">
                                        {String(r.tier_id).toUpperCase()} · KSh {Number(r.amount).toLocaleString()}
                                    </p>
                                    <p className="type-caption text-text-muted truncate">
                                        {r.transaction_code} · {new Date(r.created_at).toLocaleDateString()}
                                    </p>
                                    {r.status === 'rejected' && r.rejection_reason && (
                                        <p className="type-caption text-danger">{r.rejection_reason}</p>
                                    )}
                                </div>
                                <StatusPill status={r.status} />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}

function HeroMetric({ icon: Icon, label }) {
    return (
        <div className="rounded-2xl bg-white/14 p-3 text-center">
            <Icon size={18} className="mx-auto" />
            <p className="mt-1 text-xs font-semibold">{label}</p>
        </div>
    );
}


function TierCard({ tier, active, onSelect, selected }) {
    const Icon = tier.icon;
    const tone = toneClasses(tier.color, active);
    return (
        <div className="rounded-[28px] overflow-hidden transition-all" style={{ background: 'var(--color-bg-card)', border: tone.border, boxShadow: active ? tone.glow : 'var(--shadow-card)' }}>
            <button onClick={onSelect} className="relative w-full p-4 text-left transition-all active:scale-[0.99]">
                {tier.recommended && <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-semibold text-white gradient-primary"><BadgeCheck size={11} /> Best Value</span>}
                <div className="flex items-start gap-3 pr-24">
                    <div className={`h-13 w-13 rounded-2xl flex items-center justify-center ${tone.icon}`}><Icon size={24} /></div>
                    <div className="min-w-0">
                        <p className={`mb-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${tone.pill}`}>{tier.label}</p>
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
                                <p className="text-[11px] font-semibold text-text-primary">{item.title}</p>
                                <p className="text-[9px] font-bold text-text-muted">{item.caption}</p>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-success"><Check size={14} /> Lifetime access</span>
                    <span className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${active ? 'gradient-primary text-white' : 'text-text-secondary'}`} style={!active ? { background: 'var(--color-surface)' } : {}}>{active ? '✓ Selected' : 'Choose'}</span>
                </div>
            </button>
            {active && selected && selected.id === tier.id && (
                <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px dashed rgba(155,44,94,0.15)' }}>
                    <p className="pt-3 text-sm leading-relaxed text-text-secondary">{selected.summary}</p>
                    <div className="rounded-2xl p-3" style={{ background: 'var(--color-surface)' }}>
                        <p className="mb-2 text-xs font-semibold text-text-primary">{selected.sectionTitle || 'What you get'}</p>
                        <ol className="space-y-1.5">
                            {selected.services.map((service, index) => (
                                <li key={service} className="flex gap-2.5 items-start rounded-xl p-2" style={{ background: 'rgba(255,255,255,0.7)' }}>
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full gradient-primary text-[10px] font-semibold text-white">{index + 1}</span>
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
