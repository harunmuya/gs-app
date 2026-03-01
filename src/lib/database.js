'use client';

// ============================================================
// IndexedDB Database Layer — Replaces localStorage
// Provides structured, persistent storage with query support
// ============================================================

const DB_NAME = 'gsm_dating_db';
const DB_VERSION = 1;

const STORES = {
    users: 'users',           // Registered user accounts
    sessions: 'sessions',     // Login sessions
    likes: 'likes',           // Liked profiles
    matches: 'matches',       // Mutual matches
    passes: 'passes',         // Passed profiles
    saved: 'saved',           // Saved/bookmarked profiles
    activity: 'activity',     // Activity feed
    messages: 'messages',     // Chat messages (per conversation)
    conversations: 'conversations', // Chat conversation metadata
    settings: 'settings',     // User settings
    verification: 'verification',  // Verification data + docs
    subscriptions: 'subscriptions', // Subscription status
    profileCache: 'profileCache',  // Cached WP profiles
    notifications: 'notifications', // In-app notifications
    reports: 'reports',       // Report/block data
};

let dbInstance = null;
let dbPromise = null;

// ---- Open / Initialize DB ----
function openDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        if (typeof window === 'undefined') {
            reject(new Error('IndexedDB not available on server'));
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Users store — keyed by email
            if (!db.objectStoreNames.contains(STORES.users)) {
                const userStore = db.createObjectStore(STORES.users, { keyPath: 'email' });
                userStore.createIndex('id', 'id', { unique: true });
                userStore.createIndex('displayName', 'display_name', { unique: false });
            }

            // Sessions — keyed by token
            if (!db.objectStoreNames.contains(STORES.sessions)) {
                const sessionStore = db.createObjectStore(STORES.sessions, { keyPath: 'token' });
                sessionStore.createIndex('email', 'email', { unique: false });
                sessionStore.createIndex('expiresAt', 'expiresAt', { unique: false });
            }

            // Likes — keyed by composite
            if (!db.objectStoreNames.contains(STORES.likes)) {
                const likeStore = db.createObjectStore(STORES.likes, { keyPath: 'id' });
                likeStore.createIndex('userEmail', 'userEmail', { unique: false });
                likeStore.createIndex('wpId', 'wpId', { unique: false });
                likeStore.createIndex('likedAt', 'likedAt', { unique: false });
            }

            // Matches
            if (!db.objectStoreNames.contains(STORES.matches)) {
                const matchStore = db.createObjectStore(STORES.matches, { keyPath: 'id' });
                matchStore.createIndex('userEmail', 'userEmail', { unique: false });
                matchStore.createIndex('wpId', 'wpId', { unique: false });
                matchStore.createIndex('matchedAt', 'matchedAt', { unique: false });
            }

            // Passes
            if (!db.objectStoreNames.contains(STORES.passes)) {
                const passStore = db.createObjectStore(STORES.passes, { keyPath: 'id' });
                passStore.createIndex('userEmail', 'userEmail', { unique: false });
            }

            // Saved profiles
            if (!db.objectStoreNames.contains(STORES.saved)) {
                const savedStore = db.createObjectStore(STORES.saved, { keyPath: 'id' });
                savedStore.createIndex('userEmail', 'userEmail', { unique: false });
                savedStore.createIndex('wpId', 'wpId', { unique: false });
            }

            // Activity feed
            if (!db.objectStoreNames.contains(STORES.activity)) {
                const activityStore = db.createObjectStore(STORES.activity, { keyPath: 'id' });
                activityStore.createIndex('userEmail', 'userEmail', { unique: false });
                activityStore.createIndex('type', 'type', { unique: false });
                activityStore.createIndex('timestamp', 'timestamp', { unique: false });
            }

            // Messages (individual chat messages)
            if (!db.objectStoreNames.contains(STORES.messages)) {
                const msgStore = db.createObjectStore(STORES.messages, { keyPath: 'id' });
                msgStore.createIndex('conversationId', 'conversationId', { unique: false });
                msgStore.createIndex('timestamp', 'timestamp', { unique: false });
                msgStore.createIndex('senderId', 'senderId', { unique: false });
            }

            // Conversations (chat threads)
            if (!db.objectStoreNames.contains(STORES.conversations)) {
                const convStore = db.createObjectStore(STORES.conversations, { keyPath: 'id' });
                convStore.createIndex('userEmail', 'userEmail', { unique: false });
                convStore.createIndex('matchWpId', 'matchWpId', { unique: false });
                convStore.createIndex('lastMessageAt', 'lastMessageAt', { unique: false });
            }

            // Settings
            if (!db.objectStoreNames.contains(STORES.settings)) {
                db.createObjectStore(STORES.settings, { keyPath: 'userEmail' });
            }

            // Verification
            if (!db.objectStoreNames.contains(STORES.verification)) {
                const verStore = db.createObjectStore(STORES.verification, { keyPath: 'userEmail' });
                verStore.createIndex('status', 'status', { unique: false });
            }

            // Subscriptions
            if (!db.objectStoreNames.contains(STORES.subscriptions)) {
                db.createObjectStore(STORES.subscriptions, { keyPath: 'userEmail' });
            }

            // Profile cache
            if (!db.objectStoreNames.contains(STORES.profileCache)) {
                const cacheStore = db.createObjectStore(STORES.profileCache, { keyPath: 'wpId' });
                cacheStore.createIndex('cachedAt', 'cachedAt', { unique: false });
            }

            // Notifications
            if (!db.objectStoreNames.contains(STORES.notifications)) {
                const notifStore = db.createObjectStore(STORES.notifications, { keyPath: 'id' });
                notifStore.createIndex('userEmail', 'userEmail', { unique: false });
                notifStore.createIndex('read', 'read', { unique: false });
                notifStore.createIndex('createdAt', 'createdAt', { unique: false });
            }

            // Reports
            if (!db.objectStoreNames.contains(STORES.reports)) {
                const reportStore = db.createObjectStore(STORES.reports, { keyPath: 'id' });
                reportStore.createIndex('reporterEmail', 'reporterEmail', { unique: false });
                reportStore.createIndex('targetWpId', 'targetWpId', { unique: false });
            }
        };

        request.onsuccess = (event) => {
            dbInstance = event.target.result;
            resolve(dbInstance);
        };

        request.onerror = (event) => {
            console.error('IndexedDB open error:', event.target.error);
            reject(event.target.error);
        };
    });

    return dbPromise;
}


