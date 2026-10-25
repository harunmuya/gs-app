import { Verified } from '@/components/icons';

/**
 * The verification mark.
 *
 * It began as a copy of the Twitter check, scalloped edge and their exact
 * #1D9BF0, which made a badge meaning "we checked this person" read as another
 * platform's furniture and ignored the theme besides. It was then drawn by hand
 * as a shield: honest, but a one-off shape maintained here while every other
 * icon in the app came from the Material set.
 *
 * It is Google's own `verified` glyph now, from the same pinned Material
 * Symbols release and the same self-hosted sprite as the rest
 * (scripts/icons/fetch-material.mjs), so it is a real icon rather than an
 * approximation of one, and it inherits the theme through currentColor.
 *
 * Only 2 of 149 accounts carry this. It has to mean something, so it is never
 * shown for anything other than a genuine verification_status of 'verified'.
 */
export default function VerifiedBadge({ size = 18, className = '', verified = true, title = 'Identity checked by our team' }) {
    if (!verified) return null;

    return (
        // `title` is what Icon turns into the accessible name, so the badge is
        // announced as what it means rather than as the word "verified".
        <Verified
            size={size}
            title={title}
            className={`inline-block shrink-0 text-success ${className}`}
        />
    );
}

/**
 * The package mark, for a member's own account only.
 *
 * There is no honest version of this on somebody else's card. `subscription_tier`
 * records the package a member asked for, not the one an admin approved, and it
 * does not know about a lock or an expiry, so reading it straight would show a
 * Gold badge to someone whose payment was never confirmed. Entitlements are the
 * only source that accounts for approval, and those are only resolved for the
 * signed in member.
 *
 * So this takes the tier from useEntitlements at the call site and renders
 * nothing for free or basic. A badge everybody has is not a badge.
 */
const TIER_STYLE = {
    silver: { label: 'Silver', className: 'badge-silver' },
    gold: { label: 'Gold', className: 'badge-gold' },
};

export function TierBadge({ tier, className = '' }) {
    const style = TIER_STYLE[String(tier || '').toLowerCase()];
    if (!style) return null;

    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 type-micro font-bold uppercase tracking-wide ${style.className} ${className}`}
            title={`${style.label} package, active on this account`}
        >
            {style.label}
        </span>
    );
}
