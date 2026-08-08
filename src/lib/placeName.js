import { labelFromCoordinates } from '@/lib/geo';

/**
 * Resolve coordinates to a human place name, accurately.
 *
 * Every client feature that names a location should use this rather than calling
 * `labelFromCoordinates` directly. That function is only a 31-entry offline table
 * — useful as a last resort, but it will confidently return a town a hundred
 * kilometres away for anyone who does not live near one of its entries.
 *
 * This asks the server to reverse geocode properly and only falls back to the
 * table when that fails. Returns '' when nothing can be resolved, so callers can
 * leave the field for the member to type instead of filling in a guess.
 *
 * Client-side only: it fetches a relative URL.
 */
export async function resolvePlaceName(latitude, longitude, { signal } = {}) {
    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return '';

    try {
        const res = await fetch(
            `/api/location?action=reverse&lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`,
            { signal }
        );
        if (res.ok) {
            const data = await res.json().catch(() => null);
            if (data?.label) return data.label;
        }
    } catch {
        // Network or abort — fall through to the offline table.
    }

    return labelFromCoordinates(latitude, longitude) || '';
}

/**
 * Standard options for a positional fix used to name somewhere.
 *
 * High accuracy matters here: a coarse network fix can be kilometres out, which
 * defeats the point of naming the member's area. `maximumAge: 0` avoids reusing a
 * stale fix from a previous location.
 */
export const PRECISE_POSITION_OPTIONS = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0,
};
