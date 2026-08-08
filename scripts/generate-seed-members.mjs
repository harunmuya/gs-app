import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildContent, buildJoinedAt, buildLocation, LOCATIONS } from './seed/content.mjs';

const root = process.cwd();
const seedRoot = join(root, 'public', 'seed');
const publicBaseUrl = 'https://genuine-sugarmummies-app.vercel.app';

const config = {
  sugarmums: {
    label: 'sugar_mummy',
    lookingFor: 'Sugar Guy / Toyboy',
    minAge: 38,
    maxAge: 58,
    names: [
      'Mary Wanjiku', 'Grace Achieng', 'Rose Njeri', 'Janet Atieno', 'Catherine Muthoni', 'Naomi Chebet',
      'Lilian Nyambura', 'Tabitha Okello', 'Priscilla Kamau', 'Sarah Nambooze', 'Caroline Wambui',
      'Esther Njeri', 'Lucy Atieno', 'Mercy Karanja', 'Stella Naliaka', 'Ruth Nyambura', 'Monica Moraa',
      'Beatrice Awino', 'Alice Mwikali', 'Josephine Akinyi', 'Margaret Nyambura', 'Teresa Achieng',
      'Eunice Kerubo', 'Anne Wairimu', 'Nancy Mbithe', 'Gladys Chepkorir', 'Mildred Naliaka',
      'Pamela Atieno', 'Susan Wairimu', 'Dorothy Chebet', 'Agnes Muthoni', 'Hellen Moraa',
      'Florence Wambui', 'Jemimah Achieng', 'Christine Njeri', 'Rebecca Kamau', 'Yvonne Akoth',
      'Pauline Njeri', 'Angela Muthoni', 'Roseline Wanjiru', 'Joyce Wambui', 'Elizabeth Wairimu',
      'Martha Kariuki', 'Naomi Nambooze', 'Priscilla Nkurunziza', 'Sarah Okello', 'Tabitha Chebet',
      'Wairimu Johnson', 'Yolanda Taylor', 'Zipporah Wanjiku', 'Margaret Achieng', 'Catherine Nabwire',
      'Janet Mugisha', 'Rosemary Hassan', 'Winnie Atieno', 'Peninah Karanja', 'Damaris Wanjiku',
      'Violet Naliaka', 'Regina Wambui', 'Jacinta Moraa', 'Eunice Akinyi', 'Clara Kamau',
      'Irene Njeri', 'Leah Chebet', 'Millicent Wairimu', 'Nelly Muthoni', 'Purity Wanjiku',
      'Lydia Achieng', 'Vera Njeri', 'Edith Wambui', 'Jane Atieno', 'Maggie Kamau',
      'Sally Chebet', 'Cecilia Wairimu', 'Phoebe Muthoni', 'Judith Karanja', 'Anita Njeri',
      'Diana Wambui', 'Betty Akoth', 'Eva Wanjiku', 'Harriet Moraa', 'Selina Achieng',
      'Rachael Chebet', 'Miriam Wairimu', 'Nora Njeri', 'Vivian Kamau', 'Lorna Muthoni',
      'Ivy Wambui', 'Sandra Akinyi', 'Caren Wanjiru',
      // Extended names (91-114)
      'Dorcas Cherotich', 'Abigail Omollo', 'Charity Wangeci', 'Daphne Mukami', 'Emily Kemunto',
      'Felistus Jepchirchir', 'Gladys Nyokabi', 'Hope Nafula', 'Immaculate Wangari', 'Jennifer Mwende',
      'Kerubo Bosibori', 'Louisa Nekesa', 'Melissa Njoki', 'Nadia Chepngetich', 'Olive Wacera',
      'Peris Chemtai', 'Queeneth Aoko', 'Risper Mwikali', 'Siphiwe Kanini', 'Truphena Jepkosgei',
      'Ursula Makena', 'Veronicah Nyakerario', 'Winfridah Mwendwa', 'Ximena Adhiambo',
    ],
  },
  'sugar-dads': {
    label: 'sugar_daddy',
    lookingFor: 'Mistress',
    minAge: 50,
    maxAge: 64,
    names: [
      'James Kamau', 'Joseph Kimani', 'Peter Mwangi', 'Samuel Otieno', 'David Karanja', 'Patrick Njoroge',
      'George Mutua', 'Daniel Wekesa', 'Martin Kariuki', 'Anthony Kiplagat', 'Robert Omondi',
      'Michael Barasa', 'Charles Mwaura', 'Vincent Odhiambo', 'Richard Kiptoo', 'Edward Ndirangu',
      'Francis Onyango', 'Kenneth Muriithi', 'Victor Mboya', 'Stephen Kariuki', 'Alex Muthomi',
      'Collins Barasa', 'Moses Onyango', 'Isaac Mutiso', 'Emmanuel Wekesa', 'Fredrick Otieno',
      'Caleb Mwangi', 'Benard Kiptoo', 'Lawrence Muriuki', 'Simon Karanja', 'Dennis Mutua',
      'Albert Ochieng', 'Phillip Njoroge', 'Henry Kiprono', 'Nelson Wekesa', 'Brian Mwangi',
      'Arthur Kamau', 'Oscar Otieno', 'Leonard Kibet', 'Paul Kariuki', 'Wilson Odhiambo',
      'Evans Mutiso', 'Gabriel Ndirangu', 'Nicholas Barasa', 'Raymond Kimani',
      // Extended names (46-75)
      'Solomon Kigen', 'Andrew Mwenda', 'Godfrey Ouma', 'Julius Chepkwony', 'Stanley Macharia',
      'Ronald Mulinge', 'Clifford Nyambane', 'Douglas Korir', 'Walter Simiyu', 'Edwin Ngetich',
      'Allan Makori', 'Gilbert Wafula', 'Tom Muthomi', 'Cyrus Maina', 'Dominic Kipsang',
      'Harrison Kioko', 'Morris Oluoch', 'Gideon Manyara', 'Felix Musyoka', 'Bernard Kosgei',
      'Kelvin Gichuki', 'Samson Njenga', 'Mark Ouma', 'Geoffrey Nasimiyu', 'Tony Wambua',
      'Philip Kipchumba', 'Timothy Mwirigi', 'Jackson Oduor', 'Marcus Cheruiyot', 'Amos Kipchoge',
      'Matthew Wambugu',
    ],
  },
  mistresses: {
    label: 'mistress',
    lookingFor: 'Sugar Daddy',
    minAge: 24,
    maxAge: 33,
    names: [
      'Aisha Kamau', 'Brenda Kariuki', 'Cynthia Nambooze', 'Diana Nkurunziza', 'Evelyn Okello',
      'Faith Chebet', 'Irene Wairimu', 'Joyce Njeri', 'Miriam Achieng', 'Norah Kamene',
      'Patricia Chebet', 'Veronica Moraa', 'Sharon Wanjiru', 'Doreen Akoth', 'Lydia Mwikali',
      'Gloria Njeri', 'Esther Nyambura', 'Nancy Achieng', 'Sheila Wambui', 'Ruth Kamau',
      'Monica Atieno', 'Caroline Chebet', 'Stacy Moraa', 'Wendy Muthoni', 'Angela Wanjiku',
      'Rachael Naliaka', 'Mercy Akinyi', 'Hellen Wairimu', 'Tracy Karanja', 'Faith Wambui',
      'Pauline Njeri', 'Naomi Atieno', 'Betty Chepkemoi', 'Linda Muthoni', 'Catherine Moraa',
      'Susan Wanjiru', 'Violet Achieng', 'Janet Kamau', 'Milly Wairimu', 'Sally Njeri',
      'Edith Akoth', 'Caren Muthoni', 'Ivy Wambui', 'Sandra Chebet', 'Daisy Moraa',
      'Rose Wanjiku', 'Anne Atieno', 'Queen Njeri',
      // Extended names (49-95)
      'Wanjiru Mwangi', 'Tabitha Onyango', 'Stella Chepkurui', 'Phoebe Nekesa', 'Abby Wacera',
      'Brigid Chelagat', 'Cindy Oduya', 'Deborah Cheptoo', 'Elsie Mukiri', 'Fatuma Atieno',
      'Georgina Chepng\'etich', 'Hadija Moraa', 'Isabella Jeptoo', 'Jackline Wambui', 'Karen Nyaguthii',
      'Laura Chepkoech', 'Maureen Atieno', 'Niva Chepkirui', 'Orina Kemunto', 'Patience Wanjala',
      'Rita Cheptoo', 'Sonia Adhiambo', 'Triza Mwende', 'Una Cherono', 'Valarie Kemunto',
      'Whitney Achieng', 'Yvette Moraa', 'Zainabu Cherotich', 'Amina Wambui', 'Beverly Jepkemoi',
      'Cherop Nyambura', 'Delilah Otieno', 'Eunice Chemutai', 'Fridah Kerubo', 'Gina Jeptanui',
      'Hannah Chepchumba', 'Irene Moraa', 'Joan Chepkwemoi', 'Kate Njuguna', 'Lilian Chelagat',
      'Marion Adhiambo', 'Nicole Chepkirui', 'Olive Kemunto', 'Peninah Jeptoo', 'Queeneth Wanjiku',
      'Rosemary Cherono', 'Sylvia Chepng\'etich',
    ],
  },
  'Toboys or Sugarguys': {
    label: 'toyboy',
    lookingFor: 'Sugar Mummy',
    minAge: 21,
    maxAge: 34,
    names: [
      'Brian Otieno', 'Kevin Mwangi', 'Dennis Kariuki', 'Victor Onyango', 'Samuel Kiptoo',
      'Collins Mutua', 'Prince Wekesa', 'Elvis Kamau', 'Jayden Mboya', 'Kelvin Njoroge',
      'Trevor Barasa', 'Ian Odhiambo', 'Alex Kimani', 'Martin Ochieng', 'Felix Karanja',
      'Oscar Kiprono', 'Ryan Mwangi', 'Brandon Mutiso', 'Lewis Omondi', 'Kingsley Pinzy',
    ],
  },
};