// ============================================================
// Generic CRUD Operations
// ============================================================

async function getDB() {
    if (dbInstance) return dbInstance;
    return openDB();
}

// Put (insert or update)
async function dbPut(storeName, data) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Get by key
async function dbGet(storeName, key) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

// Get all from store
async function dbGetAll(storeName) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

// Get all by index value
async function dbGetByIndex(storeName, indexName, value) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(value);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

// Delete by key
async function dbDelete(storeName, key) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Clear entire store
async function dbClear(storeName) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Count items in store
async function dbCount(storeName) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}


// ============================================================
// Password Hashing (using Web Crypto API)
// ============================================================

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + '__gsm_salt_2024__');
    // Use Web Crypto API if available (HTTPS contexts)
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        try {
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch { /* fallback below */ }
    }
    // Fallback: simple hash for HTTP/non-secure contexts
    let hash = 0;
    const str = password + '__gsm_salt_2024__';
    for (let i = 0; i < str.length; i++) {
        const chr = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return 'fb_' + Math.abs(hash).toString(16).padStart(8, '0') + '_' + str.length.toString(16);
}

async function verifyPassword(password, hash) {
    const computed = await hashPassword(password);
    return computed === hash;
}


// ============================================================
// Session Management
// ============================================================

function generateToken() {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

const SESSION_KEY = 'gsm_session_token';
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

async function createSession(email) {
    const token = generateToken();
    const session = {
        token,
        email,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + SESSION_DURATION).toISOString(),
    };
    await dbPut(STORES.sessions, session);
    if (typeof window !== 'undefined') {
        localStorage.setItem(SESSION_KEY, token);
    }
    return token;
}

async function getActiveSession() {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem(SESSION_KEY);
    if (!token) return null;

    try {
        const session = await dbGet(STORES.sessions, token);
        if (!session) return null;
        if (new Date(session.expiresAt) < new Date()) {
            await dbDelete(STORES.sessions, token);
            localStorage.removeItem(SESSION_KEY);
            return null;
        }
        return session;
    } catch {
        return null;
    }
}

