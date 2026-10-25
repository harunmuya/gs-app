import { coordinatesForProfile, distanceKm } from '@/lib/geo';

/**
 * Discovery relevance scoring.
 *
 * Replaces the previous ordering, which was a hash of the row id XORed with a
 * rotating seed — i.e. a deterministic shuffle with no relationship to the viewer,
 * the profile, or any activity. That is why discovery "felt random": it was.
 *
 * Every profile is scored against the viewer on six signals. The weights below are
 * the whole model — there is no hidden term — so they can be tuned from one place
 * and the result explained to a user.
 *
 * Scores are only meaningful relative to each other within one request.
 */

export const WEIGHTS = {
    preference: 30,   // does this profile match what the viewer is looking for
    proximity: 20,    // how close they are
    activity: 18,     // genuinely recent activity
    quality: 24,      // photo, bio, verification, completeness
    freshness: 6,     // new members stay discoverable
    jitter: 2,        // deterministic tie-break so results are not frozen
};

/**
 * A profile with no photograph is close to unusable in a card deck. Weighting
 * alone did not express this strongly enough — a photoless but nearby, active,
 * well-matched profile still scored in the low 80s, which would have been shown
 * to the member as an "84% match". This scales the whole relevance score instead.
 */
const NO_PHOTO_PENALTY = 0.4;

/**
 * Distance at which proximity decays to zero.
 *
 * Tuned for East African geography rather than a generic city radius: Nairobi to
 * Mombasa is ~440 km and Nairobi to Kisumu ~260 km, both ordinary domestic
 * distances here. An earlier 400 km ceiling scored Mombasa at exactly zero, which
 * would have effectively excluded Kenya's second city from every Nairobi feed.
 */
const MAX_DISTANCE_KM = 1200;

/**
 * Reciprocal pairings: who a given profile type is shown. One each, and they
 * are symmetric — if A is dealt B then B is dealt A.
 *
 * The "secondary" target that used to sit beside each of these paired a label
 * with its own side of the arrangement (a sugar mummy with a sugar daddy, a
 * toyboy with a mistress), so it scored a profile that could not be a match at
 * better than half of a real one.
 */
export const PREFERENCE_RULES = {
    mistress: 'sugar_daddy',
    sugar_mummy: 'toyboy',
    toyboy: 'sugar_mummy',
    sugar_daddy: 'mistress',
};

function clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
}

/** Stable 0..1 value from a string. Used only as a tie-break. */
function jitterFor(id, seed) {
    const text = `${id || ''}:${seed || ''}`;
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
        hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
    }
    return (Math.abs(hash) % 1000) / 1000;
}

/**
 * 1.0 for the viewer's match, 0 for anyone else.
 *
 * This used to return 0.15 rather than 0, which made orientation a weight
 * instead of a rule: preference is 30 of the ~92 points on offer, so a nearby,
 * active, verified profile of the wrong orientation scored around 66 and beat
 * a distant, quiet one of the right orientation at around 46. The deck filters
 * on orientation now, but a scorer that can still rank a non-match above a
 * match is a trap for the next caller, so it scores zero here too.
 */
export function preferenceScore(profileLabel, viewerLabel) {
    if (!viewerLabel) return 0.5;
    const target = PREFERENCE_RULES[viewerLabel];
    if (!target) return 0.5;
    return profileLabel === target ? 1 : 0;
}

/**
 * Distance decay. Full marks inside 10 km, tapering to zero at 400 km.
 * Unknown location scores 0.35 rather than 0 — missing data should not be
 * treated as "far away", which would bury every profile without coordinates.
 */
export function proximityScore(viewer, profile) {
    const viewerCoords = coordinatesForProfile(viewer);
    const profileCoords = coordinatesForProfile(profile);
    if (!viewerCoords || !profileCoords) return 0.35;
    const km = distanceKm(viewerCoords, profileCoords);
    if (km === null) return 0.35;
    if (km <= 10) return 1;
    if (km >= MAX_DISTANCE_KM) return 0;
    return clamp01(1 - Math.log10(km / 10) / Math.log10(MAX_DISTANCE_KM / 10));
}

/** True when the profile has no usable image at all. */
export function hasUsablePhoto(profile) {
    const photos = Array.isArray(profile.photos) ? profile.photos.filter(Boolean) : [];
    return Boolean(profile.avatar_url) || photos.length > 0;
}

/**
 * Recency of genuine activity.
 *
 * Reads `last_seen_at` only. Before Wave 1 this column was overwritten for seed
 * profiles by a generator that recomputed it from Date.now() on every request, so
 * every seed profile scored maximum here. Now an unattended profile decays, which
 * is the intended behaviour.
 */