const locations = [
  ['Nairobi', 'Kenya'], ['Westlands, Nairobi', 'Kenya'], ['Kilimani, Nairobi', 'Kenya'], ['Karen, Nairobi', 'Kenya'],
  ['Lavington, Nairobi', 'Kenya'], ['Kileleshwa, Nairobi', 'Kenya'], ['Runda, Nairobi', 'Kenya'], ['South B, Nairobi', 'Kenya'],
  ['Mombasa', 'Kenya'], ['Nyali, Mombasa', 'Kenya'], ['Kisumu', 'Kenya'], ['Nakuru', 'Kenya'],
  ['Eldoret', 'Kenya'], ['Thika', 'Kenya'], ['Kiambu', 'Kenya'], ['Machakos', 'Kenya'],
  ['Kisii', 'Kenya'], ['Naivasha', 'Kenya'], ['Meru', 'Kenya'], ['Kitengela', 'Kenya'],
];

const femaleFirstNames = [
  'Mary', 'Grace', 'Rose', 'Janet', 'Catherine', 'Naomi', 'Lilian', 'Tabitha', 'Priscilla', 'Sarah',
  'Caroline', 'Esther', 'Lucy', 'Mercy', 'Stella', 'Ruth', 'Monica', 'Beatrice', 'Alice', 'Josephine',
  'Margaret', 'Teresa', 'Eunice', 'Anne', 'Nancy', 'Gladys', 'Mildred', 'Pamela', 'Susan', 'Dorothy',
  'Agnes', 'Hellen', 'Florence', 'Jemimah', 'Christine', 'Rebecca', 'Yvonne', 'Pauline', 'Angela', 'Roseline',
  'Joyce', 'Elizabeth', 'Martha', 'Zipporah', 'Peninah', 'Damaris', 'Violet', 'Regina', 'Jacinta', 'Clara',
  'Irene', 'Leah', 'Millicent', 'Nelly', 'Purity', 'Lydia', 'Vera', 'Edith', 'Jane', 'Maggie',
  'Sally', 'Cecilia', 'Phoebe', 'Judith', 'Anita', 'Diana', 'Betty', 'Eva', 'Harriet', 'Selina',
  'Rachael', 'Miriam', 'Nora', 'Vivian', 'Lorna', 'Ivy', 'Sandra', 'Caren', 'Aisha', 'Brenda',
  'Cynthia', 'Evelyn', 'Faith', 'Norah', 'Patricia', 'Veronica', 'Sharon', 'Doreen', 'Gloria', 'Sheila',
];

