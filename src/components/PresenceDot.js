'use client';

import { presenceFor, isListingOnly } from '@/lib/presence';
import { GsTrust } from '@/components/icons';

/**
 * A status dot, or nothing.
 *
 * Renders null for a profile with no account behind it and for a real account we
 * have no timestamp for — see lib/presence. Callers must not wrap this in their
 * own coloured span, or the dot comes back for exactly the profiles it was
 * removed from.
 */
export default function PresenceDot({ member, size = 10, ring = true, className = '' }) {
    const presence = presenceFor(member);
    if (!presence) return null;
    return (
        <span
            className={`inline-block shrink-0 rounded-full ${presence.tone} ${ring ? `ring-2 ${presence.ring}` : ''} ${className}`}
            style={{ width: size, height: size }}
            title={presence.label}
            aria-label={presence.label}
        />
    );
}

/**
 * The text beside the dot.
 *
 * A listing gets a quiet, factual line with the shield mark rather than a status
 * it cannot have. This is deliberately understated — it belongs in the flow of
 * the card, with the red messaging block doing the explaining.
 */
export function PresenceLine({ member, className = '' }) {
    if (isListingOnly(member)) {
        return (
            <span className={`inline-flex min-w-0 items-center gap-1 ${className}`}>
                <GsTrust size={12} className="shrink-0 text-primary" />
                <span className="truncate">{member?.facilitationLabel || 'Introduced by our team'}</span>
            </span>
        );
    }
    const presence = presenceFor(member);
    if (!presence) return null;
    return (
        <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
            <PresenceDot member={member} size={9} ring={false} />
            <span className="truncate">{presence.label}</span>
        </span>
    );
}
