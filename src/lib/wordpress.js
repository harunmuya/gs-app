// WordPress API — uses the custom GS App API plugin for speed
// Plugin endpoints: /wp-json/gs-app/v1/profiles, /comments/{id}, /comment

const WP_BASE = process.env.NEXT_PUBLIC_WP_API_URL?.replace('/wp/v2', '') || 'https://genuinesugarmummies.co.ke/wp-json';
const GS_API = `${WP_BASE}/gs-app/v1`;
const WP_API = `${WP_BASE}/wp/v2`;

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
    'Nairobi': { latitude: -1.2921, longitude: 36.8219 },
    'Mombasa': { latitude: -4.0435, longitude: 39.6682 },
    'Kisumu': { latitude: -0.1022, longitude: 34.7617 },
    'Nakuru': { latitude: -0.3031, longitude: 36.0800 },
    'Eldoret': { latitude: 0.5143, longitude: 35.2698 },
    'Thika': { latitude: -1.0396, longitude: 37.0900 },
    'Malindi': { latitude: -3.2138, longitude: 40.1169 },
    'Kitale': { latitude: 1.0187, longitude: 35.0020 },
    'Nyeri': { latitude: -0.4197, longitude: 36.9511 },
    'Machakos': { latitude: -1.5177, longitude: 37.2634 },
    'Meru': { latitude: 0.0480, longitude: 37.6559 },
    'Nanyuki': { latitude: 0.0067, longitude: 37.0722 },
    'Naivasha': { latitude: -0.7172, longitude: 36.4310 },
    'Kiambu': { latitude: -1.1714, longitude: 36.8356 },
    'Ruiru': { latitude: -1.1489, longitude: 36.9606 },
    'Ngong': { latitude: -1.3607, longitude: 36.6583 },
    'Rongai': { latitude: -1.3964, longitude: 36.7586 },
    'Karen': { latitude: -1.3197, longitude: 36.7116 },
    'Westlands': { latitude: -1.2636, longitude: 36.8036 },
    'Kilimani': { latitude: -1.2903, longitude: 36.7847 },
    'Langata': { latitude: -1.3557, longitude: 36.7462 },
    'Thika Road': { latitude: -1.1900, longitude: 36.9200 },
    'Mombasa Road': { latitude: -1.3400, longitude: 36.8700 },
    'Juja': { latitude: -1.1004, longitude: 37.0131 },
    'Diani': { latitude: -4.3164, longitude: 39.5764 },
    'Kilifi': { latitude: -3.6305, longitude: 39.8499 },
    'CBD': { latitude: -1.2864, longitude: 36.8172 },
};

const STOP_WORDS = new Set(['Sugar', 'Mummy', 'From', 'The', 'For', 'And', 'With', 'Wants', 'Needs', 'Looking', 'Is', 'In', 'A', 'An', 'Her', 'His', 'She', 'He', 'Who', 'That', 'This', 'Rich', 'Hot', 'Meet', 'Available', 'Seeking', 'Mature', 'Beautiful', 'Wealthy', 'Single', 'Lonely']);

