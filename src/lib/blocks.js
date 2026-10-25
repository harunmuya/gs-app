/**
 * Who a member must not see, and who must not see them.
 *
 * A block is stored once, by the person who made it, but it has to be read in
 * both directions. If it were applied only the way it was written, blocking
 * somebody would hide them from your deck while leaving you in theirs — which
 * is the opposite of what a member asking to be left alone is asking for.
 *
 * Every listing that can show one member to another goes through this.
 */

/**
 * The ids this member must not be shown, and must not be shown to.
 *
 * Returns a Set so callers can filter in one pass. An anonymous viewer has no
 * blocks, which is why the empty Set is returned rather than null: a caller
 * that forgets to check would otherwise show everything to everyone.
 */
export async function blockedIdsFor(supabase, userId) {
    const hidden = new Set();
    if (!supabase || !userId) return hidden;

    const [outgoing, incoming] = await Promise.all([
        supabase.from('user_blocks').select('blocked_id').eq('blocker_id', userId),
        supabase.from('user_blocks').select('blocker_id').eq('blocked_id', userId),
    ]);

    /*
      A failed lookup returns no rows, which would silently unblock everyone.
      Treat it as an error the caller can act on rather than as "nobody is
      blocked", since the safe direction here is to hide more, not less.
    */
    if (outgoing.error || incoming.error) {
        const error = outgoing.error || incoming.error;
        // The table is absent until the migration has been applied. That is a
        // deployment state, not a failure, and must not take listings down.
        const missingTable = /relation .*user_blocks.* does not exist|could not find the table/i
            .test(String(error.message || ''));
        if (!missingTable) throw new Error(`Could not read blocks: ${error.message}`);
        return hidden;
    }

    for (const row of outgoing.data || []) hidden.add(row.blocked_id);
    for (const row of incoming.data || []) hidden.add(row.blocker_id);
    return hidden;
}

/** True when these two must not be shown to each other. */
export async function isBlockedBetween(supabase, a, b) {
    if (!supabase || !a || !b) return false;
    const { data, error } = await supabase
        .from('user_blocks')
        .select('id')
        .or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`)
        .limit(1);
    if (error) return false;
    return Boolean(data?.length);
}

/** The reasons a member may give. Free text goes in `detail`, not here. */
export const REPORT_REASONS = [
    { id: 'fake', label: 'Fake or stolen photos' },
    { id: 'money', label: 'Asking me for money' },
    { id: 'harassment', label: 'Harassment or abuse' },
    { id: 'explicit', label: 'Unwanted explicit content' },
    { id: 'underage', label: 'Looks under 18' },
    { id: 'other', label: 'Something else' },
];

export const REPORT_REASON_IDS = new Set(REPORT_REASONS.map((r) => r.id));
