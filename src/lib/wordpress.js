const WP_API_URL = process.env.NEXT_PUBLIC_WP_API_URL || 'https://genuinesugarmummies.co.ke/wp-json/wp/v2';

// Kenyan cities/towns for location extraction
const KENYAN_LOCATIONS = [
    'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika',
    'Malindi', 'Kitale', 'Garissa', 'Kakamega', 'Nyeri', 'Machakos',
    'Meru', 'Lamu', 'Nanyuki', 'Naivasha', 'Kiambu', 'Ruiru',
    'Kangundo', 'Athi River', 'Syokimau', 'Juja', 'Limuru', 'Ngong',
    'Rongai', 'Karen', 'Lavington', 'Westlands', 'Kilimani', 'Langata',
    'Embakasi', 'Kasarani', 'Roysambu', 'South B', 'South C',
    'Eastleigh', 'Parklands', 'Muthaiga', 'Runda', 'Gigiri',
    'Bamburi', 'Nyali', 'Diani', 'Watamu', 'Kilifi', 'Voi',
    'Migori', 'Homabay', 'Bungoma', 'Kericho', 'Nandi', 'Bomet',
    'Embu', 'Isiolo', 'Marsabit', 'Mandera', 'Wajir', 'Samburu',
    'Trans Nzoia', 'Uasin Gishu', 'Kitui', 'Makueni', 'Tharaka',
    'Murang\'a', 'Kirinyaga', 'Laikipia', 'Kajiado', 'Narok',
    'Baringo', 'Turkana', 'West Pokot', 'Elgeyo Marakwet',
    'Thika Road', 'Mombasa Road', 'Ngong Road', 'Waiyaki Way',
    'CBD', 'Industrial Area', 'Upper Hill', 'Hurlingham',
    'Kileleshwa', 'Riverside', 'Spring Valley', 'Loresho',
    'Mountain View', 'Zimmerman', 'Kahawa', 'Utawala', 'Donholm',
    'Buruburu', 'Umoja', 'Pipeline', 'Fedha', 'Tassia',
    'Ngoingwa', 'Section 9', 'Section 8', 'Kenol', 'Makongeni'
];

// Known Kenyan city coordinates for scoring
const LOCATION_COORDS = {
    'Nairobi': { lat: -1.2921, lng: 36.8219 },
    'Mombasa': { lat: -4.0435, lng: 39.6682 },
    'Kisumu': { lat: -0.1022, lng: 34.7617 },
    'Nakuru': { lat: -0.3031, lng: 36.0800 },
    'Eldoret': { lat: 0.5143, lng: 35.2698 },
    'Thika': { lat: -1.0396, lng: 37.0900 },
    'Malindi': { lat: -3.2138, lng: 40.1169 },
    'Kitale': { lat: 1.0187, lng: 35.0020 },
    'Nyeri': { lat: -0.4197, lng: 36.9511 },
    'Machakos': { lat: -1.5177, lng: 37.2634 },
    'Meru': { lat: 0.0480, lng: 37.6559 },
    'Nanyuki': { lat: 0.0067, lng: 37.0722 },
    'Naivasha': { lat: -0.7172, lng: 36.4310 },
    'Kiambu': { lat: -1.1714, lng: 36.8356 },
    'Ruiru': { lat: -1.1489, lng: 36.9606 },
    'Ngong': { lat: -1.3607, lng: 36.6583 },
    'Rongai': { lat: -1.3964, lng: 36.7586 },
    'Karen': { lat: -1.3197, lng: 36.7116 },
    'Westlands': { lat: -1.2636, lng: 36.8036 },
    'Kilimani': { lat: -1.2903, lng: 36.7847 },
    'Langata': { lat: -1.3557, lng: 36.7462 },
    'Thika Road': { lat: -1.1900, lng: 36.9200 },
    'Mombasa Road': { lat: -1.3400, lng: 36.8700 },
    'Juja': { lat: -1.1004, lng: 37.0131 },
    'Diani': { lat: -4.3164, lng: 39.5764 },
    'Kilifi': { lat: -3.6305, lng: 39.8499 },
    'Ngoingwa': { lat: -1.0396, lng: 37.0900 },
    'Section 9': { lat: -1.0396, lng: 37.0900 },
    'Section 8': { lat: -1.0396, lng: 37.0900 },
    'CBD': { lat: -1.2864, lng: 36.8172 },
};