export function activityScore(profile) {
    const raw = profile.last_seen_at || profile.last_seen;
    const seen = raw ? new Date(raw).getTime() : 0;
    if (!seen || Number.isNaN(seen)) return 0;
    const hours = (Date.now() - seen) / (60 * 60 * 1000);
    if (hours < 0) return 0;
    if (hours <= 1) return 1;
    if (hours <= 24) return 0.8;
    if (hours <= 72) return 0.55;
    if (hours <= 24 * 7) return 0.35;
    if (hours <= 24 * 30) return 0.15;
    return 0.05;
}

/** Profile completeness and trust signals. */
export function qualityScore(profile) {
    const photos = Array.isArray(profile.photos) ? profile.photos.filter(Boolean) : [];
    const hasAvatar = Boolean(profile.avatar_url) || photos.length > 0;
    const bio = String(profile.description || profile.bio || '').trim();
    const verified = Boolean(profile.verified || profile.verification_status === 'verified');

    let score = 0;
    if (hasAvatar) score += 0.35;
    if (photos.length >= 3) score += 0.15;
    if (bio.length >= 40) score += 0.2;
    else if (bio.length >= 10) score += 0.1;
    if (verified) score += 0.2;
    if (profile.age) score += 0.05;
    if (profile.location || profile.city) score += 0.05;
    return clamp01(score);
}

/** Keeps genuinely new members visible for their first month. */
export function freshnessScore(profile) {
    const created = profile.created_at ? new Date(profile.created_at).getTime() : 0;
    if (!created || Number.isNaN(created)) return 0;
    const hours = (Date.now() - created) / (60 * 60 * 1000);
    if (hours <= 24) return 1;
    if (hours <= 72) return 0.7;
    if (hours <= 24 * 7) return 0.45;
    if (hours <= 24 * 30) return 0.2;
    return 0;
}

/**
 * Paid visibility, applied as a bonus on top of relevance rather than as an
 * override. A boosted profile is lifted, but a boosted profile that is inactive,
 * distant, and photoless will still not beat a strong organic match.
 */
export function premiumBonus(profile, { boostActive = false } = {}) {
    let bonus = 0;
    if (boostActive) bonus += 18 + Math.min(Number(profile.boost_score || 0), 10);
    const tier = String(profile.subscription_tier || '').toLowerCase();
    if (tier === 'gold') bonus += 6;
    else if (tier === 'silver') bonus += 4;
    else if (tier === 'basic') bonus += 2;
    return bonus;
}

/**
 * Score one profile for one viewer.
 * `boostActive` is injected so the caller owns the definition of an active boost.
 */
export function scoreMember(profile, {
    viewer = null,
    viewerLabel = '',
    profileLabel = '',
    seed = '',
    boostActive = false,
} = {}) {
    const penalty = hasUsablePhoto(profile) ? 1 : NO_PHOTO_PENALTY;
    const parts = {
        preference: preferenceScore(profileLabel, viewerLabel) * WEIGHTS.preference * penalty,
        proximity: proximityScore(viewer, profile) * WEIGHTS.proximity * penalty,
        activity: activityScore(profile) * WEIGHTS.activity * penalty,
        quality: qualityScore(profile) * WEIGHTS.quality * penalty,
        freshness: freshnessScore(profile) * WEIGHTS.freshness * penalty,
        jitter: jitterFor(profile.id, seed) * WEIGHTS.jitter,
    };
    const base = Object.values(parts).reduce((total, value) => total + value, 0);
    return { score: base + premiumBonus(profile, { boostActive }), parts };
}

/**
 * A 0-100 figure suitable for display, derived from the same signals but excluding
 * jitter and paid placement — a member should never see a "match %" that was
 * inflated by someone paying for a boost.
 */
export function displayMatchPercent(parts) {
    const relevanceMax = WEIGHTS.preference + WEIGHTS.proximity + WEIGHTS.activity + WEIGHTS.quality;
    const earned = parts.preference + parts.proximity + parts.activity + parts.quality;
    return Math.round(clamp01(earned / relevanceMax) * 100);
}

/**
 * Interleave real accounts with seeded profiles.
 *
 * Both lists arrive already ranked. Real registered members lead, because they are
 * the ones a user can actually interact with; seeded profiles fill in at a fixed
 * cadence so the feed stays populated without burying real people.
 */
export function interleave(real, seeded, pattern = ['real', 'real', 'seed']) {
    const output = [];
    let realIndex = 0;
    let seedIndex = 0;
    let cycle = 0;
    while (realIndex < real.length || seedIndex < seeded.length) {
        const slot = pattern[cycle % pattern.length];
        cycle += 1;
        if (slot === 'real' && realIndex < real.length) output.push(real[realIndex++]);
        else if (slot === 'seed' && seedIndex < seeded.length) output.push(seeded[seedIndex++]);
        else if (realIndex < real.length) output.push(real[realIndex++]);
        else if (seedIndex < seeded.length) output.push(seeded[seedIndex++]);
        else break;
    }
    return output;
}
