'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

const AuthContext = createContext({});

const STORAGE_KEYS = {
    USER: 'gsm_user',
    LIKES: 'gsm_likes',
    MATCHES: 'gsm_matches',
    PASSES: 'gsm_passes',
    SAVED: 'gsm_saved',
    ACTIVITY: 'gsm_activity',
    SETTINGS: 'gsm_settings',
    GUEST: 'guest_mode',
};

function getStored(key, fallback = null) {
    if (typeof window === 'undefined') return fallback;
    try {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : fallback;
    } catch { return fallback; }
}

function setStored(key, value) {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { }
}

const DEFAULT_SETTINGS = {
    isPublic: true,
    locationEnabled: false,
    notifications: true,
    showOnline: true,
    showAge: true,
    emailNotifications: false,
};

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [guest, setGuest] = useState(false);
    const [loading, setLoading] = useState(true);
    const [likes, setLikes] = useState([]);
    const [matches, setMatches] = useState([]);
    const [passes, setPasses] = useState([]);
    const [saved, setSaved] = useState([]);
    const [activity, setActivity] = useState([]);
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);

    // Load from localStorage on mount
    useEffect(() => {
        setUser(getStored(STORAGE_KEYS.USER));
        setGuest(getStored(STORAGE_KEYS.GUEST, false));
        setLikes(getStored(STORAGE_KEYS.LIKES, []));
        setMatches(getStored(STORAGE_KEYS.MATCHES, []));
        setPasses(getStored(STORAGE_KEYS.PASSES, []));
        setSaved(getStored(STORAGE_KEYS.SAVED, []));
        setActivity(getStored(STORAGE_KEYS.ACTIVITY, []));
        setSettings({ ...DEFAULT_SETTINGS, ...getStored(STORAGE_KEYS.SETTINGS, {}) });
        setLoading(false);
    }, []);

    // ---- Activity Logger ----
    const logActivity = useCallback((type, data) => {
        const entry = {
            id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type,
            ...data,
            timestamp: new Date().toISOString(),
            read: false,
        };
        setActivity(prev => {
            const updated = [entry, ...prev].slice(0, 100); // cap at 100
            setStored(STORAGE_KEYS.ACTIVITY, updated);
            return updated;
        });
    }, []);

    const markActivityRead = useCallback(() => {
        setActivity(prev => {
            const updated = prev.map(a => ({ ...a, read: true }));
            setStored(STORAGE_KEYS.ACTIVITY, updated);
            return updated;
        });
    }, []);

    // ---- Auth Methods ----
    function signIn(email, displayName) {
        const userData = {
            id: btoa(email),
            email,
            display_name: displayName || email.split('@')[0],
            avatar_url: '',
            photos: [],
            bio: '',
            interests: [],
            orientation: '',
            age: '',
            created_at: new Date().toISOString(),
        };
        // Merge with existing data if returning user
        const existing = getStored(STORAGE_KEYS.USER);
        const merged = existing?.email === email ? { ...userData, ...existing, display_name: displayName || existing.display_name } : userData;
        setUser(merged);
        setGuest(false);
        setStored(STORAGE_KEYS.USER, merged);
        setStored(STORAGE_KEYS.GUEST, false);
        logActivity('login', { title: 'Signed in', message: `Welcome back, ${merged.display_name}!` });
        return merged;
    }

    function skipLogin() {
        setGuest(true);
        setStored(STORAGE_KEYS.GUEST, true);
    }

    function signOut() {
        setUser(null);
        setGuest(false);
        setStored(STORAGE_KEYS.USER, null);
        setStored(STORAGE_KEYS.GUEST, false);
    }

    function updateProfile(updates) {
        if (!user) return;
        const updated = { ...user, ...updates };
        setUser(updated);
        setStored(STORAGE_KEYS.USER, updated);
        logActivity('profile_update', { title: 'Profile updated', message: 'You updated your profile info' });
        return updated;
    }

    function addPhoto(dataUrl) {
        if (!user) return;
        const photos = [...(user.photos || []), dataUrl].slice(0, 6);
        const updated = { ...user, photos };
        if (!updated.avatar_url && photos.length > 0) updated.avatar_url = photos[0];
        setUser(updated);
        setStored(STORAGE_KEYS.USER, updated);
        logActivity('photo_added', { title: 'Photo added', message: 'You added a new photo' });
    }

    function removePhoto(index) {
        if (!user) return;
        const photos = [...(user.photos || [])];
        photos.splice(index, 1);
        const updated = { ...user, photos, avatar_url: photos[0] || '' };
        setUser(updated);
        setStored(STORAGE_KEYS.USER, updated);
    }

    // ---- Settings ----
    function updateSettings(updates) {
        const updated = { ...settings, ...updates };
        setSettings(updated);
        setStored(STORAGE_KEYS.SETTINGS, updated);
    }

    // ---- Like/Match/Pass ----
    const addLike = useCallback((profile) => {
        setLikes(prev => {
            if (prev.find(l => l.wpId === profile.wpId)) return prev;
            const updated = [...prev, { ...profile, likedAt: new Date().toISOString() }];
            setStored(STORAGE_KEYS.LIKES, updated);
            return updated;
        });
        logActivity('like', { title: `You liked ${profile.name || 'someone'}`, message: profile.location || '', image: profile.imageUrl, profileId: profile.wpId });
    }, [logActivity]);

    const addMatch = useCallback((profile, score = 85) => {
        setMatches(prev => {
            if (prev.find(m => m.wpId === profile.wpId)) return prev;
            const updated = [...prev, { ...profile, score, matchedAt: new Date().toISOString() }];
            setStored(STORAGE_KEYS.MATCHES, updated);
            return updated;
        });
        logActivity('match', { title: `Matched with ${profile.name || 'someone'}! 💖`, message: `${score}% compatibility`, image: profile.imageUrl, profileId: profile.wpId });
    }, [logActivity]);

    const addPass = useCallback((profileWpId) => {
        setPasses(prev => {
            if (prev.includes(profileWpId)) return prev;
            const updated = [...prev, profileWpId];
            setStored(STORAGE_KEYS.PASSES, updated);
            return updated;
        });
    }, []);

    const isProfileSwiped = useCallback((wpId) => {
        return likes.some(l => l.wpId === wpId) || passes.includes(wpId);
    }, [likes, passes]);

    // ---- Save/Unsave Profile ----
    const saveProfile = useCallback((profile) => {
        setSaved(prev => {
            if (prev.find(s => s.wpId === profile.wpId)) return prev;
            const updated = [...prev, { ...profile, savedAt: new Date().toISOString() }];
            setStored(STORAGE_KEYS.SAVED, updated);
            return updated;
        });
        logActivity('save', { title: `Saved ${profile.name || 'a profile'}`, message: 'Added to your saved list', image: profile.imageUrl, profileId: profile.wpId });
    }, [logActivity]);

    const unsaveProfile = useCallback((wpId) => {
        setSaved(prev => {
            const updated = prev.filter(s => s.wpId !== wpId);
            setStored(STORAGE_KEYS.SAVED, updated);
            return updated;
        });
    }, []);

    const isProfileSaved = useCallback((wpId) => {
        return saved.some(s => s.wpId === wpId);
    }, [saved]);

    // ---- Super Like ----
    const addSuperLike = useCallback((profile) => {
        setLikes(prev => {
            if (prev.find(l => l.wpId === profile.wpId)) return prev;
            const updated = [...prev, { ...profile, likedAt: new Date().toISOString(), super: true }];
            setStored(STORAGE_KEYS.LIKES, updated);
            return updated;
        });
        logActivity('like', { title: `You super liked ${profile.name || 'someone'} ⚡`, message: `${profile.location || ''} • Super Like!`, image: profile.imageUrl, profileId: profile.wpId });
    }, [logActivity]);

    // ---- Request Connection ----
    const requestConnection = useCallback((profileName, profileId) => {
        logActivity('connection_request', {
            title: `Connection requested with ${profileName}`,
            message: 'Admin will facilitate your connection 💌',
            profileId,
        });
    }, [logActivity]);

    // ---- Log Message Sent ----
    const logMessageSent = useCallback((profileName, profileImage) => {
        logActivity('message', { title: `Message sent to ${profileName}`, message: 'Awaiting moderation', image: profileImage });
    }, [logActivity]);

    // ---- Log Profile View ----
    const logProfileView = useCallback((profile) => {
        logActivity('view', { title: `Viewed ${profile.name || 'a profile'}`, message: profile.location || '', image: profile.imageUrl, profileId: profile.wpId });
    }, [logActivity]);

    // ---- AI Engagement System ----
    const aiTimerRef = useRef(null);

    useEffect(() => {
        if (loading) return;

        const AI_NAMES = [
            'Faith', 'Grace', 'Mercy', 'Joy', 'Hope', 'Charity', 'Rose', 'Lilian',
            'Agnes', 'Esther', 'Margaret', 'Catherine', 'Diana', 'Susan', 'Janet',
            'Winnie', 'Betty', 'Nancy', 'Doris', 'Alice', 'Gloria', 'Irene',
            'Patricia', 'Christine', 'Sharon', 'Stella', 'Monica', 'Sarah',
            'Lucy', 'Ann', 'Beatrice', 'Pauline', 'Purity', 'Vivian', 'Brenda',
            'Josephine', 'Florence', 'Carol', 'Jane', 'Tabitha', 'Angela',
        ];

        const AI_LOCATIONS = [
            'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika',
            'Westlands', 'Kilimani', 'Karen', 'Langata', 'Kiambu', 'Ruiru',
        ];

        const AI_TEMPLATES = [
            { type: 'meetup_ready', msg: (n, l) => ({ title: `${n} is ready to meet up today 🔥`, message: `Available in ${l} — tap to connect` }) },
            { type: 'connection_request', msg: (n, l) => ({ title: `${n} wants to connect with you 💌`, message: `${n} from ${l} is interested` }) },
            { type: 'request_hookup', msg: (n, l) => ({ title: `${n} sent you a hookup request 💋`, message: `She's available near ${l}` }) },
            { type: 'match', msg: (n, l) => ({ title: `New match suggestion: ${n} 💖`, message: `${l} • High compatibility` }) },
            { type: 'like', msg: (n, l) => ({ title: `${n} liked your profile ❤️`, message: `From ${l}` }) },
            { type: 'meetup_ready', msg: (n, l) => ({ title: `${n} is looking for you tonight 🌙`, message: `Currently in ${l}` }) },
            { type: 'connection_request', msg: (n, l) => ({ title: `${n} viewed your profile 3 times 👀`, message: `She seems very interested!` }) },
        ];

        const generateAIAlert = () => {
            const name = AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)];
            const location = AI_LOCATIONS[Math.floor(Math.random() * AI_LOCATIONS.length)];
            const template = AI_TEMPLATES[Math.floor(Math.random() * AI_TEMPLATES.length)];
            const profileId = Math.floor(Math.random() * 500) + 1;
            const { title, message } = template.msg(name, location);

            logActivity(template.type, { title, message, profileId, image: '' });
        };

        const scheduleNext = () => {
            const delay = (30 + Math.random() * 60) * 1000; // 30-90 seconds
            aiTimerRef.current = setTimeout(() => {
                generateAIAlert();
                scheduleNext();
            }, delay);
        };

        // Start after a short initial delay
        const initialDelay = setTimeout(() => {
            generateAIAlert();
            scheduleNext();
        }, 5000);

        return () => {
            clearTimeout(initialDelay);
            if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
        };
    }, [loading, logActivity]);

    // ---- Delete Account ----
    function deleteAccount() {
        Object.values(STORAGE_KEYS).forEach(k => {
            if (typeof window !== 'undefined') localStorage.removeItem(k);
        });
        setUser(null);
        setGuest(false);
        setLikes([]);
        setMatches([]);
        setPasses([]);
        setSaved([]);
        setActivity([]);
        setSettings(DEFAULT_SETTINGS);
    }

    const value = {
        user, guest, loading, profile: user,
        likes, matches, saved, activity, settings,
        signIn, signOut, skipLogin,
        updateProfile, addPhoto, removePhoto,
        updateSettings,
        addLike, addMatch, addPass, isProfileSwiped, addSuperLike,
        saveProfile, unsaveProfile, isProfileSaved,
        logActivity, logMessageSent, logProfileView, markActivityRead,
        requestConnection,
        deleteAccount,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
