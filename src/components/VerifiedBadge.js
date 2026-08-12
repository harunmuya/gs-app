/**
 * The verification mark.
 *
 * This was a copy of the Twitter check, scalloped edge and all, filled with
 * their exact #1D9BF0. Two things wrong with that. It is visibly another
 * platform's mark, which makes a badge meant to signal "we checked this person"
 * read as borrowed decoration instead. And the hardcoded blue ignores the theme
 * entirely, so on the dark surface it sat as a bright spot with nothing else on
 * the screen near it.
 *
 * The replacement is a plain shield with a check, in the app's own success
 * colour, which is the shape people already read as "checked" outside of social
 * media. It carries a title so hovering explains it, and a real accessible name
 * rather than the word "Verified" floating with no context.
 *
 * Only 2 of 149 accounts carry this. It has to mean something, so it is never
 * shown for anything other than a genuine verification_status of 'verified'.
 */
export default function VerifiedBadge({ size = 18, className = '', verified = true, title = 'Identity checked by our team' }) {
    if (!verified) return null;

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Verified member"
            className={`inline-block shrink-0 ${className}`}
        >
            <title>{title}</title>
            <path
                d="M12 2.2 4.6 5v6.3c0 4.5 3 8.7 7.4 10.5 4.4-1.8 7.4-6 7.4-10.5V5L12 2.2Z"
                fill="var(--color-success)"
            />
            <path
                d="M8.4 12.1 11 14.7l4.7-5.2"
                stroke="#FFFFFF"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
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