/**
 * Extract the person's name from a WordPress post title
 * E.g., "Caroline Nduta Sugar Mummy..." → "Caroline Nduta"
 * E.g., "Mary a sugar mummy in Nakuru..." → "Mary"
 */
export function extractName(title) {
    if (!title) return 'Unknown';

    // Clean HTML entities
    const clean = title.replace(/&#8217;/g, "'").replace(/&#8211;/g, "–").replace(/&amp;/g, '&').trim();

    // Common patterns:
    // 1. "Name Name Sugar Mummy..." or "Name Name Sugarmummy..."
    const sugarPattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:Sugar\s*[Mm]umm|sugar\s*[Mm]umm|Sugarmumm|sugarmumm|from|a\s+sugar|is\s+|wants|needs|looking)/i;
    const match1 = clean.match(sugarPattern);
    if (match1) return match1[1].trim();

    // 2. First name pattern: "Name, age,..." or "Name age..."
    const commaPattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*[,\s]+\d/;
    const match2 = clean.match(commaPattern);
    if (match2) return match2[1].trim();

    // 3. Just take the first 1-2 capitalized words
    const words = clean.split(/\s+/);
    const nameWords = [];
    for (const word of words) {
        if (/^[A-Z][a-z]+$/.test(word) && !['Sugar', 'Mummy', 'From', 'The', 'For', 'And', 'With', 'Wants', 'Needs', 'Looking', 'Is', 'In', 'A'].includes(word)) {
            nameWords.push(word);
            if (nameWords.length >= 2) break;
        } else if (nameWords.length > 0) {
            break;
        }
    }

    return nameWords.length > 0 ? nameWords.join(' ') : clean.split(/\s+/).slice(0, 2).join(' ');
}

/**
 * Extract location from post content and title
 */
