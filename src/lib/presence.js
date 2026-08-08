/**
 * Presence, reported honestly.
 *
 * Four copies of this logic existed — discover, members, the member profile and
 * the chat header — each with slightly different thresholds, and every one of
 * them drew a status dot on profiles that have no account behind them. A seeded
 * or WordPress listing has no `last_seen_at`, so it fell through to the grey
 * "offline" dot: a presence claim about someone who cannot have presence, sitting
 * in exactly the spot where a real member's status appears.
 *
 * A dot on a listing is a small lie that costs the whole page its credibility,
 * because it is the one element a member reads as live. So there is no dot: this
 * returns `null` and the component renders nothing.
 *
 * `activity` is what a listing gets instead — a factual statement about the
 * profile ("Introduced by our team") rather than an invented status.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** True when there is no account that could ever be signed in. */
export function isListingOnly(member) {
    if (!member) return false;
    const id = String(member.id || '');
    return Boolean(
        member.requiresFacilitation
        || member.isSeedProfile
        || member.is_seed_profile
        || member.source === 'wp'
        || member.source === 'seed'
        || id.startsWith('wp-')
        || id.startsWith('seed-local-')
    );
}

/**
 * Presence for a profile, or null when there is nothing truthful to show.
 *
 * @returns {{tone: string, ring: string, label: string, live: boolean} | null}
 */
export function presenceFor(member) {
    if (!member || isListingOnly(member)) return null;

    const seenRaw = member.lastSeenAt || member.last_seen_at || member.lastSeen || member.last_seen;
    const seenMs = seenRaw ? Date.parse(seenRaw) : NaN;

    // No timestamp on a real account means we genuinely do not know. Saying
    // "offline" would be a guess presented as fact.
    if (!Number.isFinite(seenMs)) return null;

    const ago = Date.now() - seenMs;
    if (ago < 3 * MINUTE) return { tone: 'bg-success', ring: 'ring-success/30', label: 'Online now', live: true };
    if (ago < HOUR) return { tone: 'bg-success/70', ring: 'ring-success/20', label: `Active ${Math.max(1, Math.floor(ago / MINUTE))} min ago`, live: false };
    if (ago < DAY) return { tone: 'bg-amber-400', ring: 'ring-amber-200', label: `Active ${Math.floor(ago / HOUR)} hr ago`, live: false };
    if (ago < 7 * DAY) return { tone: 'bg-gray-300', ring: 'ring-gray-200', label: `Active ${Math.floor(ago / DAY)} d ago`, live: false };
    return { tone: 'bg-gray-300', ring: 'ring-gray-200', label: 'Active a while ago', live: false };
}

/**
 * The line shown where a status would otherwise go.
 *
 * For a listing this describes what the profile is, which is both true and more
 * useful than a status — it tells the member why they cannot message it.
 */
export function presenceLabel(member) {
    if (isListingOnly(member)) return member?.facilitationLabel || 'Introduced by our team';
    return presenceFor(member)?.label || '';
}