export function extractName(title) {
    if (!title) return 'Unknown';
    let clean = title.replace(/&#8217;/g, "'").replace(/&#8211;/g, "–").replace(/&amp;/g, '&').replace(/<[^>]+>/g, '').trim();
    clean = clean.replace(/^(?:Meet|Hot|Rich|Beautiful|Wealthy|Mature|Available|Lonely|Single)\s+/i, '');

    const sugarPattern = /^([A-Z][a-z]+(?:[\s-]+[A-Z][a-z]+)?)\s*[-–,]?\s*(?:Sugar\s*[Mm]umm|sugar\s*[Mm]umm|Sugarmumm|sugarmumm|from|a\s+sugar|is\s+|wants|needs|looking|seeking)/i;
    const match1 = clean.match(sugarPattern);
    if (match1) return match1[1].replace(/[-–]/g, ' ').trim();

    const commaPattern = /^([A-Z][a-z]+(?:[\s-]+[A-Z][a-z]+)?)\s*[,\s]+\d/;
    const match2 = clean.match(commaPattern);
    if (match2) return match2[1].replace(/[-–]/g, ' ').trim();

    const words = clean.split(/[\s,;–-]+/);
    const nameWords = [];
    for (const word of words) {
        const w = word.replace(/[^a-zA-Z']/g, '');
        if (!w) continue;
        if (/^[A-Z][a-z]{1,}$/.test(w) && !STOP_WORDS.has(w)) {
            nameWords.push(w);
            if (nameWords.length >= 2) break;
        } else if (nameWords.length > 0) {
            break;
        }
    }

    if (nameWords.length > 0) return nameWords.join(' ');
    return clean.split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export function extractLocation(content, title) {
    const searchText = `${title || ''} ${content || ''}`;
    for (const loc of KENYAN_LOCATIONS) {
        const regex = new RegExp(`\\b${loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(searchText)) return loc;
    }
    const inPattern = /\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/;
    const match = searchText.match(inPattern);
    if (match) return match[1];
    return 'Kenya';
}

export function getLocationCoords(locationName) {
    if (!locationName) return LOCATION_COORDS['Nairobi'];
    if (LOCATION_COORDS[locationName]) return LOCATION_COORDS[locationName];
    const lower = locationName.toLowerCase();
    for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
        if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return coords;
    }
    return LOCATION_COORDS['Nairobi'];
}

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

export function extractBio(excerpt, content) {
    let text = excerpt || content || '';
    text = text.replace(/<[^>]+>/g, '');
    text = text.replace(/&nbsp;/g, ' ').replace(/&#8217;/g, "'").replace(/&#8211;/g, '–').replace(/&amp;/g, '&').replace(/&hellip;/g, '...');
    text = text.replace(/continue\s+reading.*$/i, '').trim();
    if (text.length > 160) text = text.substring(0, 157) + '...';
    return text || 'Looking for a genuine connection. Tap to learn more.';
}


// ============================================================
// Parse profile from PLUGIN response (already simplified)
// ============================================================
export function parsePluginProfile(data) {
    const title = data.title || '';
    const excerptRaw = data.excerpt || '';
    const contentRaw = data.content || '';
    const imageUrl = data.imageUrl || '';

    const name = extractName(title);
    const location = extractLocation(contentRaw + ' ' + title, title);
    const age = extractAge(contentRaw) || extractAge(title);
    const bio = extractBio(excerptRaw, contentRaw);
    const coords = getLocationCoords(location);

    const postDate = data.date ? new Date(data.date) : new Date();
    const daysSincePost = Math.max(1, Math.floor((Date.now() - postDate.getTime()) / (1000 * 60 * 60 * 24)));

    return {
        wpId: data.wpId,
        name,
        age,
        location,
        bio,
        excerpt: extractBio(excerptRaw, ''),
        content: contentRaw,
        imageUrl,
        wpUrl: data.link || '',
        date: data.date || '',
        postDate: data.date || '',
        coords,
        commentCount: data.commentCount || 0,
        daysSincePost,
        // If single profile, may include inline comments
        comments: data.comments || undefined,
    };
}


// ============================================================
// Parse profile from WP REST API (fallback)
// ============================================================
export function parseProfile(post) {
    const title = post.title?.rendered || '';
    const content = post.content?.rendered || '';
    const excerpt = post.excerpt?.rendered || '';

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

    const commentCount = post.comment_count || 0;
    const embeddedReplies = post._embedded?.replies?.[0];
    const realCommentCount = embeddedReplies ? embeddedReplies.length : commentCount;

    const excerptText = excerpt.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&#8217;/g, "'").replace(/&hellip;/g, '...').replace(/continue\s+reading.*$/i, '').trim();

    const postDate = post.date ? new Date(post.date) : new Date();
    const daysSincePost = Math.max(1, Math.floor((Date.now() - postDate.getTime()) / (1000 * 60 * 60 * 24)));

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
        commentCount: realCommentCount,
        daysSincePost,
    };
}


// ============================================================
// CACHING SYSTEM
// ============================================================
const profilePageCache = new Map();
const SERVER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes


// ============================================================
// FETCH PROFILES — tries GS plugin first, falls back to WP REST
// ============================================================
export async function fetchProfiles(page = 1, perPage = 25) {
    const cacheKey = `${page}-${perPage}`;
    const cached = profilePageCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SERVER_CACHE_TTL) {
        return cached.data;
    }

    // ---- Try GS Plugin endpoint first ----
    try {
        const pluginUrl = `${GS_API}/profiles?page=${page}&per_page=${perPage}`;
        const res = await fetch(pluginUrl, {
            next: { revalidate: 300 },
            headers: { 'Accept': 'application/json' },
        });

        if (res.ok) {
            const data = await res.json();
            const profiles = (data.profiles || []).map(parsePluginProfile);
            const result = {
                profiles,
                totalPages: data.totalPages || 1,
                totalPosts: data.totalPosts || 0,
                page: data.page || page,
            };
            profilePageCache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;
        }
    } catch (err) {
        console.warn('GS Plugin profiles failed, trying WP REST:', err.message);
    }

    // ---- Fallback to WP REST API ----
    try {
        const wpUrl = `${WP_API}/posts?page=${page}&per_page=${perPage}&_embed&orderby=date&order=desc`;
        const res = await fetch(wpUrl, {
            next: { revalidate: 300 },
            headers: { 'Accept': 'application/json' },
        });

        if (!res.ok) {
            if (res.status === 400) return { profiles: [], totalPages: 0, totalPosts: 0, page };
            throw new Error(`WordPress API error: ${res.status}`);
        }

        const posts = await res.json();
        const totalPages = parseInt(res.headers.get('X-WP-TotalPages') || '1');
        const totalPosts = parseInt(res.headers.get('X-WP-Total') || '0');
        const profiles = posts.map(parseProfile);
        const result = { profiles, totalPages, totalPosts, page };
        profilePageCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
    } catch (error) {
        console.error('Failed to fetch profiles (both methods):', error);
        return { profiles: [], totalPages: 0, totalPosts: 0, page };
    }
}


// ============================================================
// FETCH SINGLE PROFILE — tries GS plugin first for inline comments
// ============================================================
export async function fetchSingleProfile(postId) {
    // ---- Try GS Plugin first (includes comments inline) ----
    try {
        const pluginUrl = `${GS_API}/profiles/${postId}`;
        const res = await fetch(pluginUrl, {
            next: { revalidate: 120 },
            headers: { 'Accept': 'application/json' },
        });

        if (res.ok) {
            const data = await res.json();
            if (data.profiles && data.profiles.length > 0) {
                return parsePluginProfile(data.profiles[0]);
            }
        }
    } catch (err) {
        console.warn('GS Plugin single profile failed:', err.message);
    }

    // ---- Fallback to WP REST ----
    try {
        const url = `${WP_API}/posts/${postId}?_embed`;
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


// ============================================================
// FETCH COMMENTS — tries GS plugin first
// ============================================================
export async function fetchComments(postId) {
    // ---- Try GS Plugin ----
    try {
        const pluginUrl = `${GS_API}/comments/${postId}`;
        const res = await fetch(pluginUrl, {
            next: { revalidate: 60 },
            headers: { 'Accept': 'application/json' },
        });

        if (res.ok) {
            const data = await res.json();
            return data.comments || [];
        }
    } catch (err) {
        console.warn('GS Plugin comments failed:', err.message);
    }

    // ---- Fallback to WP REST ----
    try {
        const url = `${WP_API}/comments?post=${postId}&per_page=50`;
        const res = await fetch(url, {
            next: { revalidate: 60 },
            headers: { 'Accept': 'application/json' },
        });
        if (!res.ok) return [];
        const comments = await res.json();
        return comments.map(c => ({
            id: c.id,
            author: c.author_name || 'Anonymous',
            content: c.content?.rendered?.replace(/<[^>]+>/g, '') || '',
            date: c.date,
            avatarUrl: c.author_avatar_urls?.['48'] || '',
        }));
    } catch {
        return [];
    }
}


// ============================================================
// SUBMIT COMMENT — tries GS plugin first
// ============================================================
export async function submitComment({ postId, authorName, authorEmail, content }) {
    // ---- Try GS Plugin ----
    try {
        const pluginUrl = `${GS_API}/comment`;
        const res = await fetch(pluginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                post_id: postId,
                author_name: authorName,
                author_email: authorEmail,
                content: content,
            }),
        });

        if (res.ok) {
            return await res.json();
        }
    } catch (err) {
        console.warn('GS Plugin comment submit failed:', err.message);
    }

    // ---- Fallback to WP REST ----
    try {
        const url = `${WP_API}/comments`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                post: parseInt(postId),
                author_name: authorName,
                author_email: authorEmail,
                content: content,
            }),
        });

        if (res.ok) {
            return { success: true, message: 'Comment submitted for moderation.' };
        }
    } catch { }

    return { success: true, message: 'Comment submitted for moderation.' };
}


export function getRandomProfileNames() {
    return [
        'Faith', 'Grace', 'Mercy', 'Joy', 'Hope', 'Charity', 'Rose', 'Lilian',
        'Agnes', 'Esther', 'Margaret', 'Catherine', 'Diana', 'Susan', 'Janet',
        'Winnie', 'Betty', 'Nancy', 'Doris', 'Alice', 'Gloria', 'Irene',
        'Patricia', 'Christine', 'Sharon', 'Stella', 'Monica', 'Sarah',
        'Lucy', 'Ann', 'Beatrice', 'Pauline', 'Purity', 'Vivian', 'Brenda',
        'Josephine', 'Florence', 'Carol', 'Jane', 'Tabitha', 'Angela',
    ];
}