async function destroySession() {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem(SESSION_KEY);
    if (token) {
        try { await dbDelete(STORES.sessions, token); } catch { }
    }
    localStorage.removeItem(SESSION_KEY);
}


// ============================================================
// User Account Operations
// ============================================================

async function registerUser({ email, password, displayName, gender, age, location }) {
    const existing = await dbGet(STORES.users, email);
    if (existing) {
        throw new Error('An account with this email already exists. Please log in.');
    }

    const passwordHash = await hashPassword(password);
    const user = {
        id: btoa(email),
        email,
        passwordHash,
        display_name: displayName || email.split('@')[0],
        gender: gender || '',
        age: age || '',
        location: location || '',
        avatar_url: '',
        photos: [],
        bio: '',
        interests: [],
        orientation: '',
        isPublic: true,
        isOnline: true,
        lastActive: new Date().toISOString(),
        profileCompletion: 0,
        profileViews: 0,
        likesReceived: 0,
        created_at: new Date().toISOString(),
    };

    await dbPut(STORES.users, user);

    // Initialize settings
    await dbPut(STORES.settings, {
        userEmail: email,
        isPublic: true,
        locationEnabled: false,
        notifications: true,
        showOnline: true,
        showAge: true,
        emailNotifications: false,
        darkMode: false,
    });

    // Initialize subscription
    await dbPut(STORES.subscriptions, {
        userEmail: email,
        plan: 'free',
        features: ['browse', 'like', 'comment'],
        startDate: new Date().toISOString(),
        expiresAt: null,
    });

    return user;
}

async function loginUser(email, password) {
    const user = await dbGet(STORES.users, email);
    if (!user) {
        throw new Error('No account found with this email. Please register first.');
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
        throw new Error('Incorrect password. Please try again.');
    }

    // Update last active
    user.lastActive = new Date().toISOString();
    user.isOnline = true;
    await dbPut(STORES.users, user);

    return user;
}

async function updateUser(email, updates) {
    const user = await dbGet(STORES.users, email);
    if (!user) return null;
    const updated = { ...user, ...updates, lastActive: new Date().toISOString() };
    // Recalculate profile completion
    updated.profileCompletion = calcProfileCompletion(updated);
    await dbPut(STORES.users, updated);
    return updated;
}

function calcProfileCompletion(user) {
    let score = 0;
    if (user.display_name && user.display_name !== user.email?.split('@')[0]) score += 15;
    if (user.avatar_url || (user.photos && user.photos.length > 0)) score += 20;
    if (user.bio && user.bio.length > 10) score += 15;
    if (user.age) score += 10;
    if (user.location) score += 10;
    if (user.gender) score += 10;
    if (user.interests && user.interests.length > 0) score += 10;
    if (user.photos && user.photos.length >= 3) score += 10;
    return Math.min(100, score);
}


// ============================================================
// Like / Match / Pass Operations
// ============================================================

async function addLikeDB(userEmail, profile) {
    const id = `${userEmail}__${profile.wpId}`;
    const existing = await dbGet(STORES.likes, id);
    if (existing) return existing;
    const like = {
        id,
        userEmail,
        wpId: profile.wpId,
        ...profile,
        likedAt: new Date().toISOString(),
        super: false,
    };
    await dbPut(STORES.likes, like);
    return like;
}

async function addSuperLikeDB(userEmail, profile) {
    const id = `${userEmail}__${profile.wpId}`;
    const like = {
        id,
        userEmail,
        wpId: profile.wpId,
        ...profile,
        likedAt: new Date().toISOString(),
        super: true,
    };
    await dbPut(STORES.likes, like);
    return like;
}

async function addMatchDB(userEmail, profile, score = 85) {
    const id = `${userEmail}__${profile.wpId}`;
    const existing = await dbGet(STORES.matches, id);
    if (existing) return existing;
    const match = {
        id,
        userEmail,
        wpId: profile.wpId,
        ...profile,
        score,
        matchedAt: new Date().toISOString(),
    };
    await dbPut(STORES.matches, match);

    // Create conversation for this match
    const convId = `conv__${userEmail}__${profile.wpId}`;
    const existingConv = await dbGet(STORES.conversations, convId);
    if (!existingConv) {
        await dbPut(STORES.conversations, {
            id: convId,
            userEmail,
            matchWpId: profile.wpId,
            matchName: profile.name || 'Match',
            matchImage: profile.imageUrl || '',
            matchLocation: profile.location || '',
            lastMessage: '',
            lastMessageAt: new Date().toISOString(),
            unreadCount: 0,
        });
    }

    return match;
}

