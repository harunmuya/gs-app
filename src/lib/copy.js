/**
 * Sentences a member reads in more than one place.
 *
 * The gate messages were written out separately on the screen and again in the
 * route that enforces them. That is the worst kind of duplicate, because the
 * two are supposed to agree: the screen tells you why you were stopped and the
 * server decides whether to stop you. When they drift, the app blocks you for
 * one reason and explains a different one.
 *
 * Only strings that genuinely appear twice belong here. A message used in one
 * place should stay where it is used, next to the thing that raises it.
 */

/*
  "Your daily quota has exhausted" was the original wording in all three copies.
  A quota does not exhaust, it is exhausted, and naming the limit is more use
  than naming the state.
*/
export const QUOTA_EXHAUSTED = 'You have used your free actions for today. A package removes the daily limit.';

export const IMAGE_NEEDS_BASIC = 'Image sharing requires Basic package or higher.';
export const GIF_NEEDS_SILVER = 'GIF sharing requires Silver package or higher.';
export const CALLS_NEED_SILVER = 'Voice and video calls require an active Silver or Gold package.';

export const AGE_RANGE = 'Age must be between 18 and 80.';

export const MEMBER_UNAVAILABLE = 'This member is unavailable.';
export const CANNOT_CALL_SELF = 'You cannot call yourself.';
