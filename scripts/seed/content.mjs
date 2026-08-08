/**
 * Content pools for the seeded roster.
 *
 * The previous generator gave all 304 profiles one hobbies list, one interests
 * list, one `needed_qualities` string, four possible `wants` values, and a bio
 * that was a single sentence with the name substituted in. Locations were handed
 * out round-robin, so the distribution was uniform to within one profile and 41%
 * of the roster lived in Nairobi. Scroll the list and the repetition is the first
 * thing you see — that is what "machine generated" looks like in practice.
 *
 * Everything here is deterministic: the same profile id always produces the same
 * result, so regenerating does not reshuffle people who are already being shown.
 */

/**
 * A small deterministic PRNG (mulberry32) seeded from a string.
 *
 * Deliberately not Math.random: the generator writes a file that is committed,
 * and a nondeterministic generator would produce a large meaningless diff on
 * every run and silently change every profile.
 */
export function rng(seedText) {
    let h = 1779033703 ^ String(seedText).length;
    for (let i = 0; i < String(seedText).length; i++) {
        h = Math.imul(h ^ String(seedText).charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    let a = h >>> 0;
    return function next() {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export const pick = (next, list) => list[Math.floor(next() * list.length) % list.length];

/** n distinct items, order varied. */
export function sample(next, list, n) {
    const pool = [...list];
    const out = [];
    while (out.length < Math.min(n, pool.length)) {
        out.push(pool.splice(Math.floor(next() * pool.length), 1)[0]);
    }
    return out;
}

/** Pick from [value, weight] pairs. */
export function weighted(next, pairs) {
    const total = pairs.reduce((s, [, w]) => s + w, 0);
    let r = next() * total;
    for (const [value, w] of pairs) {
        r -= w;
        if (r <= 0) return value;
    }
    return pairs[pairs.length - 1][0];
}

/**
 * Where seeded profiles live.
 *
 * Weighted rather than round-robin. Nairobi still leads because it genuinely
 * does, but the weight is spread across ordinary residential areas rather than
 * concentrated in four luxury suburbs, and the list now reaches beyond the big
 * cities into the towns that actually make up the country. The result is an
 * uneven distribution, which is the point: a perfectly flat one is a tell.
 */
export const LOCATIONS = [
    // Nairobi and its metro. Still the largest single share, but weighted down
    // from the 41% the round-robin produced — a roster where two in five people
    // live in one city reads as a Nairobi app with some decoration, and the
    // towns below are where a good part of the real demand actually is.
    ['Nairobi CBD, Nairobi', 20], ['Westlands, Nairobi', 13], ['Kilimani, Nairobi', 12],
    ['Kasarani, Nairobi', 12], ['Embakasi, Nairobi', 11], ['South B, Nairobi', 9],
    ['Donholm, Nairobi', 8], ['Lang’ata, Nairobi', 7], ['Kileleshwa, Nairobi', 6],
    ['Roysambu, Nairobi', 8], ['Karen, Nairobi', 5], ['Lavington, Nairobi', 4],
    ['Runda, Nairobi', 3], ['Ruaka, Kiambu', 9], ['Kitengela, Kajiado', 11],
    ['Rongai, Kajiado', 9], ['Athi River, Machakos', 8], ['Juja, Kiambu', 8],
    ['Ruiru, Kiambu', 9], ['Thika, Kiambu', 11], ['Kikuyu, Kiambu', 7],

    // Coast
    ['Nyali, Mombasa', 14], ['Mombasa Island, Mombasa', 13], ['Bamburi, Mombasa', 9],
    ['Likoni, Mombasa', 7], ['Diani, Kwale', 8], ['Malindi, Kilifi', 7], ['Kilifi Town, Kilifi', 6],
    ['Watamu, Kilifi', 4], ['Ukunda, Kwale', 5], ['Voi, Taita Taveta', 4],

    // Lake and western
    ['Kisumu CBD, Kisumu', 12], ['Milimani, Kisumu', 7], ['Kakamega Town, Kakamega', 7],
    ['Bungoma Town, Bungoma', 6], ['Busia Town, Busia', 5], ['Siaya Town, Siaya', 4],
    ['Homa Bay Town, Homa Bay', 5], ['Migori Town, Migori', 5], ['Kisii Town, Kisii', 8],
    ['Nyamira Town, Nyamira', 3],

    // Rift Valley
    ['Nakuru CBD, Nakuru', 12], ['Naivasha, Nakuru', 9], ['Eldoret CBD, Uasin Gishu', 11],
    ['Kitale, Trans Nzoia', 6], ['Kericho Town, Kericho', 6], ['Bomet Town, Bomet', 4],
    ['Narok Town, Narok', 5], ['Nanyuki, Laikipia', 6], ['Kapsabet, Nandi', 4],
    ['Iten, Elgeyo Marakwet', 3],

    // Eastern and central
    ['Nyeri Town, Nyeri', 7], ['Meru Town, Meru', 8], ['Embu Town, Embu', 6],
    ['Machakos Town, Machakos', 8], ['Kitui Town, Kitui', 5], ['Muranga Town, Murang’a', 5],
    ['Kerugoya, Kirinyaga', 4], ['Chuka, Tharaka Nithi', 3], ['Wote, Makueni', 3],

    // North
    ['Garissa Town, Garissa', 3], ['Isiolo Town, Isiolo', 3], ['Lodwar, Turkana', 2],
];

/**
 * Weight adjustments by category.
 *
 * A sugar daddy is more likely to be in a commercial centre; a toyboy more
 * likely near a university or a satellite town. Not a strong effect — just
 * enough that the categories do not overlay perfectly on one another, which is
 * another way a generated roster becomes obvious.
 */
export const LOCATION_BIAS = {
    sugar_daddy: [/Nairobi CBD|Westlands|Kilimani|Karen|Lavington|Runda|Nyali|Milimani|Nanyuki/, 1.7],
    sugar_mummy: [/Nairobi|Nyali|Nakuru|Kisumu|Eldoret|Thika|Nyeri/, 1.35],
    toyboy: [/Kasarani|Roysambu|Juja|Ruiru|Rongai|Kitengela|Embakasi|Donholm|Kakamega|Eldoret/, 1.8],
    mistress: [/Kilimani|Westlands|South B|Embakasi|Nakuru|Kisumu|Mombasa Island|Bamburi|Thika/, 1.5],
};

export const HOBBIES = [
    'road trips', 'cooking', 'gym sessions', 'swimming', 'live music', 'football',
    'hiking', 'photography', 'reading', 'gardening', 'movies', 'dancing',
    'fashion', 'cycling', 'church fellowship', 'board games', 'fishing', 'yoga',
    'motorsport', 'volunteering', 'painting', 'golf', 'karaoke', 'camping',
    'thrifting', 'baking', 'chess', 'birdwatching', 'running', 'pottery',
];

export const INTERESTS = [
    'honest conversation', 'weekend getaways', 'quiet evenings', 'good food',
    'business talk', 'travel', 'faith', 'family', 'fitness', 'music',
    'art galleries', 'coffee dates', 'long drives', 'theatre', 'wildlife',
    'entrepreneurship', 'property', 'farming', 'wine tasting', 'comedy shows',
    'beach days', 'documentaries', 'markets', 'poetry', 'sports bars',
];

export const QUALITIES = [
    'honest', 'discreet', 'respectful', 'patient', 'ambitious', 'funny',
    'well spoken', 'independent', 'reliable', 'calm', 'generous', 'grounded',
    'straightforward', 'kind', 'confident', 'serious', 'attentive', 'mature',
    'good listener', 'drama free',
];

export const BODY_TYPES = ['Slim', 'Athletic', 'Average', 'Curvy', 'Full figured', 'Tall', 'Petite'];

export const EDUCATION = [
    'Certificate', 'Diploma', 'Degree', 'Postgraduate', 'Self taught', 'Trade school',
];

/**
 * First person, present tense — these are dropped straight after "I".
 *
 * They were written in the third person ("is a pharmacist"), which produced
 * "Currently I is a school director" in every bio that used them. Broken grammar
 * reads worse than a template, so the form is fixed here rather than papered
 * over with more sentence shapes.
 */
export const OCCUPATIONS = {
    sugar_mummy: ['run a boutique', 'import goods', 'manage a hotel', 'own rental property', 'am a pharmacist', 'run a salon', 'am a school director', 'trade in produce', 'am a senior nurse', 'run a hardware shop', 'work for the county', 'own a transport business'],
    sugar_daddy: ['run a construction firm', 'work in logistics', 'own farmland', 'am a contractor', 'run a car yard', 'am a consulting engineer', 'own a petrol station', 'am a wholesaler', 'run a security company', 'am a retired banker', 'own a printing press', 'work in real estate'],
    mistress: ['am a stylist', 'work in hospitality', 'am a makeup artist', 'run an online shop', 'am a receptionist', 'study part time', 'am a personal trainer', 'work in events', 'am a chef', 'run a food stall', 'am a beautician', 'work in retail'],
    toyboy: ['am a graphic designer', 'drive for a ride service', 'am a barber', 'play semi pro football', 'am a photographer', 'study IT', 'work in a gym', 'am a mechanic', 'run a phone shop', 'am a DJ', 'work in sales', 'am an electrician'],
};

/** Sentence shapes for the opening line, so bios do not all start the same way. */
const OPENERS = [
    (o) => `I ${o}.`,
    (o) => `Day to day, I ${o}.`,
    (o) => `Work wise, I ${o}.`,
    (o) => `I ${o} and keep busy with it.`,
    (o) => `Currently I ${o}.`,
    // Kept occupation-neutral: an earlier version ended "— it keeps me on the
    // road a fair bit", which was nonsense attached to half the jobs.
    (o) => `I ${o}, and it keeps me busy most of the week.`,
];

const LIFE_LINES = [
    (h) => `Outside that I am into ${h}.`,
    (h) => `My free time goes to ${h}.`,
    (h) => `When I get a break it is usually ${h}.`,
    (h) => `Weekends are for ${h}.`,
    (h) => `I unwind with ${h}.`,
];

const WANT_LINES = [
    (t, q) => `Looking for a ${t} who is ${q}.`,
    (t, q) => `I want to meet a ${t} — ${q} matters more to me than anything else.`,
    (t, q) => `Hoping to find a ${t} who is ${q}. No games.`,
    (t, q) => `If you are a ${t} and you are ${q}, say hello.`,
    (t, q) => `Would like something steady with a ${t} who is ${q}.`,
];

const CLOSERS = [
    'I keep things private.',
    'Straight talk only, please.',
    'I do not do time wasters.',
    'Discretion is important to me.',
    'Happy to take it slow.',
    'I answer when I can — I work long hours.',
    'Serious enquiries.',
    '',
    '',
];

const list = (items) => (
    items.length <= 1 ? (items[0] || '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
);

/**
 * Build one profile's written content.
 *
 * Composed from independent choices rather than a template with a name slotted
 * in, so two profiles agreeing on any one line is normal and agreeing on all of
 * them is vanishingly unlikely.
 */
export function buildContent({ id, label, lookingFor, labelName }) {
    const next = rng(`gs-seed-v2:${id}`);

    const hobbies = sample(next, HOBBIES, 2 + Math.floor(next() * 3));
    const interests = sample(next, INTERESTS, 2 + Math.floor(next() * 3));
    const qualities = sample(next, QUALITIES, 2 + Math.floor(next() * 3));
    const occupation = pick(next, OCCUPATIONS[label] || OCCUPATIONS.sugar_mummy);

    const bio = [
        pick(next, OPENERS)(occupation),
        pick(next, LIFE_LINES)(list(hobbies)),
        pick(next, WANT_LINES)(lookingFor, list(qualities.slice(0, 2))),
        pick(next, CLOSERS),
    ].filter(Boolean).join(' ');

    return {
        bio,
        hobbies,
        interests,
        needed_qualities: qualities.join(', '),
        wants: `A ${lookingFor} who is ${list(qualities)}.`,
        intent_summary: `${labelName} looking for a ${lookingFor}.`,
        body_type: pick(next, BODY_TYPES),
        education: pick(next, EDUCATION),
        occupation,
    };
}

/** A location for this profile, weighted and biased by category. */
export function buildLocation({ id, label }) {
    const next = rng(`gs-seed-loc-v2:${id}`);
    const [pattern, boost] = LOCATION_BIAS[label] || [null, 1];
    const pairs = LOCATIONS.map(([place, weight]) => [
        place,
        pattern && pattern.test(place) ? weight * boost : weight,
    ]);
    const place = weighted(next, pairs);
    return { location: place, city: place.split(',')[0].trim(), country: 'Kenya' };
}

/**
 * A join date spread across the past year.
 *
 * Every seeded profile previously carried the identical created_at, so any
 * "newest first" ordering returned them in file order and the whole roster
 * shared one birthday.
 */
export function buildJoinedAt({ id }, nowMs = Date.parse('2026-08-01T00:00:00.000Z')) {
    const next = rng(`gs-seed-joined-v2:${id}`);
    const daysAgo = Math.floor(next() * 330) + 3;
    const jitterMs = Math.floor(next() * 24 * 60 * 60 * 1000);
    return new Date(nowMs - daysAgo * 24 * 60 * 60 * 1000 - jitterMs).toISOString();
}
