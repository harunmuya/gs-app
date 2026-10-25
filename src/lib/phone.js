/**
 * Phone numbers and countries, for an app that is no longer Kenya-only.
 *
 * Sign-up used to keep whatever the member typed, cleaned of punctuation. That
 * works exactly as long as everyone is Kenyan: "0739154302" means +254739154302
 * only if you already assume Kenya. The same digits are a valid Ugandan number,
 * and a member in Uganda and a member in Kenya could hold what looked like the
 * same number while being two different people. Admin could not dial a stored
 * number without guessing the country, and nothing could tell a typo from a
 * foreign format.
 *
 * Numbers are therefore stored in E.164 (+254739154302) — one unambiguous form
 * per phone, the format WhatsApp links and every SMS gateway already expect.
 *
 * The country data is not written out here. Dial codes and per-country number
 * rules change, and a table typed from memory is wrong in ways nobody notices
 * until a member cannot sign up. libphonenumber-js carries Google's metadata
 * for all 245 territories, and country names come from Intl.DisplayNames, which
 * ships with the runtime.
 */

import {
    getCountries,
    getCountryCallingCode,
    parsePhoneNumberFromString,
} from 'libphonenumber-js';

/** Kenya is where the business operates, so it is the sensible starting point. */
export const DEFAULT_COUNTRY = 'KE';

/*
  Intl.DisplayNames exists in every browser this app supports and in Node 18+,
  but it is still a runtime lookup, so a missing entry falls back to the ISO
  code rather than throwing during render.
*/
const regionNames = (() => {
    try {
        return new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
        return null;
    }
})();

export function countryName(code) {
    try {
        return regionNames?.of(code) || code;
    } catch {
        return code;
    }
}

export function callingCode(code) {
    try {
        return getCountryCallingCode(code);
    } catch {
        return '';
    }
}

/** Every selectable country, by name, each with its dial code. */
export const COUNTRIES = getCountries()
    .map((code) => ({ code, name: countryName(code), callingCode: callingCode(code) }))
    .sort((a, b) => a.name.localeCompare(b.name));

/**
 * Parse what the member typed.
 *
 * A value starting with "+" is already international and is read on its own
 * terms, so somebody selecting Kenya but entering a UK number still gets the UK
 * number rather than a mangled Kenyan one. Anything else is read as a national
 * number in `country`.
 */
function parse(value, country) {
    const text = String(value || '').trim();
    if (!text) return null;
    try {
        return text.startsWith('+')
            ? parsePhoneNumberFromString(text)
            : parsePhoneNumberFromString(text, country || DEFAULT_COUNTRY);
    } catch {
        return null;
    }
}

/** True when this is a real, dialable number — not merely the right length. */
export function isValidPhone(value, country) {
    return Boolean(parse(value, country)?.isValid());
}

/** The stored form: +254739154302, or '' when the input is not a valid number. */
export function toE164(value, country) {
    const parsed = parse(value, country);
    return parsed?.isValid() ? parsed.number : '';
}

/** Grouped for display, e.g. "0739 154302". Falls back to the raw input. */
export function formatNational(value, country) {
    const parsed = parse(value, country);
    return parsed?.isValid() ? parsed.formatNational() : String(value || '');
}

/** Which country a stored E.164 number belongs to, for prefilling a form. */
export function countryOf(e164) {
    return parse(e164, null)?.country || null;
}

/*
  The reverse geocoder reports a country by name, and the form holds an ISO
  code. Matching is case-insensitive and best-effort: a geocoder may say
  "United Kingdom of Great Britain and Northern Ireland" where Intl says
  "United Kingdom", so an unrecognised name returns null and the member's own
  selection is left alone rather than being overwritten with a guess.
*/
const byName = new Map(COUNTRIES.map((c) => [c.name.toLowerCase(), c.code]));

export function countryCodeFromName(name) {
    const key = String(name || '').trim().toLowerCase();
    return key ? byName.get(key) || null : null;
}