const maleFirstNames = [
  'James', 'Joseph', 'Peter', 'Samuel', 'David', 'Patrick', 'George', 'Daniel', 'Martin', 'Anthony',
  'Robert', 'Michael', 'Charles', 'Vincent', 'Richard', 'Edward', 'Francis', 'Kenneth', 'Victor', 'Stephen',
  'Alex', 'Collins', 'Moses', 'Isaac', 'Emmanuel', 'Fredrick', 'Caleb', 'Benard', 'Lawrence', 'Simon',
  'Dennis', 'Albert', 'Phillip', 'Henry', 'Nelson', 'Brian', 'Arthur', 'Oscar', 'Leonard', 'Paul',
  'Wilson', 'Evans', 'Gabriel', 'Nicholas', 'Raymond', 'Kevin', 'Kelvin', 'Elvis', 'Trevor', 'Ian',
  'Felix', 'Ryan', 'Brandon', 'Lewis', 'John', 'Mark', 'Cyrus', 'Dominic', 'Andrew', 'Harrison',
  'Morris', 'Gideon', 'Walter', 'Edwin', 'Allan', 'Julius', 'Stanley', 'Ronald', 'Clifford', 'Douglas',
];

const femaleSurnames = [
  'Wanjiku', 'Achieng', 'Njeri', 'Atieno', 'Muthoni', 'Chebet', 'Nyambura', 'Okello', 'Wambui',
  'Naliaka', 'Mwikali', 'Akinyi', 'Kerubo', 'Wairimu', 'Mbithe', 'Chepkorir', 'Moraa',
];

