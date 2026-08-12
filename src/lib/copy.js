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

/* Package gates enforced on the server and explained on the screen. */
export const MEDIA_NEEDS_SILVER = 'Media sharing requires Silver package or higher.';
export const VOICE_NOTES_NEED_SILVER = 'Voice notes require Silver package or higher.';

/* Profile validation, which the screen checks first and the server checks again. */
export const NAME_REQUIRED = 'Add your real first name or public name.';
export const PHONE_REQUIRED = 'Add a valid phone number.';

/*
  Recording. Both of these were written out on the member profile and again in
  the recorder component, which are the two places a voice note can start.
*/
export const VOICE_UNSUPPORTED = 'Voice notes are not supported on this device.';
export const MIC_BLOCKED = 'Microphone is blocked. Open GS App permissions on your device and allow Microphone, then try again.';

/* Account and session. */
export const ACCOUNT_RESTRICTED = 'Your account cannot be used right now.';
export const SESSION_USER_MISSING = 'Signed-in user was not found.';
export const ADMIN_ENV_MISSING = 'Supabase admin env missing.';
export const RESET_CODE_REQUIRED = 'Enter the 6-digit reset code.';
export const WELCOME_TITLE = 'Welcome to Genuine Sugar Mummies';

/*
  Match copy. This existed once in the API and once in the email templates, so
  the in app notification and the email about the same event could disagree
  about what had happened.
*/
export const MATCH_BOTH_LIKED = 'You both liked each other. You can message now.';
export const LIKE_BACK_PROMPT = 'Like them back to start talking.';

export const COMMENT_FAILED = 'Comment submission failed. Please try again.';