async function addPassDB(userEmail, wpId) {
    const id = `${userEmail}__${wpId}`;
    await dbPut(STORES.passes, { id, userEmail, wpId, passedAt: new Date().toISOString() });
}

async function isSwipedDB(userEmail, wpId) {
    const likeId = `${userEmail}__${wpId}`;
    const passId = `${userEmail}__${wpId}`;
    const like = await dbGet(STORES.likes, likeId);
    if (like) return true;
    const pass = await dbGet(STORES.passes, passId);
    return !!pass;
}

async function getUserLikes(userEmail) {
    return dbGetByIndex(STORES.likes, 'userEmail', userEmail);
}

async function getUserMatches(userEmail) {
    return dbGetByIndex(STORES.matches, 'userEmail', userEmail);
}

async function clearPassesDB(userEmail) {
    const passes = await dbGetByIndex(STORES.passes, 'userEmail', userEmail);
    for (const p of passes) {
        await dbDelete(STORES.passes, p.id);
    }
}


// ============================================================
// Saved Profiles
// ============================================================

async function saveProfileDB(userEmail, profile) {
    const id = `${userEmail}__${profile.wpId}`;
    await dbPut(STORES.saved, {
        id, userEmail, wpId: profile.wpId, ...profile,
        savedAt: new Date().toISOString(),
    });
}

async function unsaveProfileDB(userEmail, wpId) {
    const id = `${userEmail}__${wpId}`;
    await dbDelete(STORES.saved, id);
}

async function isProfileSavedDB(userEmail, wpId) {
    const id = `${userEmail}__${wpId}`;
    const saved = await dbGet(STORES.saved, id);
    return !!saved;
}

async function getUserSaved(userEmail) {
    return dbGetByIndex(STORES.saved, 'userEmail', userEmail);
}


// ============================================================
// Activity Feed
// ============================================================

async function addActivityDB(userEmail, type, data) {
    const entry = {
        id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userEmail,
        type,
        ...data,
        timestamp: new Date().toISOString(),
        read: false,
    };
    await dbPut(STORES.activity, entry);
    return entry;
}

async function getUserActivity(userEmail) {
    const all = await dbGetByIndex(STORES.activity, 'userEmail', userEmail);
    return all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 100);
}

async function markAllActivityReadDB(userEmail) {
    const all = await dbGetByIndex(STORES.activity, 'userEmail', userEmail);
    for (const item of all) {
        if (!item.read) {
            item.read = true;
            await dbPut(STORES.activity, item);
        }
    }
}


// ============================================================
// Chat Messages
// ============================================================

async function sendMessageDB(conversationId, senderId, senderName, text) {
    const msg = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        conversationId,
        senderId,
        senderName,
        text,
        timestamp: new Date().toISOString(),
        status: 'sent', // sent, delivered, seen
    };
    await dbPut(STORES.messages, msg);

    // Update conversation lastMessage
    const conv = await dbGet(STORES.conversations, conversationId);
    if (conv) {
        conv.lastMessage = text.substring(0, 100);
        conv.lastMessageAt = msg.timestamp;
        await dbPut(STORES.conversations, conv);
    }

    return msg;
}

