/**
 * Profile provenance.
 *
 * Three kinds of profile appear in discovery and they are not interchangeable:
 *
 *   real       — a registered account belonging to a person who signed up here.
 *                Full interaction: direct messaging, calls, gifts.
 *   seed       — a curated profile seeded into `users` (is_seed_profile = true).
 *                Nobody is signed in behind it, so a message would never be read.
 *   wordpress  — imported from the legacy WordPress site via lib/wordpress.js.
 *                Same situation: no account, no inbox.
 *
 * Seed and WordPress profiles are surfaced with an explicit "Facilitation Required"
 * label and direct messaging is withheld, because presenting them as reachable
 * would be a false claim to a paying member. The label is deliberately produced
 * server-side: the client must not be able to decide a profile is real.
 */

export const PROFILE_KIND = {
    REAL: 'real',
    SEED: 'seed',
    WORDPRESS: 'wordpress',
};

/*
  What a member sees on one of these profiles.

  This label used to read "Facilitation Required" and the notice began "Direct
  messaging is not available". Both are accurate and both were the wrong choice.
  "Required" is the language of a form you have to fill in before you are
  allowed to proceed, and leading with what is not available tells somebody
  browsing a dating app that the profile in front of them is a dead end.

  Neither is what is happening. Our team arranged the introduction and our team
  carries the first message, which is a service rather than a restriction. Said
  that way it is the same fact and it reads as somebody helping.

  The wording stays honest about the route. It does not claim the person is
  online, and it does not promise a reply.
*/
export const FACILITATION_LABEL = 'Introduced by our team';

export const FACILITATION_NOTICE =
    'Messages to this member go through our team rather than straight to an inbox. '
    + 'Ask for an introduction and we pass yours on, then come back to you either way.';

/** Determine provenance from a `users` row. */
export function profileKindFor(member = {}) {
    if (member.profile_kind) return member.profile_kind;
    if (member.is_wordpress_profile || member.source === 'wordpress') return PROFILE_KIND.WORDPRESS;
    if (member.is_seed_profile) return PROFILE_KIND.SEED;
    return PROFILE_KIND.REAL;
}

/** Only real registered accounts can receive direct messages. */
export function canDirectMessage(kind) {
    return kind === PROFILE_KIND.REAL;
}

export function requiresFacilitation(kind) {
    return kind === PROFILE_KIND.SEED || kind === PROFILE_KIND.WORDPRESS;
}

/**
 * The presentation fields every profile payload carries, whatever its source.
 * Spread this into API responses so discovery, profile pages, and messaging all
 * read the same flags rather than each re-deriving provenance.
 */
export function facilitationFields(kind) {
    const needsFacilitation = requiresFacilitation(kind);
    return {
        profileKind: kind,
        isSeedProfile: kind === PROFILE_KIND.SEED,
        isWordpressProfile: kind === PROFILE_KIND.WORDPRESS,
        requiresFacilitation: needsFacilitation,
        facilitationLabel: needsFacilitation ? FACILITATION_LABEL : '',
        facilitationNotice: needsFacilitation ? FACILITATION_NOTICE : '',
        canDirectMessage: canDirectMessage(kind),
    };
}
