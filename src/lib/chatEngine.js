// ============================================================
// AI Chat Engine — Human-Like Conversation System
// ============================================================
// RULES:
// - Never reply instantly (min 6s, sometimes 1-3 min)
// - Short replies, imperfect flow, hesitation
// - Mirror user language (English / Sheng / Swahili)
// - Never use "platform", "policy", "admin" language early
// - Hard stop at 4 replies → natural escalation + lock
// - No paragraphs. Ever.

// ============================================================
// INTENT DETECTION
// ============================================================
const INTENT_PATTERNS = {
    greeting: /^(hi|hey|hello|sasa|niaje|sema|mambo|uko|vipi|sup|yo|hola|habari|how are you|whats up|what's up|hii)/i,
    hookup: /(meet|hook\s?up|tukutane|come over|wanna chill|let'?s link|can we meet|nikuone|ntakuja|tunakutana|leo|tonight|date|hang out|unataka|tukutane wapi)/i,
    contact_request: /(number|namba|phone|whatsapp|wa\b|call me|text me|inbox|dm|socials|insta|snap|telegram|tg|nipe num|patia num|email|piga simu)/i,
    location: /(uko wapi|where are you|location|place|area|town|city|unaishi wapi|side gani|which area|karibu|far|unakaa wapi|hood)/i,
    meet_today: /(today|leo|tonight|saa hii|right now|now|kesho|tomorrow|this evening|afternoon|morning|usiku)/i,
    doubt: /(real|fake|bot|scam|legit|genuine|uhalisi|uko real|are you real|ni kweli|kweli|for real|fr\b|serious)/i,
    emotional: /(lonely|miss|feel|love|connection|genuine|honest|tired|fake people|nakupenda|nafikiri|napenda|moyo|heart)/i,
    interest: /(like you|beautiful|hot|fine|pretty|sexy|handsome|cute|gorgeous|unapendeza|mrembo|safi|dope|fire)/i,
};

export function detectIntent(message) {
    const msg = message.trim();
    for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
        if (pattern.test(msg)) return intent;
    }
    return 'general';
}

// ============================================================
// LANGUAGE DETECTION
// ============================================================
const SHENG_WORDS = /\b(niaje|sasa|mambo|sema|vipi|poa|fiti|maze|buda|msupa|dem|bro|siste|uko|niko|nipe|patia|tunaeza|inawezekana|bana|si mbaya|nakuona|vibe|leo|karibu|wapi|kweli|pole|busy|kidogo|rada|mbaya|sawa|aje|ndio|si|tukutane|nikuone|ntakuja)\b/i;

function isSheng(msg) {
    return SHENG_WORDS.test(msg);
}

// ============================================================
// HUMAN MESSAGE BANK — Rotated randomly, never in order
// ============================================================

const GREETINGS = [
    "Hey 😊", "Hi…", "Niaje", "Hey, how are you?", "Sasa",
    "Hey you", "Hi, hope you're okay", "Hii", "Hey",
    "Hi 😊 how are you?", "Sasa, uko sawa?",
];

const GREETINGS_SHENG = [
    "Niaje", "Sasa", "Mambo", "Sema", "Vipi leo",
    "Uko aje?", "Hey, uko fiti?", "Sasa bro",
];

const CONNECTION = [
    "You seem calm, I like that",
    "Your profile stood out honestly",
    "You don't sound like most people here",
    "I'm glad you texted me",
    "You have a nice vibe",
    "There's something about you",
    "You seem different",
    "I like your energy",
];

const CONNECTION_SHENG = [
    "Una vibe poa",
    "Nakuona",
    "Si mbaya",
    "Tunaeza connect",
    "Uko rada",
    "Vibe yako ni safi",
];

const HOOKUP_RESPONSES = [
    "Honestly… yes. I'd like that.",
    "I'm open to meeting, I just prefer doing things properly.",
    "I feel like we could connect in real life.",
    "Yeah… I wouldn't mind that.",
    "Hmm… let me think about it",
    "I'm thinking about it…",
    "Actually yeah, why not",
];

const HOOKUP_FOLLOWUP = [
    "I just don't rush these things.",
    "I've had bad experiences before.",
    "I like being careful.",
    "Let me be honest… I'm interested but I'm careful",
    "I need to feel safe first",
];

const CONTACT_BLOCK = [
    "I usually don't share my number immediately.",
    "I prefer when things are confirmed first.",
    "Let's do it the safe way.",
    "Hmm… not yet. I'm still getting to know you.",
    "I don't give out my number just like that",
    "Let me be comfortable first",
    "Not now… maybe after we sort things out",
];

const CONTACT_FOLLOWUP = [
    "Mary G usually helps with proper connection.",
    "Once things are sorted we can exchange contacts",
    "There's a way we can do this properly",
];

const LOCATION_RESPONSES = [
    "Niko karibu tu",
    "Around your area",
    "Not far honestly",
    "Close enough to meet easily",
    "Somewhere around",
    "Near your side",
];

const LOCATION_FOLLOWUP = [
    "But I don't like sharing exact location immediately.",
    "I'll tell you more once we connect properly",
    "Let's sort things out first",
];

const MEET_TODAY = [
    "Today could work actually…",
    "If everything is sorted, yes.",
    "Later in the evening maybe.",
    "I'm free today, surprisingly.",
    "Leo inawezekana",
    "Hmm… what time were you thinking?",
    "Not sure yet but maybe",
];

const DOUBT_RESPONSES = [
    "😂 yeah, I'm real",
    "I get that question a lot",
    "I'm real, just private",
    "I don't like rushing strangers",
    "Lol I understand… but yes I'm real",
    "If I wasn't real would I be talking like this? 😂",
    "I know it's hard to trust online. I get it",
];

const EMOTIONAL = [
    "I like honesty",
    "Real connection is rare these days",
    "I'm tired of fake people honestly",
    "That's why I'm careful",
    "Same… I just want something real",
    "Exactly. That's why I'm here",
    "I feel you on that",
];

const INTEREST_RESPONSES = [
    "Aww thank you 😊",
    "You're sweet",
    "Haha stop 😂",
    "Thanks… you're not bad yourself",
    "I appreciate that",
    "That made me smile ngl",
    "Asante 😊",
];

const GENERAL_RESPONSES = [
    "Hmm…",
    "Sawa",
    "Okay",
    "I see",
    "Yeah",
    "Tell me more",
    "Interesting",
    "Mmh okay",
    "Go on…",
    "Alright",
    "Hmm let me think",
    "😊",
    "Okay I hear you",
    "Mm sawa",
];

const GENERAL_SHENG = [
    "Sawa tu",
    "Poa",
    "Fiti",
    "Ehe",
    "Mm okay",
    "Sawa",
    "Nice",
    "Uko sawa?",
    "Maze…",
];

// ESCALATION (4th reply only — natural, warm)
const ESCALATION_MESSAGES = [
    "I'm actually interested in meeting you.",
    "Let's not lose this.",
    "Mary G helps confirm connections here.",
    "Once she approves us, we can continue freely.",
];

const ESCALATION_ALT = [
    "If you want us to meet, just request connection through Mary G.",
    "That way everything is clean and safe.",
];

const ESCALATION_SHENG = [
    "Bana nawant tukutane for real",
    "Tueze through Mary G iwe sawa",
    "Niko interested… Mary G atasort connection",
    "Request connection through Mary G tuendelee",
];

// ============================================================
// RANDOM PICK HELPER (never repeats last used)
// ============================================================
const _lastPicked = {};
function pick(arr, key) {
    if (!arr || arr.length === 0) return '';
    if (arr.length === 1) return arr[0];
    let idx;
    do {
        idx = Math.floor(Math.random() * arr.length);
    } while (idx === _lastPicked[key] && arr.length > 2);
    _lastPicked[key] = idx;
    return arr[idx];
}

// ============================================================
// GENERATE AI RESPONSE
// ============================================================
export function generateResponse(userMessage, replyCount, conversationHistory = []) {
    const intent = detectIntent(userMessage);
    const sheng = isSheng(userMessage);

    // 4th reply = escalation + lock
    if (replyCount >= 3) {
        return buildEscalation(sheng);
    }

    // Sometimes send two short messages (split response)
    const shouldSplit = Math.random() < 0.3 && replyCount > 0;

    let messages = [];

    switch (intent) {
        case 'greeting':
            if (replyCount === 0) {
                messages.push(pick(sheng ? GREETINGS_SHENG : GREETINGS, 'greet'));
                // Sometimes add a connection line
                if (Math.random() < 0.5) {
                    messages.push(pick(sheng ? CONNECTION_SHENG : CONNECTION, 'conn'));
                }
            } else {
                messages.push(pick(sheng ? GENERAL_SHENG : GENERAL_RESPONSES, 'gen'));
            }
            break;

        case 'hookup':
            messages.push(pick(HOOKUP_RESPONSES, 'hook'));
            if (shouldSplit) {
                messages.push(pick(HOOKUP_FOLLOWUP, 'hookf'));
            }
            break;

        case 'contact_request':
            messages.push(pick(CONTACT_BLOCK, 'cont'));
            if (replyCount >= 2) {
                messages.push(pick(CONTACT_FOLLOWUP, 'contf'));
            }
            break;

        case 'location':
            messages.push(pick(LOCATION_RESPONSES, 'loc'));
            if (shouldSplit) {
                messages.push(pick(LOCATION_FOLLOWUP, 'locf'));
            }
            break;

        case 'meet_today':
            messages.push(pick(MEET_TODAY, 'today'));
            if (shouldSplit && replyCount >= 1) {
                messages.push(pick(HOOKUP_FOLLOWUP, 'hookf2'));
            }
            break;

        case 'doubt':
            messages.push(pick(DOUBT_RESPONSES, 'doubt'));
            break;

        case 'emotional':
            messages.push(pick(EMOTIONAL, 'emo'));
            break;

        case 'interest':
            messages.push(pick(INTEREST_RESPONSES, 'int'));
            if (shouldSplit) {
                messages.push(pick(CONNECTION, 'conn2'));
            }
            break;

        default:
            if (replyCount === 0) {
                messages.push(pick(sheng ? GREETINGS_SHENG : GREETINGS, 'greet2'));
                if (Math.random() < 0.4) {
                    messages.push(pick(sheng ? CONNECTION_SHENG : CONNECTION, 'conn3'));
                }
            } else {
                messages.push(pick(sheng ? GENERAL_SHENG : GENERAL_RESPONSES, 'gen2'));
                // Occasionally steer toward connection
                if (replyCount >= 2 && Math.random() < 0.4) {
                    messages.push(pick(CONNECTION, 'conn4'));
                }
            }
    }

    return {
        messages,
        intent,
        isEscalation: false,
        replyCount: replyCount + 1,
    };
}

function buildEscalation(sheng) {
    const pool = sheng ? ESCALATION_SHENG : ESCALATION_MESSAGES;
    const messages = [pick(pool, 'esc')];

    // Add the "request connection" CTA line
    if (!sheng) {
        messages.push(pick(ESCALATION_ALT, 'escalt'));
    }

    return {
        messages,
        intent: 'escalation',
        isEscalation: true,
        replyCount: 4,
    };
}

// ============================================================
// TYPING DELAY CALCULATOR — human-like
// ============================================================
export function calculateTypingDelay(messageText, isFirstMessage = false) {
    const len = messageText.length;

    // Base delay: 6-15 seconds
    let baseDelay = 6000 + Math.random() * 9000;

    // Longer messages = slightly more time
    if (len > 30) baseDelay += 2000;
    if (len > 60) baseDelay += 3000;

    // First message in convo = slightly longer (reading profile)
    if (isFirstMessage) baseDelay += 4000;

    // Random chance of long delay (simulates being busy)
    if (Math.random() < 0.15) {
        baseDelay += 15000 + Math.random() * 45000; // 15-60s extra
    }

    // Random chance of very quick reply (already typing)
    if (Math.random() < 0.1) {
        baseDelay = 4000 + Math.random() * 3000; // 4-7s
    }

    return Math.round(baseDelay);
}

// Delay between split messages (second bubble)
export function calculateSplitDelay() {
    return 2000 + Math.random() * 4000; // 2-6s between bubbles
}

// Delay before "Seen" appears
export function calculateSeenDelay() {
    return 8000 + Math.random() * 25000; // 8-33s
}

// Delay between "Seen" and "Typing..."
export function calculatePreTypingDelay() {
    return 5000 + Math.random() * 20000; // 5-25s after seen
}

// ============================================================
// CONTENT FILTER — Block sensitive info
// ============================================================
const SENSITIVE_PATTERNS = [
    /(\+?\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4})/g, // phone
    /(\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b)/g, // email
    /((?:https?:\/\/|www\.)\S+)/gi, // URLs
    /(@[a-zA-Z0-9_]{3,})/g, // social handles
];

export function filterContent(text) {
    let filtered = text;
    let blocked = false;

    for (const pattern of SENSITIVE_PATTERNS) {
        if (pattern.test(filtered)) {
            blocked = true;
            filtered = filtered.replace(pattern, '***');
        }
        pattern.lastIndex = 0; // reset global regex
    }

    return { text: filtered, blocked };
}

// ============================================================
// ONLINE STATUS SIMULATION
// ============================================================
export function getOnlineStatus() {
    const rand = Math.random();
    if (rand < 0.6) return { status: 'online', text: 'Online' };
    if (rand < 0.85) {
        const mins = Math.floor(Math.random() * 30) + 1;
        return { status: 'away', text: `Last seen ${mins}m ago` };
    }
    return { status: 'away', text: 'Last seen recently' };
}

// ============================================================
// ADMIN MARY G — Telegram link
// ============================================================
export function getApprovalUrl(profileName) {
    const msg = encodeURIComponent(`Hi Admin Mary G, I'd like to connect with ${profileName || 'a match'} from GS App.`);
    return `https://t.me/GSADMINMARYGAGENCY?text=${msg}`;
}