async function getConversationMessages(conversationId) {
    const msgs = await dbGetByIndex(STORES.messages, 'conversationId', conversationId);
    return msgs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

async function getUserConversations(userEmail) {
    const convs = await dbGetByIndex(STORES.conversations, 'userEmail', userEmail);
    return convs.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
}

async function markMessagesSeenDB(conversationId, viewerEmail) {
    const msgs = await dbGetByIndex(STORES.messages, 'conversationId', conversationId);
    for (const msg of msgs) {
        if (msg.senderId !== viewerEmail && msg.status !== 'seen') {
            msg.status = 'seen';
            await dbPut(STORES.messages, msg);
        }
    }
    // Reset unread count on conversation
    const conv = await dbGet(STORES.conversations, conversationId);
    if (conv) {
        conv.unreadCount = 0;
        await dbPut(STORES.conversations, conv);
    }
}


// ============================================================
// Inbox Messages (system/AI messages — legacy support)
// ============================================================

async function addInboxMessageDB(userEmail, msg) {
    const entry = {
        id: `inbox-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userEmail,
        ...msg,
        timestamp: new Date().toISOString(),
        read: false,
    };
    await dbPut(STORES.notifications, entry);
    return entry;
}

async function getUserInboxMessages(userEmail) {
    const all = await dbGetByIndex(STORES.notifications, 'userEmail', userEmail);
    return all.sort((a, b) => new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp)).slice(0, 200);
}

async function markAllInboxReadDB(userEmail) {
    const all = await dbGetByIndex(STORES.notifications, 'userEmail', userEmail);
    for (const item of all) {
        if (!item.read) {
            item.read = true;
            await dbPut(STORES.notifications, item);
        }
    }
}


// ============================================================
// Verification
// ============================================================

async function getVerificationDB(userEmail) {
    return dbGet(STORES.verification, userEmail);
}

async function saveVerificationDB(userEmail, data) {
    await dbPut(STORES.verification, { userEmail, ...data });
}


// ============================================================
// Settings
// ============================================================

async function getSettingsDB(userEmail) {
    return dbGet(STORES.settings, userEmail);
}

async function updateSettingsDB(userEmail, updates) {
    const existing = await dbGet(STORES.settings, userEmail);
    const updated = { ...(existing || { userEmail }), ...updates };
    await dbPut(STORES.settings, updated);
    return updated;
}


// ============================================================
// Subscriptions
// ============================================================

async function getSubscriptionDB(userEmail) {
    return dbGet(STORES.subscriptions, userEmail);
}

async function updateSubscriptionDB(userEmail, planData) {
    const existing = await dbGet(STORES.subscriptions, userEmail);
    const updated = { ...(existing || { userEmail }), ...planData };
    await dbPut(STORES.subscriptions, updated);
    return updated;
}


// ============================================================
// Reports / Blocks
// ============================================================

async function reportUserDB(reporterEmail, targetWpId, reason) {
    const id = `report-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await dbPut(STORES.reports, {
        id,
        reporterEmail,
        targetWpId,
        reason,
        type: 'report',
        createdAt: new Date().toISOString(),
    });
}

async function blockUserDB(reporterEmail, targetWpId) {
    const id = `block-${reporterEmail}-${targetWpId}`;
    await dbPut(STORES.reports, {
        id,
        reporterEmail,
        targetWpId,
        type: 'block',
        createdAt: new Date().toISOString(),
    });
}

async function isBlockedDB(reporterEmail, targetWpId) {
    const id = `block-${reporterEmail}-${targetWpId}`;
    const block = await dbGet(STORES.reports, id);
    return !!block;
}

async function getBlockedUsersDB(reporterEmail) {
    const all = await dbGetByIndex(STORES.reports, 'reporterEmail', reporterEmail);
    return all.filter(r => r.type === 'block').map(r => r.targetWpId);
}


// ============================================================
// Migration from localStorage (one-time on first load)
// ============================================================

async function migrateFromLocalStorage() {
    if (typeof window === 'undefined') return;

    const migrated = localStorage.getItem('gsm_db_migrated');
    if (migrated) return;

    try {
        // Migrate user
        const userStr = localStorage.getItem('gsm_user');
        if (userStr) {
            const user = JSON.parse(userStr);
            if (user && user.email) {
                // Set a default password for migrated users
                let passwordHash = '';
                try {
                    passwordHash = await hashPassword('changeme123');
                } catch {
                    passwordHash = 'migrated_no_hash';
                }
                const migratedUser = {
                    ...user,
                    passwordHash,
                    profileCompletion: calcProfileCompletion(user),
                    profileViews: 0,
                    likesReceived: 0,
                    isOnline: true,
                    lastActive: new Date().toISOString(),
                };
                await dbPut(STORES.users, migratedUser);

                // Migrate likes
                try {
                    const likesStr = localStorage.getItem('gsm_likes');
                    if (likesStr) {
                        const likes = JSON.parse(likesStr);
                        for (const like of (likes || [])) {
                            await dbPut(STORES.likes, {
                                id: `${user.email}__${like.wpId}`,
                                userEmail: user.email,
                                ...like,
                            });
                        }
                    }
                } catch (e) { console.warn('[DB] Likes migration skipped:', e); }

                // Migrate matches
                try {
                    const matchesStr = localStorage.getItem('gsm_matches');
                    if (matchesStr) {
                        const matches = JSON.parse(matchesStr);
                        for (const match of (matches || [])) {
                            await addMatchDB(user.email, match, match.score || 85);
                        }
                    }
                } catch (e) { console.warn('[DB] Matches migration skipped:', e); }

                // Migrate settings
                try {
                    const settingsStr = localStorage.getItem('gsm_settings');
                    if (settingsStr) {
                        const settings = JSON.parse(settingsStr);
                        await dbPut(STORES.settings, { userEmail: user.email, ...settings });
                    }
                } catch (e) { console.warn('[DB] Settings migration skipped:', e); }

                // Migrate verification
                try {
                    const verStr = localStorage.getItem('gsm_verification');
                    if (verStr) {
                        const status = JSON.parse(verStr);
                        await dbPut(STORES.verification, { userEmail: user.email, status });
                    }
                } catch (e) { console.warn('[DB] Verification migration skipped:', e); }

                // Create session for migrated user
                try {
                    await createSession(user.email);
                } catch (e) { console.warn('[DB] Session creation skipped:', e); }
            }
        }

        localStorage.setItem('gsm_db_migrated', 'true');
        console.log('[DB] Migration from localStorage complete');
    } catch (err) {
        console.error('[DB] Migration error:', err);
        // Still mark as migrated to prevent re-attempts
        try { localStorage.setItem('gsm_db_migrated', 'true'); } catch { }
    }
}


// ============================================================
// Delete all user data
// ============================================================

async function deleteAllUserData(userEmail) {
    // Delete from each store
    const stores = [STORES.likes, STORES.matches, STORES.passes, STORES.saved, STORES.activity, STORES.notifications, STORES.reports];
    for (const store of stores) {
        const items = await dbGetByIndex(store, 'userEmail', userEmail);
        for (const item of items) {
            await dbDelete(store, item.id || item.userEmail);
        }
    }

    // Delete conversations and their messages
    const convs = await dbGetByIndex(STORES.conversations, 'userEmail', userEmail);
    for (const conv of convs) {
        const msgs = await dbGetByIndex(STORES.messages, 'conversationId', conv.id);
        for (const msg of msgs) {
            await dbDelete(STORES.messages, msg.id);
        }
        await dbDelete(STORES.conversations, conv.id);
    }

    // Delete user, settings, verification, subscription
    await dbDelete(STORES.users, userEmail);
    await dbDelete(STORES.settings, userEmail);
    await dbDelete(STORES.verification, userEmail);
    await dbDelete(STORES.subscriptions, userEmail);

    // Destroy session
    await destroySession();
}


// ============================================================
// Exports
// ============================================================

export {
    openDB,
    STORES,
    // Generic
    dbPut, dbGet, dbGetAll, dbGetByIndex, dbDelete, dbClear, dbCount,
    // Auth
    hashPassword, verifyPassword, generateToken,
    createSession, getActiveSession, destroySession,
    registerUser, loginUser, updateUser, calcProfileCompletion,
    // Likes / Matches
    addLikeDB, addSuperLikeDB, addMatchDB, addPassDB,
    isSwipedDB, getUserLikes, getUserMatches, clearPassesDB,
    // Saved
    saveProfileDB, unsaveProfileDB, isProfileSavedDB, getUserSaved,
    // Activity
    addActivityDB, getUserActivity, markAllActivityReadDB,
    // Chat
    sendMessageDB, getConversationMessages, getUserConversations, markMessagesSeenDB,
    // Inbox
    addInboxMessageDB, getUserInboxMessages, markAllInboxReadDB,
    // Verification
    getVerificationDB, saveVerificationDB,
    // Settings
    getSettingsDB, updateSettingsDB,
    // Subscriptions
    getSubscriptionDB, updateSubscriptionDB,
    // Reports
    reportUserDB, blockUserDB, isBlockedDB, getBlockedUsersDB,
    // Migration
    migrateFromLocalStorage,
    // Cleanup
    deleteAllUserData,
    // Session key constant
    SESSION_KEY,
};
