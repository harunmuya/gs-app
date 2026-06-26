// WordPress API — uses the custom GS App API plugin for speed
// Plugin endpoints: /wp-json/gs-app/v1/profiles, /comments/{id}, /comment

const WP_BASE = process.env.NEXT_PUBLIC_WP_API_URL?.replace('/wp/v2', '') || 'https://genuinesugarmummies.co.ke/wp-json';
const GS_API = `${WP_BASE}/gs-app/v1`;
const WP_API = `${WP_BASE}/wp/v2`;

// Convert Jetpack CDN URLs to direct WordPress URLs for WebView compatibility
// i0.wp.com/genuinesugarmummies.co.ke/path/image.jpg?... → genuinesugarmummies.co.ke/path/image.jpg
function normalizeImageUrl(url) {
    if (!url) return '';
    try {
        // Clean up the URL
        let cleaned = url.trim();

        // If it's a Jetpack CDN URL, keep it — it's a reliable CDN
        // Just ensure we have good quality params
        const jetpackMatch = cleaned.match(/https?:\/\/i\d\.wp\.com\/(.+)/);
        if (jetpackMatch) {
            // Keep the CDN URL but optimize params
            const base = cleaned.split('?')[0];
            return `${base}?w=800&quality=80&strip=info`;
        }

        // For direct WordPress URLs, use as-is
        if (cleaned.includes('genuinesugarmummies.co.ke')) {
            return cleaned;
        }

        return cleaned;
    } catch {
        return url;
    }
}

