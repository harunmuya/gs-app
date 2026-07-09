import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

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
  ['Nairobi', 'Kenya'], ['Westlands, Nairobi', 'Kenya'], ['Kilimani, Nairobi', 'Kenya'], ['Mombasa', 'Kenya'],
  ['Kisumu', 'Kenya'], ['Nakuru', 'Kenya'], ['Eldoret', 'Kenya'], ['Thika', 'Kenya'], ['Kampala', 'Uganda'],
  ['Dar es Salaam', 'Tanzania'], ['Arusha', 'Tanzania'], ['Kigali', 'Rwanda'], ['Nyali, Mombasa', 'Kenya'],
  ['Kiambu', 'Kenya'], ['Machakos', 'Kenya'], ['Kisii', 'Kenya'],
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

function filesFor(folder) {
  return readdirSync(join(seedRoot, folder))
    .filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
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

function profileBio(name, label, lookingFor) {
  const role = labelText(label);
  return `${name} is a verified ${role} looking for ${lookingFor}. Values respect, privacy, and clear communication.`;
}

const profiles = [];
Object.entries(config).forEach(([folder, group]) => {
  filesFor(folder).forEach((file, index) => {
    const name = group.names[index] || `${group.label.replace(/_/g, ' ')} ${index + 1}`;
    const [location, country] = locations[(profiles.length + index) % locations.length];
    const photo = encodeURI(`/seed/${folder}/${file}`);
    const number = profiles.length + 1;
    const id = `seed-local-${String(number).padStart(3, '0')}`;
    const username = `${slugify(name)}_seed_${String(number).padStart(3, '0')}`;
    const bio = profileBio(name, group.label, group.lookingFor);
    profiles.push({
      id,
      username,
      email: `seed+app-${String(number).padStart(3, '0')}@genuinesugarmummies.co.ke`,
      display_name: name,
      avatar_url: photo,
      photo_https: `${publicBaseUrl}${photo}`,
      age: ageFor(group, index),
      location,
      country,
      city: location,
      profile_label: group.label,
      member_category: group.label,
      looking_for: group.lookingFor,
      bio,
      description: bio,
      wants: group.label === 'sugar_mummy'
        ? 'A confident sugar guy or toyboy who is respectful, attentive, and serious.'
        : group.label === 'sugar_daddy'
          ? 'A confident mistress who values respect, privacy, and clear communication.'
          : group.label === 'mistress'
            ? 'A mature sugar daddy who is respectful, generous, and serious.'
            : 'A genuine sugar mummy who values respect, attention, and clear communication.',
      needed_qualities: 'respectful, honest, discreet, serious',
      age_range_preference: group.label === 'sugar_mummy' ? '21-34' : group.label === 'mistress' ? '45-68' : group.label === 'toyboy' ? '38-58' : '24-35',
      hobbies: ['travel', 'fine dining', 'private dates'],
      interests: interests[index % interests.length],
      body_type: ['Elegant', 'Fit', 'Average', 'Curvy'][index % 4],
    });
  });
});

function jsString(value) {
  return JSON.stringify(value);
}

const localSeedFile = `const LOCATIONS = ${JSON.stringify(locations, null, 4)};\n\nconst PROFILES = ${JSON.stringify(profiles.map((profile) => [
  profile.display_name,
  profile.profile_label,
  profile.looking_for,
  profile.age,
  profile.avatar_url,
  profile.username,
]), null, 4)};\n\nfunction slugify(value) {\n    return String(value || 'member').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');\n}\n\nfunction labelText(label) {\n    if (label === 'sugar_mummy') return 'Sugar Mummy';\n    if (label === 'sugar_daddy') return 'Sugar Daddy';\n    if (label === 'mistress') return 'Mistress';\n    if (label === 'toyboy') return 'Sugar Guy / Toyboy';\n    return 'Member';\n}\n\nexport function localSeedRows() {\n    return PROFILES.map(([name, label, lookingFor, age, photo, username], index) => {\n        const [location, country] = LOCATIONS[index % LOCATIONS.length];\n        const id = \`seed-local-\${String(index + 1).padStart(3, '0')}\`;\n        const seen = new Date(Date.now() - ((index % 8) + 1) * 18 * 60 * 1000).toISOString();\n        const type = labelText(label);\n        return {\n            id,\n            username: username || slugify(name),\n            email: \`seed+app-\${String(index + 1).padStart(3, '0')}@genuinesugarmummies.co.ke\`,\n            display_name: name,\n            avatar_url: photo,\n            photos: [photo],\n            bio: \`\${name} is a verified \${type} looking for \${lookingFor}. Values respect, privacy, and clear communication.\`,\n            description: \`\${name} is a verified \${type} looking for \${lookingFor}. Values respect, privacy, and clear communication.\`,\n            age,\n            location,\n            country,\n            city: location,\n            phone: '',\n            phone_number: '',\n            profile_label: label,\n            member_category: label,\n            looking_for: lookingFor,\n            intent_summary: \`I am a \${type} looking for \${lookingFor}.\`,\n            wants: label === 'sugar_mummy'\n                ? 'A confident sugar guy or toyboy who is respectful, attentive, and serious.'\n                : label === 'sugar_daddy'\n                    ? 'A confident mistress who values respect, privacy, and clear communication.'\n                    : label === 'mistress'\n                        ? 'A mature sugar daddy who is respectful, generous, and serious.'\n                        : 'A genuine sugar mummy who values respect, attention, and clear communication.',\n            needed_qualities: 'respectful, honest, discreet, serious',\n            age_range_preference: label === 'sugar_mummy' ? '21-34' : label === 'mistress' ? '45-68' : label === 'toyboy' ? '38-58' : '24-35',\n            hobbies: ['travel', 'fine dining', 'private dates'],\n            interests: ['verified members', 'respectful companionship', 'lifestyle support'],\n            body_type: ['Elegant', 'Fit', 'Average', 'Curvy'][index % 4],\n            subscription_tier: 'silver',\n            verified: true,\n            verification_status: 'verified',\n            show_in_public: true,\n            is_banned: false,\n            is_suspended: false,\n            total_profile_views: 900 + index * 83,\n            followers_count: 35 + index * 4,\n            gifts_received_count: 4 + (index % 40),\n            admin_approved: true,\n            package_locked: false,\n            phone_reveal_plan: 'silver',\n            is_seed_profile: true,\n            boost_expires_at: null,\n            boost_score: index % 6 === 0 ? 25 : 0,\n            created_at: new Date(Date.now() - (index + 3) * 24 * 60 * 60 * 1000).toISOString(),\n            last_seen_at: seen,\n            last_seen: seen,\n        };\n    });\n}\n\nexport function getLocalSeedMember(key) {\n    const value = String(key || '').replace(/^@+/, '').toLowerCase();\n    if (!value) return null;\n    return localSeedRows().find((member) => member.id.toLowerCase() === value || member.username.toLowerCase() === value) || null;\n}\n`;

function sqlValue(value) {
  if (Array.isArray(value)) return `ARRAY[${value.map(sqlValue).join(', ')}]::text[]`;
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return `'${String(value).replace(/'/g, "''")}'`;
}

const rows = profiles.map((profile, index) => {
  const created = new Date(Date.UTC(2026, 5, 25, 12, 0, 0) - index * 37 * 60 * 1000).toISOString();
  const lastSeen = new Date(Date.now() - ((index % 8) + 1) * 18 * 60 * 1000).toISOString();
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
    'silver',
    true,
    'verified',
    true,
    false,
    false,
    true,
    false,
    900 + index * 83,
    35 + index * 4,
    4 + (index % 40),
    'silver',
    true,
    index % 6 === 0 ? 25 : 0,
    created,
    lastSeen,
    lastSeen,
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
   or lower(coalesce(avatar_url, '') || ' ' || coalesce(array_to_string(photos, ' '), '')) like '%/seed-photos/%';

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