const maleSurnames = [
  'Kimani', 'Mwangi', 'Otieno', 'Njoroge', 'Mutua', 'Wekesa', 'Kiplagat', 'Omondi', 'Barasa', 'Mwaura',
  'Odhiambo', 'Kiptoo', 'Ndirangu', 'Onyango', 'Muriithi', 'Ochieng', 'Maina', 'Mboya', 'Mutiso', 'Njenga',
      'Wambua', 'Kosgei', 'Myles', 'Kiprono', 'Mbugua', 'Gichuki', 'Okoth', 'Chege', 'Muthama', 'Njuguna',
];

const interests = [
  ['verified members', 'respectful companionship', 'private dates'],
  ['long-term arrangement', 'meaningful conversations', 'discreet connection'],
  ['premium experiences', 'lifestyle support', 'serious matches'],
  ['travel', 'fine dining', 'weekend drives'],
];

function slugify(value) {
  return String(value || 'member').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * One image per profile, preferring the WebP.
 *
 * scripts/optimise-seed-images.mjs writes a .webp beside every .jpg and leaves
 * the original in place, so a naive extension filter now matches both and would
 * build 606 profiles from 303 photos — blowing through the name pools and
 * tripping the duplicate guard. Pick the WebP where one exists, keep the JPEG
 * where it does not, and never both.
 */
function filesFor(folder) {
  const names = readdirSync(join(seedRoot, folder))
    .filter((name) => /\.(jpe?g|png|webp)$/i.test(name));
  const webpStems = new Set(
    names.filter((n) => /\.webp$/i.test(n)).map((n) => n.replace(/\.webp$/i, ''))
  );
  return names
    .filter((name) => /\.webp$/i.test(name) || !webpStems.has(name.replace(/\.(jpe?g|png)$/i, '')))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function ageFor(group, index) {
  return group.minAge + (index % (group.maxAge - group.minAge + 1));
}

function labelText(label) {
  if (label === 'sugar_mummy') return 'Sugar Mummy';
  if (label === 'sugar_daddy') return 'Sugar Daddy';
  if (label === 'mistress') return 'Mistress';
  if (label === 'toyboy') return 'Sugar Guy / Toyboy';
  return 'Member';
}

function nameForLabel(label, index, offset = 0) {
  const firstNames = label === 'sugar_daddy' || label === 'toyboy' ? maleFirstNames : femaleFirstNames;
  const surnames = label === 'sugar_daddy' || label === 'toyboy' ? maleSurnames : femaleSurnames;
  const first = firstNames[(index + offset) % firstNames.length];
  const surname = surnames[(index * 7 + offset * 3) % surnames.length];
  const name = `${first} ${surname}`;
  return name === 'Gabriel Muchiri' ? 'Gabriel Myles' : name;
}

function seedTierForIndex(index) {
  const bucket = (index * 7 + 3) % 20;
  if (bucket < 14) return { tier: 'silver', verified: true };
  if (bucket < 17) return { tier: 'basic', verified: false };
  return { tier: 'free', verified: false };
}

function profileBio(name, label, lookingFor, verified = true) {
  const role = labelText(label);
  return `${name} is a ${verified ? 'verified ' : ''}${role} looking for ${lookingFor}. Values respect, privacy, and clear communication.`;
}

const profiles = [];
Object.entries(config).forEach(([folder, group]) => {
  filesFor(folder).forEach((file, index) => {
    const name = nameForLabel(group.label, index, profiles.length);
    const photo = encodeURI(`/seed/${folder}/${file}`);
    const number = profiles.length + 1;
    const id = `seed-local-${String(number).padStart(3, '0')}`;
    const username = `${slugify(name)}_${String(number).padStart(3, '0')}`;
    const { tier, verified } = seedTierForIndex(number - 1);
    // Written content, location and join date all come from scripts/seed/content
    // keyed on the profile id — see that file for why the old single-template
    // approach had to go.
    const content = buildContent({ id, label: group.label, lookingFor: group.lookingFor, labelName: labelText(group.label) });
    const place = buildLocation({ id, label: group.label });
    profiles.push({
      id,
      username,
      email: `seed+app-${String(number).padStart(3, '0')}@genuinesugarmummies.co.ke`,
      display_name: name,
      avatar_url: photo,
      photo_https: `${publicBaseUrl}${photo}`,
      age: ageFor(group, index),
      location: place.location,
      country: place.country,
      city: place.city,
      profile_label: group.label,
      member_category: group.label,
      looking_for: group.lookingFor,
      bio: content.bio,
      description: content.bio,
      wants: content.wants,
      needed_qualities: content.needed_qualities,
      intent_summary: content.intent_summary,
      age_range_preference: group.label === 'sugar_mummy' ? '21-34' : group.label === 'mistress' ? '45-68' : group.label === 'toyboy' ? '38-58' : '24-35',
      hobbies: content.hobbies,
      interests: content.interests,
      body_type: content.body_type,
      education: content.education,
      occupation: content.occupation,
      created_at: buildJoinedAt({ id }),
      subscription_tier: tier,
      verified,
      verification_status: verified ? 'verified' : 'unsubmitted',
      admin_approved: verified,
      phone_reveal_plan: tier === 'silver' ? 'silver' : tier === 'basic' ? 'basic' : 'free',
    });
  });
});

/**
 * Refuse to write a roster with a repeated name or a repeated photo.
 *
 * Neither is true today, but nothing stopped it becoming true: names come from
 * modular arithmetic over fixed lists, so adding photos to a category can start
 * producing collisions with no warning. Two profiles sharing a face is the
 * single most damaging thing this roster could do, so the generator fails
 * instead of emitting it.
 */
function assertNoDuplicates(rows) {
  const problems = [];
  const seenName = new Map();
  const seenPhoto = new Map();
  for (const row of rows) {
    if (seenName.has(row.display_name)) problems.push(`duplicate name "${row.display_name}" (${seenName.get(row.display_name)} and ${row.id})`);
    else seenName.set(row.display_name, row.id);
    if (seenPhoto.has(row.avatar_url)) problems.push(`duplicate photo "${row.avatar_url}" (${seenPhoto.get(row.avatar_url)} and ${row.id})`);
    else seenPhoto.set(row.avatar_url, row.id);
  }
  if (problems.length) {
    console.error(`\nRefusing to write the seed roster — ${problems.length} collision(s):`);
    problems.slice(0, 20).forEach((p) => console.error(`  ${p}`));
    console.error('\nAdd more first names or surnames in this file, or remove the duplicate image.');
    process.exit(1);
  }
  console.log(`seed roster: ${rows.length} profiles, no duplicate names, no duplicate photos`);
}

assertNoDuplicates(profiles);

function jsString(value) {
  return JSON.stringify(value);
}

/**
 * The runtime seed roster.
 *
 * Each profile now carries its own written content, location and join date —
 * they are no longer derived at read time from rotating lists, which is what
 * made every profile read identically. The constant fields are still applied in
 * the mapper below because repeating them 304 times would triple the file for
 * nothing.
 */
const localSeedFile = `// Generated by scripts/generate-seed-members.mjs — do not edit by hand.
//
// Server-only. Importing this from a client component ships the whole roster to
// every visitor; use lib/profileFallbackManifest for image fallbacks instead.

const PROFILES = ${JSON.stringify(profiles.map((profile) => {
  const row = {};
  for (const key of ["id","username","display_name","avatar_url","age","location","country","city","profile_label","looking_for","bio","wants","needed_qualities","intent_summary","age_range_preference","hobbies","interests","body_type","education","occupation","created_at","subscription_tier","verified"]) row[key] = profile[key];
  return row;
}), null, 4)};

export function localSeedRows() {
    return PROFILES.map((profile, index) => ({
        ...profile,
        email: \`seed+app-\${String(index + 1).padStart(3, '0')}@genuinesugarmummies.co.ke\`,
        photos: [profile.avatar_url],
        description: profile.bio,
        member_category: profile.profile_label,
        phone: '',
        phone_number: '',
        verification_status: profile.verified ? 'verified' : 'unsubmitted',
        admin_approved: profile.verified,
        phone_reveal_plan: profile.subscription_tier === 'silver' ? 'silver' : profile.subscription_tier === 'basic' ? 'basic' : 'free',
        show_in_public: true,
        is_banned: false,
        is_suspended: false,
        // Engagement counters stay at zero. A seeded profile has not been viewed
        // or followed by anyone, and inventing the numbers is the kind of claim
        // the rest of the app had these removed for.
        total_profile_views: 0,
        followers_count: 0,
        gifts_received_count: 0,
        package_locked: false,
        is_seed_profile: true,
        boost_expires_at: null,
        boost_score: 0,
        // No presence. These profiles cannot be online, so they carry no
        // last_seen_at and the UI must not draw a status dot for them.
        last_seen_at: null,
        last_seen: null,
        is_online: false,
    }));
}

export function getLocalSeedMember(key) {
    const value = String(key || '').replace(/^@+/, '').toLowerCase();
    if (!value) return null;
    return localSeedRows().find((member) => member.id.toLowerCase() === value || member.username.toLowerCase() === value) || null;
}
`;

function sqlValue(value) {
  if (Array.isArray(value)) return `ARRAY[${value.map(sqlValue).join(', ')}]::text[]`;
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return `'${String(value).replace(/'/g, "''")}'`;
}

const rows = profiles.map((profile, index) => {
  const created = new Date(Date.UTC(2026, 5, 25, 12, 0, 0) - index * 37 * 60 * 1000).toISOString();
  // `lastSeen` was removed. It generated an offset from Date.now() at build time,
  // so every regenerated seed batch arrived permanently "active in the last two
  // hours". Seeded rows now insert NULL for last_seen_at / last_seen.
  const values = [
    profile.email,
    profile.username,
    profile.display_name,
    profile.avatar_url,
    [profile.avatar_url],
    profile.bio,
    profile.description,
    profile.age,
    profile.location,
    profile.country,
    profile.city,
    profile.profile_label,
    profile.member_category,
    profile.looking_for,
    `I am a ${labelText(profile.profile_label)} looking for ${profile.looking_for}.`,
    profile.wants,
    profile.needed_qualities,
    profile.age_range_preference,
    profile.hobbies,
    profile.interests,
    profile.body_type,
    profile.subscription_tier,
    profile.verified,
    profile.verification_status,
    profile.admin_approved,
    false,
    false,
    true,
    false,
    // total_profile_views / followers_count / gifts_received_count.
    // Zero, not invented figures. These previously emitted 900+, 35+, and 4+ per
    // profile, which the API then reported to members as genuine popularity for
    // accounts nobody has ever viewed, followed, or gifted.
    0,
    0,
    0,
    profile.phone_reveal_plan,
    true,
    index % 6 === 0 ? 25 : 0,
    created,
    // last_seen_at / last_seen. Null: there is no one signed in behind a seeded
    // profile, so any timestamp is a claim of activity that never happened — and
    // a non-null value feeds the activity signal in discovery ranking, letting
    // unattended profiles outrank real members.
    null,
    null,
  ];
  return `    (${values.map(sqlValue).join(', ')})`;
});

const migration = `-- Clean reseed for categorized seed profiles.
-- Real users are preserved. Only rows marked as seed profiles or old seed image/email rows are replaced.

alter table public.users add column if not exists username text;
alter table public.users add column if not exists display_name text;
alter table public.users add column if not exists avatar_url text;
alter table public.users add column if not exists bio text;
alter table public.users add column if not exists description text;
alter table public.users add column if not exists age integer;
alter table public.users add column if not exists location text;
alter table public.users add column if not exists country text;
alter table public.users add column if not exists city text;
alter table public.users add column if not exists is_seed_profile boolean not null default false;
alter table public.users add column if not exists show_in_public boolean not null default true;
alter table public.users add column if not exists profile_label text;
alter table public.users add column if not exists member_category text;
alter table public.users add column if not exists looking_for text;
alter table public.users add column if not exists intent_summary text;
alter table public.users add column if not exists wants text;
alter table public.users add column if not exists needed_qualities text;
alter table public.users add column if not exists age_range_preference text;
alter table public.users add column if not exists photos text[] default '{}'::text[];
alter table public.users add column if not exists hobbies text[] default '{}'::text[];
alter table public.users add column if not exists interests text[] default '{}'::text[];
alter table public.users add column if not exists body_type text;
alter table public.users add column if not exists subscription_tier text default 'free';
alter table public.users add column if not exists verified boolean not null default false;
alter table public.users add column if not exists verification_status text default 'unsubmitted';
alter table public.users add column if not exists admin_approved boolean not null default true;
alter table public.users add column if not exists package_locked boolean not null default false;
alter table public.users add column if not exists is_banned boolean not null default false;
alter table public.users add column if not exists is_suspended boolean not null default false;
alter table public.users add column if not exists total_profile_views integer not null default 0;
alter table public.users add column if not exists followers_count integer not null default 0;
alter table public.users add column if not exists gifts_received_count integer not null default 0;
alter table public.users add column if not exists phone_reveal_plan text;
alter table public.users add column if not exists boost_score integer not null default 0;
alter table public.users add column if not exists created_at timestamptz not null default now();
alter table public.users add column if not exists last_seen_at timestamptz;
alter table public.users add column if not exists last_seen timestamptz;

delete from public.users
where is_seed_profile = true
   or lower(coalesce(email, '')) like 'seed+%@genuinesugarmummies.co.ke'
   or lower(coalesce(email, '')) like 'seed+%@genuinesugarmummies.com'
   or lower(coalesce(username, '')) like '%_seed_%'
   or lower(coalesce(avatar_url, '') || ' ' || coalesce(array_to_string(photos, ' '), '')) like '%/seed/%'
   or lower(coalesce(avatar_url, '') || ' ' || coalesce(array_to_string(photos, ' '), '')) like '%/seed-photos/%'
   or lower(coalesce(avatar_url, '') || ' ' || coalesce(array_to_string(photos, ' '), '')) like '%/pics/%'
   or lower(coalesce(avatar_url, '') || ' ' || coalesce(array_to_string(photos, ' '), '')) like '%genuinesugarmummies.com%';

insert into public.users (
    email, username, display_name, avatar_url, photos, bio, description, age, location, country, city,
    profile_label, member_category, looking_for, intent_summary, wants, needed_qualities, age_range_preference,
    hobbies, interests, body_type, subscription_tier, verified, verification_status, show_in_public,
    is_banned, is_suspended, admin_approved, package_locked, total_profile_views, followers_count,
    gifts_received_count, phone_reveal_plan, is_seed_profile, boost_score, created_at, last_seen_at, last_seen
)
values
${rows.join(',\n')}
on conflict (email) do update set
    username = excluded.username,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    photos = excluded.photos,
    bio = excluded.bio,
    description = excluded.description,
    age = excluded.age,
    location = excluded.location,
    country = excluded.country,
    city = excluded.city,
    profile_label = excluded.profile_label,
    member_category = excluded.member_category,
    looking_for = excluded.looking_for,
    intent_summary = excluded.intent_summary,
    wants = excluded.wants,
    needed_qualities = excluded.needed_qualities,
    age_range_preference = excluded.age_range_preference,
    hobbies = excluded.hobbies,
    interests = excluded.interests,
    body_type = excluded.body_type,
    subscription_tier = excluded.subscription_tier,
    verified = excluded.verified,
    verification_status = excluded.verification_status,
    show_in_public = excluded.show_in_public,
    is_banned = excluded.is_banned,
    is_suspended = excluded.is_suspended,
    admin_approved = excluded.admin_approved,
    package_locked = excluded.package_locked,
    total_profile_views = excluded.total_profile_views,
    followers_count = excluded.followers_count,
    gifts_received_count = excluded.gifts_received_count,
    phone_reveal_plan = excluded.phone_reveal_plan,
    is_seed_profile = excluded.is_seed_profile,
    boost_score = excluded.boost_score,
    created_at = excluded.created_at,
    last_seen_at = excluded.last_seen_at,
    last_seen = excluded.last_seen;

update public.users
set
    looking_for = case
        when profile_label = 'sugar_mummy' then 'Sugar Guy / Toyboy'
        when profile_label = 'sugar_daddy' then 'Mistress'
        when profile_label = 'mistress' then 'Sugar Daddy'
        when profile_label = 'toyboy' then 'Sugar Mummy'
        else looking_for
    end,
    member_category = coalesce(nullif(member_category, ''), profile_label),
    show_in_public = true
where is_seed_profile = true;

select
    count(*) filter (where is_seed_profile = true) as seed_profiles,
    count(*) filter (where is_seed_profile = true and profile_label = 'sugar_mummy') as sugar_mummies,
    count(*) filter (where is_seed_profile = true and profile_label = 'sugar_daddy') as sugar_daddies,
    count(*) filter (where is_seed_profile = true and profile_label = 'mistress') as mistresses,
    count(*) filter (where is_seed_profile = true and lower(coalesce(avatar_url, '') || ' ' || coalesce(array_to_string(photos, ' '), '')) like '%/seed-photos/%') as legacy_seed_photo_urls
from public.users;
`;

writeFileSync(join(root, 'src', 'lib', 'localSeedMembers.js'), localSeedFile);
writeFileSync(join(root, 'supabase', 'migrations', '20260709_048_clean_reseed_all_seed_categories.sql'), migration);

console.log(`Generated ${profiles.length} categorized seed profiles.`);