// Kenyan cities/towns for location extraction
const KENYAN_LOCATIONS = [
    'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Ruiru', 'Kikuyu',
    'Thika', 'Naivasha', 'Kakamega', 'Kisii', 'Kitale', 'Athi River', 'Mlolongo',
    'Garissa', 'Malindi', 'Ngong', 'Rongai', 'Karen', 'Westlands', 'Kilimani',
    'Langata', 'South B', 'South C', 'Roysambu', 'Kasarani', 'Embakasi',
    'Juja', 'Kiambu', 'Nyeri', 'Machakos', 'Meru', 'Nanyuki', 'Diani',
    'Kilifi', 'Voi', 'Kericho', 'Homabay', 'Migori', 'Bomet', 'Webuye',
    'Wajir', 'Limuru', 'Lodwar', 'Mandera', 'Narok', 'Isiolo', 'Marsabit',
    'Lamu', 'Watamu', 'Bamburi', 'Nyali',
    'Lavington', 'Eastleigh', 'Parklands', 'Muthaiga', 'Runda', 'Gigiri',
    'Syokimau', 'Kangundo', 'Ngoingwa', 'Section 9', 'Section 8', 'Kenol',
    'Makongeni', 'Thika Road', 'Mombasa Road', 'Ngong Road', 'Waiyaki Way',
    'CBD', 'Industrial Area', 'Upper Hill', 'Hurlingham', 'Kileleshwa',
    'Riverside', 'Spring Valley', 'Loresho', 'Mountain View', 'Zimmerman',
    'Kahawa', 'Utawala', 'Donholm', 'Buruburu', 'Umoja', 'Pipeline',
    'Fedha', 'Tassia'
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

const STOP_WORDS = new Set(['Sugar', 'Mummy', 'From', 'The', 'For', 'And', 'With', 'Wants', 'Needs', 'Looking', 'Is', 'In', 'A', 'An', 'Her', 'His', 'She', 'He', 'Who', 'That', 'This', 'Rich', 'Hot', 'Meet', 'Available', 'Seeking', 'Mature', 'Beautiful', 'Wealthy', 'Single', 'Lonely', 'Real', 'Story', 'Success', 'Appreciation', 'Thanks', 'Compliment', 'Compliments', 'Couple', 'Couples', 'Review', 'Reviews', 'Testimonial', 'Testimonials', 'Feedback', 'Experience', 'Confession']);

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

function cleanProfileText(html) {
    return (html || '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#8217;/g, "'")
        .replace(/&#8211;/g, '-')
        .replace(/&amp;/g, '&')
        .replace(/&hellip;/g, '...')
        .replace(/\+?\d[\d\s().-]{7,}\d/g, '[Verified Contact]')
        .replace(/continue\s+reading.*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function shortProfileSentence(text, max = 170) {
    const cleaned = cleanProfileText(text)
        .replace(/\b(?:whatsapp|telegram|t\.me|escrow)\b[^.?!]*/gi, '')
        .replace(/admin\s+mary\s+g[^.?!]*/gi, '')
        .trim();
    if (!cleaned) return '';
    const sentences = cleaned
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 20 && !/whatsapp|telegram|t\.me|escrow|admin mary g/i.test(s));
    const best = sentences[0] || cleaned;
    return best.length > max ? `${best.slice(0, max - 3).trim()}...` : best;
}

export function buildProfileSummary({ title, content, excerpt, details }) {
    const cleanPiece = (value) => String(value || '')
        .replace(/\u2013|\u2014|â|â€“/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
    const pieces = [];
    if (details?.partnerType) pieces.push(`Looking for ${cleanPiece(details.partnerType)}`);
    if (details?.partnerAge) pieces.push(`Preferred age ${cleanPiece(details.partnerAge)}`);
    if (details?.relationshipType) pieces.push(cleanPiece(details.relationshipType));
    if (Array.isArray(details?.qualities) && details.qualities.length) {
        pieces.push(`Values ${details.qualities.slice(0, 3).map(cleanPiece).join(', ')}`);
    }

    const structured = pieces.filter(Boolean).join('. ');
    if (structured) return `${structured}.`;

    return shortProfileSentence(excerpt || content || title) || 'Looking for a genuine connection.';
}

// Common Kenyan female names for name-based gender detection
const FEMALE_NAMES = new Set([
    'amina', 'aisha', 'wanjiku', 'wambui', 'njeri', 'nyambura', 'wangari', 'muthoni', 'wairimu',
    'akinyi', 'adhiambo', 'atieno', 'anyango', 'awino', 'akoth', 'odhiambo',
    'mercy', 'grace', 'faith', 'hope', 'joy', 'charity', 'prudence', 'patience',
    'nancy', 'lucy', 'jane', 'mary', 'sarah', 'esther', 'ruth', 'naomi', 'martha',
    'anne', 'betty', 'carol', 'diana', 'elizabeth', 'gladys', 'hannah', 'irene',
    'joyce', 'lilian', 'margaret', 'millicent', 'monica', 'pauline', 'rose', 'salome',
    'susan', 'tabitha', 'veronica', 'winnie', 'agnes', 'alice', 'beatrice',
    'cynthia', 'dorothy', 'emily', 'florence', 'hellen', 'janet', 'josephine',
    'linet', 'lydia', 'nelly', 'purity', 'risper', 'sharon', 'sylvia', 'vivian',
    'chebet', 'chepkoech', 'jepkosgei', 'jepchirchir', 'cherono', 'chepkemoi',
    'mumbi', 'nyokabi', 'wacera', 'gathoni', 'waithera', 'wairagu',
    'fatma', 'halima', 'zainab', 'khadija', 'mariam', 'rehema', 'mwanaisha',
    'agnes', 'assumpta', 'consolata', 'damaris', 'everlyne', 'felistus',
]);

// Common Kenyan male names
const MALE_NAMES = new Set([
    'john', 'james', 'peter', 'david', 'samuel', 'daniel', 'joseph', 'michael', 'paul',
    'brian', 'kevin', 'dennis', 'patrick', 'martin', 'george', 'alex', 'simon', 'stephen',
    'william', 'robert', 'thomas', 'richard', 'charles', 'mark', 'anthony', 'andrew',
    'eric', 'felix', 'francis', 'gerald', 'henry', 'isaac', 'jackson', 'kennedy',
    'lawrence', 'moses', 'nicholas', 'oliver', 'raphael', 'timothy', 'vincent',
    'wycliffe', 'otieno', 'omondi', 'ochieng', 'kipchoge', 'kipruto', 'koech',
    'kiprop', 'kibet', 'langat', 'kiptoo', 'ruto', 'cheruiyot', 'bett',
    'kamau', 'mwangi', 'njoroge', 'kariuki', 'gitau', 'kimani', 'njenga',
    'mutua', 'musyoka', 'mwenda', 'muriithi', 'maina', 'ndung', 'karanja',
    'omar', 'hassan', 'ali', 'mohamed', 'ibrahim', 'yusuf', 'abdullahi',
    'evans', 'kelvin', 'fredrick', 'geoffrey', 'ronald', 'allan', 'collins',
    'emmanuel', 'godwin', 'harrison', 'japheth', 'lenny', 'nelson', 'oscar',
]);

// Detect if name is male
function isNameMale(name) {
    if (!name) return false;
    const first = name.trim().split(/\s+/)[0].toLowerCase();
    if (MALE_NAMES.has(first)) return true;
    if (FEMALE_NAMES.has(first)) return false;
    return false; // unknown
}

function isNameFemale(name) {
    if (!name) return false;
    const first = name.trim().split(/\s+/)[0].toLowerCase();
    return FEMALE_NAMES.has(first);
}

// Detect if post is a testimonial/review or couple/combination
export function isTestimonialPost(title, content, name = '') {
    const text = `${title || ''} ${content || ''} ${name || ''}`.toLowerCase();
    // Testimonial/Success story/Appreciation/Couple keywords
    const testimonialKeywords = [
        'testimoni', 'review', 'feedback', 'experience', 'confession',
        'success story', 'real story', 'appreciation', 'thanks', 'thanking',
        'compliment', 'couple', 'sugarboy and', 'sugarboy &', 'sugar boy',
        'sugar boy and', 'sugarboy and sugarmum', 'sugar boy and sugarmummy',
        'appreciation from', 'thanks to', 'thank you', 'appreciation message',
        'success match', 'we met', 'our story'
    ];
    return testimonialKeywords.some(keyword => text.includes(keyword)) ||
        /\b(real\s+story|success\s+story|appreciation|thanks|compliment|couple|sugarboy|sugar\s+boy)\b/i.test(name.toLowerCase());
}

// Detect profile type from title + content + name
export function detectProfileType(title, content, profileName) {
    // STEP 1: Check TITLE only (most reliable)
    const titleLower = (title || '').toLowerCase();

    // Title explicitly says sugar daddy
    if (/sugar\s*dadd/i.test(titleLower) && !/sugar\s*mumm/i.test(titleLower)) {
        return 'sugar_daddy';
    }
    // Title explicitly says sugar mummy
    if (/sugar\s*mumm/i.test(titleLower)) {
        return 'sugar_mummy';
    }
    // Title says daddy without mummy
    if (/\bdaddy\b/i.test(titleLower) && !/\bmumm/i.test(titleLower)) {
        return 'sugar_daddy';
    }
    // Title says mummy
    if (/\bmumm/i.test(titleLower) || /\bmama\b/i.test(titleLower)) {
        return 'sugar_mummy';
    }

    // STEP 2: Name-based detection fallback
    if (profileName) {
        if (isNameMale(profileName)) return 'sugar_daddy';
        if (isNameFemale(profileName)) return 'sugar_mummy';
    }

    // STEP 3: Default — this is genuinesugarmummies.co.ke
    return 'sugar_mummy';
}
export function extractProfileDetails(title, contentHtml) {
    let cleanText = (contentHtml || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#8217;/g, "'")
        .replace(/&#8211;/g, '–')
        .replace(/&amp;/g, '&')
        .replace(/&hellip;/g, '...')
        .replace(/\s+/g, ' ')
        .trim();

    const cleanTitle = (title || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#8217;/g, "'")
        .replace(/&#8211;/g, '–')
        .replace(/&amp;/g, '&')
        .replace(/&hellip;/g, '...')
        .replace(/\s+/g, ' ')
        .trim();

    // 1. Extract partner age range
    let partnerAge = null;
    const ageMatch = cleanText.match(/between\s+(\d{2})\s*(?:and|to)\s*(\d{2})/i);
    if (ageMatch) {
        partnerAge = `${ageMatch[1]} – ${ageMatch[2]} years`;
    } else {
        const altAgeMatch = cleanText.match(/(\d{2})\s*[-–]\s*(\d{2})\s*(?:years|yrs)?\s*old/i);
        if (altAgeMatch) {
            partnerAge = `${altAgeMatch[1]} – ${altAgeMatch[2]} years`;
        }
    }

    // 2. Extract partner type from TITLE first (highly accurate)
    let partnerType = null;
    const titleMatch = cleanTitle.match(/(?:seeking|looking for|searching for|needs)\s+(?:a\s+)?(.*?)(?:\s+for\s+a\s+|\s+in\s+|\s+to\s+|\s+from\s+|\s+after\s+|\.|$)/i);
    if (titleMatch) {
        partnerType = titleMatch[1].trim();
    }

    // If title match failed or is too generic, fallback to content
    if (!partnerType || partnerType.toLowerCase().length < 3 || partnerType.toLowerCase().includes('friend') || partnerType.toLowerCase().includes('wrong')) {
        const partnerMatch = cleanText.match(/(?:looking for|meet|seeking|want|find)\s+(?:a\s+)?([a-z\s,-]{3,60})\s+between/i);
        if (partnerMatch) {
            partnerType = partnerMatch[1].trim();
        } else {
            const fallbackPartnerMatch = cleanText.match(/(?:looking for|seeking|want|meet)\s+(?:a\s+)?([a-z\s,-]{3,40})\b/i);
            if (fallbackPartnerMatch) {
                partnerType = fallbackPartnerMatch[1].trim();
            }
        }
    }

    // Clean up partnerType common verbs/adverbs
    if (partnerType) {
        partnerType = partnerType
            .replace(/^(?:simple|genuine|loving|understanding|young|mature|real)\s+(?:man|gentleman|guy|woman|lady|girl|partner)\s+who\s+is\s+/i, '')
            .replace(/^(?:to\s+meet|to\s+find|to\s+have)\s+/i, '')
            .replace(/\s+who\s+(?:is|loves|knows|wants)\s+.*$/i, '')
            .trim();
        // Capitalize first letter of each word
        partnerType = partnerType.replace(/\b\w/g, c => c.toUpperCase());
    }

    // 3. Extract relationship type
    let relationshipType = null;
    // Strip negative sentences about relationships first
    const cleanTextForRel = cleanText.replace(/[^.]*?(?:don't|do not|not interested in|no\s+temporary|not\s+looking\s+for)[^.]*?relationship[^.]*?\./gi, '');

    // Check title first for relationship context (e.g. "for a Real Relationship")
    const titleRelMatch = cleanTitle.match(/for\s+(?:a\s+)?([a-z\s,-]{3,40})\s+relationship/i);
    if (titleRelMatch) {
        relationshipType = titleRelMatch[1].trim();
    } else {
        const relMatch = cleanTextForRel.match(/(?:ready for|build|sincere|committed|long-term)\s+(?:a\s+)?([a-z\s,-]{3,50})\s+relationship/i);
        if (relMatch) {
            relationshipType = relMatch[1].trim();
        } else {
            const altRelMatch = cleanTextForRel.match(/([a-z\s,-]{3,40})\s+relationship/i);
            if (altRelMatch) {
                relationshipType = altRelMatch[1].trim();
            }
        }
    }

    if (relationshipType) {
        relationshipType = relationshipType
            .replace(/^(?:a|an|the|my|our)\s+/i, '')
            .replace(/^(?:years\s+old\s+)?for\s+a\s+/i, '')
            .trim();

        // Split on connectors to avoid long trailing text
        relationshipType = relationshipType.split(/\s+(?:for|with|seeking|looking|from)\s+/i)[0].trim();

        // Filter out junk
        const relLower = relationshipType.toLowerCase();
        if (relLower.includes('kind of') || relLower.includes('what') || relLower.includes('want') || relLower.length < 3 || relLower.length > 40) {
            relationshipType = null;
        } else {
            relationshipType = relationshipType.replace(/\b\w/g, c => c.toUpperCase()) + ' Relationship';
        }
    }

    // 4. Extract qualities / interests
    let qualities = [];

    // Strip negative sentences before quality matching
    const cleanTextForQualities = cleanText.replace(/[^.]*?(?:don't|do not|no need|not)\s+(?:need|want|care)[^.]*?\./gi, '');

    // Look for "I need X, Y, and Z"
    const qualityDirectMatch = cleanTextForQualities.match(/(?:need|value|admire|appreciate|look for|trust in)\s+([a-z\s,]{3,80})(?:\.|\s+who|\s+that|\s+is)/i);
    if (qualityDirectMatch) {
        qualities = qualityDirectMatch[1]
            .split(/,|and/)
            .map(q => q.trim());
    }

    // Add positive keywords
    const keywords = ['loyalty', 'honesty', 'respect', 'effort', 'trust', 'understanding', 'caring', 'communication', 'faithfulness', 'patience', 'companionship'];
    keywords.forEach(kw => {
        if (new RegExp(`\\b${kw}\\b`, 'i').test(cleanTextForQualities)) {
            qualities.push(kw);
        }
    });

    // Clean qualities: filter out phrases containing verbs or pronouns
    qualities = qualities
        .map(q => q.replace(/\b\w/g, c => c.toUpperCase()))
        .filter(q => {
            const qLower = q.toLowerCase();
            if (qLower.includes(' ') && (/\b(is|be|to|are|have|do|you|i|my|me|who|your|we|they|he|she|it|us|them|our|their|an|the|a|in|at|on|for|with|by|from|about)\b/i.test(qLower))) {
                return false;
            }
            return q.length > 2 && q.length < 25;
        });

    // De-duplicate
    qualities = [...new Set(qualities)].slice(0, 4);

    return {
        partnerAge: partnerAge || '25 – 35 years',
        partnerType: partnerType || null,
        relationshipType: relationshipType || null,
        qualities: qualities.length > 0 ? qualities : ['Honesty', 'Loyalty', 'Respect']
    };
}

// ============================================================
// Parse profile from PLUGIN response (already simplified)
// ============================================================
export function parsePluginProfile(data) {
    const title = data.title || '';
    const excerptRaw = data.excerpt || '';
    const contentRaw = data.content || '';
    let imageUrl = normalizeImageUrl(data.imageUrl || '');

    // Fallback: extract first image from HTML content if imageUrl is empty
    if (!imageUrl && contentRaw) {
        const imgMatch = contentRaw.match(/<img[^>]+src=["']([^"']+)["']/);
        if (imgMatch) imageUrl = normalizeImageUrl(imgMatch[1]);
    }

    const name = extractName(title);
    const location = extractLocation(contentRaw + ' ' + title, title);
    const age = extractAge(contentRaw) || extractAge(title);
    const bio = extractBio(excerptRaw, contentRaw);
    const coords = getLocationCoords(location);

    const postDate = data.date ? new Date(data.date) : new Date();
    const daysSincePost = Math.max(1, Math.floor((Date.now() - postDate.getTime()) / (1000 * 60 * 60 * 24)));

    const extracted = extractProfileDetails(title, contentRaw);
    const summary = buildProfileSummary({ title, content: contentRaw, excerpt: excerptRaw, details: extracted });

    return {
        wpId: data.wpId,
        name,
        age,
        location,
        bio,
        excerpt: summary,
        aboutSummary: summary,
        content: summary,
        imageUrl,
        wpUrl: data.link || '',
        date: data.date || '',
        postDate: data.date || '',
        coords,
        commentCount: data.commentCount || 0,
        daysSincePost,
        profileType: detectProfileType(title, contentRaw, name),
        isTestimonial: isTestimonialPost(title, contentRaw, name),
        partnerAge: extracted.partnerAge,
        partnerType: extracted.partnerType,
        relationshipType: extracted.relationshipType,
        qualities: extracted.qualities,
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

    let imageUrl = normalizeImageUrl(post.jetpack_featured_media_url || '');
    if (!imageUrl && post._embedded?.['wp:featuredmedia']?.[0]) {
        const media = post._embedded['wp:featuredmedia'][0];
        imageUrl = normalizeImageUrl(media.source_url || media.media_details?.sizes?.large?.source_url || '');
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

    const extracted = extractProfileDetails(title, content);
    const summary = buildProfileSummary({ title, content, excerpt, details: extracted });

    return {
        wpId: post.id,
        name,
        age,
        location,
        bio,
        excerpt: summary || excerptText,
        aboutSummary: summary || excerptText,
        content: summary || excerptText,
        imageUrl,
        wpUrl: post.link || '',
        date: post.date || '',
        postDate: post.date || '',
        coords,
        commentCount: realCommentCount,
        daysSincePost,
        profileType: detectProfileType(title, content, name),
        isTestimonial: isTestimonialPost(title, content, name),
        partnerAge: extracted.partnerAge,
        partnerType: extracted.partnerType,
        relationshipType: extracted.relationshipType,
        qualities: extracted.qualities,
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