export function extractLocation(content, title) {
    const searchText = `${title || ''} ${content || ''}`;

    for (const loc of KENYAN_LOCATIONS) {
        const regex = new RegExp(`\\b${loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(searchText)) {
            return loc;
        }
    }

    // Try to extract from "in [Location]" pattern
    const inPattern = /\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/;
    const match = searchText.match(inPattern);
    if (match) return match[1];

    return 'Kenya';
}

/**
 * Get coordinates for a location name
 */
export function getLocationCoords(locationName) {
    if (!locationName) return LOCATION_COORDS['Nairobi'];

    // Exact match
    if (LOCATION_COORDS[locationName]) return LOCATION_COORDS[locationName];

    // Partial match
    const lower = locationName.toLowerCase();
    for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
        if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
            return coords;
        }
    }

    // Default to Nairobi
    return LOCATION_COORDS['Nairobi'];
}

/**
 * Extract age from content
 */
export function extractAge(content) {
    if (!content) return null;

    const patterns = [
        /(\d{2})\s*(?:yr|year|years|yrs)\s*(?:old)?/i,
        /(?:age|aged)\s*[:=]?\s*(\d{2})/i,
        /(?:I'?m|am)\s+(\d{2})/i,
        /(\d{2})\s*[-–]\s*year/i,
    ];

    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
            const age = parseInt(match[1]);
            if (age >= 18 && age <= 80) return age;
        }
    }

    return null;
}

/**
 * Extract bio from excerpt or content
 */
export function extractBio(excerpt, content) {
    let text = excerpt || content || '';

    // Strip HTML tags
    text = text.replace(/<[^>]+>/g, '');
    // Decode entities
    text = text.replace(/&nbsp;/g, ' ').replace(/&#8217;/g, "'").replace(/&#8211;/g, '–').replace(/&amp;/g, '&').replace(/&hellip;/g, '...');
    // Remove "Continue reading" etc.
    text = text.replace(/continue\s+reading.*$/i, '').trim();
    // Trim
    if (text.length > 160) {
        text = text.substring(0, 157) + '...';
    }

    return text || 'Looking for a genuine connection. Tap to learn more.';
}

/**
 * Parse a WordPress post into a clean Profile object
 */
export function parseProfile(post) {
    const title = post.title?.rendered || '';
    const content = post.content?.rendered || '';
    const excerpt = post.excerpt?.rendered || '';

    // Get featured image URL
    let imageUrl = post.jetpack_featured_media_url || '';
    if (!imageUrl && post._embedded?.['wp:featuredmedia']?.[0]) {
        const media = post._embedded['wp:featuredmedia'][0];
        imageUrl = media.source_url || media.media_details?.sizes?.large?.source_url || '';
    }

    const name = extractName(title);
    const location = extractLocation(content, title);
    const age = extractAge(content) || extractAge(title);
    const bio = extractBio(excerpt, content);
    const coords = getLocationCoords(location);

    // View count: estimate based on post age + seeded randomness for consistency
    const postDate = post.date ? new Date(post.date) : new Date();
    const daysSincePost = Math.max(1, Math.floor((Date.now() - postDate.getTime()) / (1000 * 60 * 60 * 24)));
    const seed = post.id % 97; // Consistent per-post seed
    const baseViews = daysSincePost * (38 + seed);
    const views = baseViews + Math.floor(seed * 7.3);

    // Comment count from WP API (real-time)
    const commentCount = post.comment_count || (post._embedded?.replies?.[0]?.length) || 0;

    // Clean excerpt text
    const excerptText = excerpt.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&#8217;/g, "'").replace(/&hellip;/g, '...').replace(/continue\s+reading.*$/i, '').trim();

    return {
        wpId: post.id,
        name,
        age,
        location,
        bio,
        excerpt: excerptText,
        content: content,
        imageUrl,
        wpUrl: post.link || '',
        date: post.date || '',
        postDate: post.date || '',
        coords,
        views,
        commentCount,
    };
}

/**
 * Fetch profiles from WordPress with caching
 */
let profileCache = { data: null, timestamp: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchProfiles(page = 1, perPage = 20) {
    const cacheKey = `${page}-${perPage}`;

    if (
        profileCache.data &&
        profileCache.key === cacheKey &&
        Date.now() - profileCache.timestamp < CACHE_TTL
    ) {
        return profileCache.data;
    }

    try {
        const url = `${WP_API_URL}/posts?page=${page}&per_page=${perPage}&_embed&orderby=date&order=desc`;
        const res = await fetch(url, {
            next: { revalidate: 300 },
            headers: { 'Accept': 'application/json' },
        });

        if (!res.ok) {
            throw new Error(`WordPress API error: ${res.status}`);
        }

        const posts = await res.json();
        const totalPages = parseInt(res.headers.get('X-WP-TotalPages') || '1');
        const totalPosts = parseInt(res.headers.get('X-WP-Total') || '0');

        const profiles = posts.map(parseProfile).filter(p => p.imageUrl);

        const result = { profiles, totalPages, totalPosts, page };

        profileCache = { data: result, timestamp: Date.now(), key: cacheKey };

        return result;
    } catch (error) {
        console.error('Failed to fetch profiles:', error);
        return { profiles: [], totalPages: 0, totalPosts: 0, page };
    }
}

/**
 * Fetch a single profile by WordPress post ID
 */
export async function fetchSingleProfile(postId) {
    try {
        const url = `${WP_API_URL}/posts/${postId}?_embed`;
        const res = await fetch(url, {
            next: { revalidate: 300 },
            headers: { 'Accept': 'application/json' },
        });
        if (!res.ok) return null;
        const post = await res.json();
        return parseProfile(post);
    } catch (error) {
        console.error('Failed to fetch single profile:', error);
        return null;
    }
}
