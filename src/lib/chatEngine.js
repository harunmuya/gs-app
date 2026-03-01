'use client';

// ============================================================
// AI Chat Engine — Human-like conversation system
// Intent detection, response pools, content filtering, escalation
// ============================================================

// ---- Intent Detection Patterns ----
const INTENT_PATTERNS = {
    greeting: {
        patterns: [
            /\b(hi|hello|hey|hii+|helo|helloo|heey|sup|yo)\b/i,
            /\b(sasa|niaje|habari|mambo|vipi|sema|uko?)\b/i,
            /\b(good\s*(morning|afternoon|evening|night))\b/i,
            /\b(hiya|howdy|what'?s\s*up|wazzup|wassup)\b/i,
            /^(hi+|hey+|hello+|sasa+|yo+)[\s!?.]*$/i,
        ],
        weight: 1,
    },
    hookup: {
        patterns: [
            /\b(hook\s*up|hookup|tukutane|meet\s*(up)?|let'?s\s*meet)\b/i,
            /\b(can\s*we\s*(meet|link|connect|hook))\b/i,
            /\b(wanna\s*(meet|hang|chill|link))\b/i,
            /\b(i\s*want\s*(to\s*)?(meet|see)\s*you)\b/i,
            /\b(nikuone|tuonane|tutane|tupatane|meet\s*leo)\b/i,
            /\b(available\s*(to|for)\s*meet)\b/i,
        ],
        weight: 3,
    },
    contact_request: {
        patterns: [
            /\b(number|namba|simu|phone|call\s*me)\b/i,
            /\b(whatsapp|whats\s*app|wa\s*number|watsap)\b/i,
            /\b(telegram|tg|insta|instagram|ig|snap|snapchat)\b/i,
            /\b(give\s*me\s*(your|ur)\s*(number|contact|phone|digits))\b/i,
            /\b(share\s*(your|ur)\s*(number|contact|phone))\b/i,
            /\b(can\s*i\s*(get|have)\s*(your|ur)\s*(number|contact|phone|digits))\b/i,
            /\b(socials|social\s*media|dm\s*me)\b/i,
        ],
        weight: 5,
    },
    location: {
        patterns: [
            /\b(uko\s*wapi|where\s*(are\s*you|u\s*at|do\s*you\s*live))\b/i,
            /\b(location|area|place|town|city|estate|hood)\b/i,
            /\b(which\s*(area|town|city|side))\b/i,
            /\b(unaishi\s*wapi|unatoka\s*wapi|uko\s*side\s*gani)\b/i,
            /\b(come\s*(from|to)|karibu\s*na)\b/i,
        ],
        weight: 2,
    },
    meeting_today: {
        patterns: [
            /\b(today|leo|sasa\s*hivi|right\s*now|tonight|usiku)\b/i,
            /\b(tukutane\s*leo|meet\s*today|today\s*evening)\b/i,
            /\b(can\s*we\s*meet\s*(today|tonight|now))\b/i,
            /\b(free\s*(today|tonight|now)|are\s*you\s*free)\b/i,
            /\b(come\s*(over|today)|leo\s*tutane)\b/i,
        ],
        weight: 3,
    },
    emotional: {
        patterns: [
            /\b(lonely|alone|miss\s*(you|someone)|feel\s*(sad|lonely|empty))\b/i,
            /\b(i\s*need\s*(someone|love|company|companion))\b/i,
            /\b(love\s*you|i\s*like\s*you|you'?re?\s*(beautiful|pretty|handsome|cute))\b/i,
            /\b(heartbreak|hurt|single|divorced|separated)\b/i,
            /\b(you\s*make\s*me\s*(happy|smile|feel))\b/i,
            /\b(thinking\s*(of|about)\s*you|miss\s*talking)\b/i,
        ],
        weight: 2,
    },
    verification: {
        patterns: [
            /\b(are\s*you\s*real|you\s*real|is\s*this\s*real)\b/i,
            /\b(fake|scam|bot|catfish|fraud|legit)\b/i,
            /\b(prove\s*(it|yourself)|show\s*(me|proof))\b/i,
            /\b(can\s*i\s*trust\s*you)\b/i,
            /\b(ni\s*ukweli|wewe\s*ni\s*real|hii\s*ni\s*legit)\b/i,
        ],
        weight: 4,
    },
    interest: {
        patterns: [
            /\b(interested|attractive|beautiful|handsome|fine|hot)\b/i,
            /\b(like\s*(your\s*profile|you)|you\s*look\s*(good|nice|amazing))\b/i,
            /\b(tell\s*me\s*(about|more)|what\s*(do\s*you\s*(do|like)|are\s*you\s*into))\b/i,
            /\b(what\s*are\s*you\s*looking\s*for)\b/i,
            /\b(age|how\s*old|umri)\b/i,
        ],
        weight: 1,
    },
};

// ---- Response Pools (Human-like, varied tones) ----
function getResponsePool(matchName, userName) {
    const mn = matchName || 'dear';
    const un = userName || 'dear';

    return {
        greeting: [
            `Hi ${un}! 😊 Thanks for reaching out. How are you doing?`,
            `Hello! Nice to hear from you. I was hoping someone interesting would message me today.`,
            `Hey ${un}, glad you said hi! Tell me more about yourself.`,
            `Hi there! I'm ${mn}. I loved your profile 😊 What are you looking for?`,
            `Sasa ${un}! Mambo vipi? I'm happy you messaged.`,
            `Hey! I've been a bit bored today, so your message made me smile 😊`,
            `Hello ${un}! I'm doing well. And you?`,
            `Hi! I saw your profile earlier and was hoping you'd reach out ☺️`,
        ],
        hookup: [
            `Honestly yes… I would love for us to meet. I feel like we can connect well. But we need to follow the secure process first ❤️`,
            `I would really like that. I am open to meeting if everything is confirmed properly through the platform.`,
            `Yes, I am interested in connecting 😊 Let's make it safe and real. We need approval first though.`,
            `I'd love to meet up ${un}. But for safety, we need to go through the proper channel first.`,
            `Definitely open to it! I just need us to handle the connection process properly. I value my safety ❤️`,
            `Mmh I like that energy 😊 Yes let's do it. But the right way, through the admin for approval.`,
        ],
        contact_request: [
            `For security and legitimacy, direct contact sharing is not allowed here ${un}. I hope you understand 🙏`,
            `I'd love to give you my number but the platform doesn't allow that yet. We need connection approval first.`,
            `All connections are initiated through Admin Mary G for safety. Once approved, we can exchange details officially ❤️`,
            `Please request hookup approval so we can exchange details the right way. It's for both our safety.`,
            `I totally get it, but sharing contacts directly isn't possible yet. Let's get approved first 😊`,
            `Trust me, I want to talk outside too! But we have to follow the process. Request approval and we're good 🙏`,
        ],
        location: [
            `I am around your area actually 😊 But we need connection approval before we can plan anything specific.`,
            `I'm based in Nairobi, not far at all. Once Admin confirms us, we can plan the exact meeting spot.`,
            `I'm close! I'd rather share my exact location after our connection is approved. Makes sense right?`,
            `I live within Nairobi area. We can definitely meet easily once the process is done ❤️`,
            `Niko around ${un}. Si we just get the approval done then I share exactly where I am?`,
            `I'm not far from you at all. Let's just handle the formalities first 😊`,
        ],
        meeting_today: [
            `If our connection is approved today, I am available later 😊 Let's make it happen!`,
            `Yes I am okay with meeting today after approval. I'm free in the evening.`,
            `Today works for me ${un}! But we need to get approved first. It doesn't take long.`,
            `I'm actually free today. If you request approval now, we could meet by evening ❤️`,
            `Leo niko free kabisa! Just get the approval and tutaonana 😊`,
            `I'd love that! I'm available. Let's just get the okay from admin first.`,
        ],
        emotional: [
            `I understand… sometimes we just need someone genuine. That is why I am here ${un} ❤️`,
            `Aww, I feel the same way sometimes. It's hard finding real connections these days.`,
            `You deserve someone who truly cares ${un}. I'm glad we matched 😊`,
            `I know that feeling too well. But hey, that's why we're both here, right? To find something real.`,
            `Don't worry ${un}, you're not alone in this. I'm here and I'm interested in getting to know you better ❤️`,
            `That's really sweet. I appreciate your honesty. Let's see where this goes 😊`,
        ],
        verification: [
            `Of course I am real 😊 I just value privacy and security. That's why this platform requires proper verification.`,
            `Yes I am 100% real ${un}. My profile is verified. I prefer the proper process because I've had bad experiences before.`,
            `I understand the concern. But yes, I'm very real. That's exactly why I use the secure approval process 🙏`,
            `Ni ukweli kabisa ${un}! I am real. The admin process is there to protect both of us ❤️`,
            `Haha I get that a lot! Yes I'm real. You can even verify through Admin Mary G.`,
            `I promise you I'm real 😊 I just don't share personal details until we're properly connected.`,
        ],
        interest: [
            `I'm looking for a genuine connection ${un}. Someone mature, respectful, and ready for something real 😊`,
            `Well, I'm a fun person to be around. I love good conversations, good food, and honest people ❤️`,
            `I'm glad you find me attractive! Tell me about yourself too. What do you do?`,
            `Thank you! You're quite interesting yourself 😊 I'd love to know more about you.`,
            `I appreciate the compliment ${un}! I'm looking for someone who's serious and ready to connect.`,
            `Aww that's sweet! I like someone who's confident. What are you looking for here?`,
        ],
        general: [
            `That's interesting ${un} 😊 Tell me more.`,
            `I see! So what else would you like to know about me?`,
            `Haha okay 😊 I like your vibe. Let's keep chatting.`,
            `Nice! I'm enjoying our conversation ${un}.`,
            `Oh really? That's good to know. What else is on your mind?`,
            `I appreciate you sharing that with me ❤️ Keep talking to me.`,
            `Mmh that's cool ${un}. I'm curious to know more about you 😊`,
            `I like that! Tell me something else about yourself.`,
        ],
        escalation: [
            `I would really like us to continue this privately ${un} ❤️ Kindly request connection approval from Admin Mary G so we can proceed officially. I'm excited about us!`,
            `${un}, I've really enjoyed chatting with you! Let's make this real. Please initiate hookup request through Admin Mary G for confirmation 🙏`,
            `I feel a genuine connection with you ${un} 😊 To take this further, we need to go through Admin Mary G for approval. It's quick and it means we can finally meet!`,
            `This has been lovely ${un}! I'm ready to take the next step. Please contact Admin Mary G to get our connection approved so we can exchange details ❤️`,
            `${un}, you seem like exactly what I've been looking for 😊 Let's not lose this connection. Request approval through Admin Mary G and we'll be set!`,
        ],
    };
}

// ---- Intent Detection ----
export function detectIntent(message) {
    if (!message || typeof message !== 'string') return 'general';

    const text = message.toLowerCase().trim();
    let bestIntent = 'general';
    let bestWeight = 0;

    for (const [intent, config] of Object.entries(INTENT_PATTERNS)) {
        for (const pattern of config.patterns) {
            if (pattern.test(text)) {
                if (config.weight > bestWeight) {
                    bestWeight = config.weight;
                    bestIntent = intent;
                }
                break; // Found match for this intent, check next intent
            }
        }
    }

    return bestIntent;
}

// ---- Content Filter ----
const BLOCKED_PATTERNS = [
    { regex: /(\+?\d{1,4}[\s-]?\d{3,4}[\s-]?\d{3,4}[\s-]?\d{0,4})/g, type: 'phone' },
    { regex: /\b\d{10,13}\b/g, type: 'phone' },
    { regex: /\b07\d{8}\b/g, type: 'phone' },         // Kenyan numbers
    { regex: /\b\+254\d{9}\b/g, type: 'phone' },       // Kenyan intl format
    { regex: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, type: 'email' },
    { regex: /\b(whatsapp|whats\s*app|wa)\s*:?\s*(\+?\d[\d\s-]{6,})/gi, type: 'whatsapp' },
    { regex: /\b(telegram|tg)\s*:?\s*@?[\w]{3,}/gi, type: 'telegram' },
    { regex: /\b(instagram|ig|insta)\s*:?\s*@?[\w.]{3,}/gi, type: 'instagram' },
    { regex: /@[\w.]{3,}\b/g, type: 'social' },
    { regex: /https?:\/\/[^\s]+/gi, type: 'url' },
    { regex: /www\.[^\s]+/gi, type: 'url' },
];

export function filterContent(message) {
    if (!message) return { filtered: message, wasBlocked: false, blockType: null };

    let filtered = message;
    let wasBlocked = false;
    let blockType = null;

    for (const { regex, type } of BLOCKED_PATTERNS) {
        // Reset regex lastIndex for global patterns
        regex.lastIndex = 0;
        if (regex.test(filtered)) {
            wasBlocked = true;
            blockType = type;
            regex.lastIndex = 0;
            filtered = filtered.replace(regex, '[Contact hidden for security]');
        }
    }

    return { filtered, wasBlocked, blockType };
}

// ---- Content Warning Messages ----
export function getBlockWarning(blockType) {
    const warnings = {
        phone: '⚠️ For security reasons, phone number sharing is not allowed. Kindly request official connection approval via Admin Mary G.',
        email: '⚠️ Email sharing is restricted for your safety. Please request connection approval through Admin Mary G.',
        whatsapp: '⚠️ WhatsApp sharing is not permitted here. For a secure connection, please contact Admin Mary G.',
        telegram: '⚠️ Telegram sharing is not allowed. Please use the official approval process via Admin Mary G.',
        instagram: '⚠️ Social media sharing is restricted. Kindly request connection approval through Admin Mary G.',
        social: '⚠️ Social media handles cannot be shared here. Please request approval through Admin Mary G.',
        url: '⚠️ External links are not allowed for security reasons. Contact Admin Mary G for connection approval.',
    };
    return warnings[blockType] || warnings.phone;
}

// ---- Generate AI Response ----
export function generateResponse(userMessage, matchName, userName, replyNumber) {
    const pool = getResponsePool(matchName, userName);
    const intent = detectIntent(userMessage);

    // Reply 4 = escalation, regardless of intent
    if (replyNumber >= 4) {
        return {
            text: pickRandom(pool.escalation),
            intent: 'escalation',
            isEscalation: true,
        };
    }

    // Contact request always gets contact_request response
    if (intent === 'contact_request') {
        return {
            text: pickRandom(pool.contact_request),
            intent,
            isEscalation: false,
        };
    }

    // Map intent to response pool
    const responses = pool[intent] || pool.general;
    return {
        text: pickRandom(responses),
        intent,
        isEscalation: false,
    };
}

// ---- Typing Delay Calculator ----
export function calculateTypingDelay(responseText) {
    // Base delay 2-3s + 40ms per character, capped at 8s
    const base = 2000 + Math.random() * 1000;
    const charDelay = (responseText?.length || 50) * 40;
    const jitter = (Math.random() - 0.5) * 2000; // ±1s randomness
    const total = base + charDelay + jitter;
    return Math.min(8000, Math.max(2000, total));
}

// ---- Random Human Delay (occasional 1-2 min delay) ----
export function shouldAddLongDelay() {
    // 15% chance of a longer "human" delay (30-90 seconds)
    return Math.random() < 0.15;
}

export function getLongDelay() {
    return 30000 + Math.random() * 60000; // 30-90 seconds
}

// ---- Online Status Simulation ----
const LAST_SEEN_OPTIONS = [
    'Online now',
    'Active now',
    'Last seen just now',
    'Last seen 1 min ago',
    'Last seen 2 min ago',
    'Last seen 5 min ago',
];

export function getOnlineStatus() {
    // 70% chance online, 30% chance "last seen X min ago"
    if (Math.random() < 0.7) {
        return { status: 'online', text: pickRandom(LAST_SEEN_OPTIONS.slice(0, 2)) };
    }
    return { status: 'away', text: pickRandom(LAST_SEEN_OPTIONS.slice(2)) };
}

// ---- Reply Tracking ----
const REPLY_COUNTS = {};

export function getReplyCount(conversationId) {
    return REPLY_COUNTS[conversationId] || 0;
}

export function incrementReplyCount(conversationId) {
    REPLY_COUNTS[conversationId] = (REPLY_COUNTS[conversationId] || 0) + 1;
    return REPLY_COUNTS[conversationId];
}

export function setReplyCount(conversationId, count) {
    REPLY_COUNTS[conversationId] = count;
}

export function isChatLocked(conversationId) {
    return getReplyCount(conversationId) >= 4;
}

// ---- Max Replies ----
export const MAX_FREE_REPLIES = 4;

// ---- Admin Approval URL ----
export function getApprovalUrl(userName) {
    const msg = encodeURIComponent(
        `Hi Admin Mary G, I would like to request connection approval.\n\nName: ${userName || 'User'}\nPlatform: GS App\n\nPlease process my request. Thank you!`
    );
    return `https://t.me/GSADMINMARYGAGENCY?text=${msg}`;
}

// ---- Helper ----
function pickRandom(arr) {
    if (!arr || arr.length === 0) return '';
    return arr[Math.floor(Math.random() * arr.length)];
}
