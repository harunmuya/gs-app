'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const AuthContext = createContext({});

const STORAGE_KEYS = {
    USER: 'gsm_user',
    LIKES: 'gsm_likes',
    MATCHES: 'gsm_matches',
    PASSES: 'gsm_passes',
    GUEST: 'guest_mode',
};

function getStored(key, fallback = null) {
    if (typeof window === 'undefined') return fallback;
    try {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : fallback;
    } catch {
        return fallback;
    }
}

function setStored(key, value) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch { }
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [guest, setGuest] = useState(false);
    const [loading, setLoading] = useState(true);
    const [likes, setLikes] = useState([]);
    const [matches, setMatches] = useState([]);
    const [passes, setPasses] = useState([]);

    // Load from localStorage on mount
    useEffect(() => {
        const storedUser = getStored(STORAGE_KEYS.USER);
        const storedGuest = getStored(STORAGE_KEYS.GUEST, false);
        const storedLikes = getStored(STORAGE_KEYS.LIKES, []);
        const storedMatches = getStored(STORAGE_KEYS.MATCHES, []);
        const storedPasses = getStored(STORAGE_KEYS.PASSES, []);

        if (storedUser) setUser(storedUser);
        if (storedGuest) setGuest(true);
        setLikes(storedLikes);
        setMatches(storedMatches);
        setPasses(storedPasses);
        setLoading(false);
    }, []);

    // Sign in with email + name
    function signIn(email, displayName) {
        const userData = {
            id: btoa(email),
            email,
            display_name: displayName || email.split('@')[0],
            avatar_url: '',
            bio: '',
            interests: [],
            created_at: new Date().toISOString(),
        };
        setUser(userData);
        setGuest(false);
        setStored(STORAGE_KEYS.USER, userData);
        setStored(STORAGE_KEYS.GUEST, false);
        return userData;
    }

    // Skip login (guest)
    function skipLogin() {
        setGuest(true);
        setStored(STORAGE_KEYS.GUEST, true);
    }

    // Sign out
    function signOut() {
        setUser(null);
        setGuest(false);
        setStored(STORAGE_KEYS.USER, null);
        setStored(STORAGE_KEYS.GUEST, false);
    }

    // Update profile
    function updateProfile(updates) {
        if (!user) return;
        const updated = { ...user, ...updates };
        setUser(updated);
        setStored(STORAGE_KEYS.USER, updated);
        return updated;
    }

    // Like a profile
    const addLike = useCallback((profile) => {
        setLikes(prev => {
            if (prev.find(l => l.wpId === profile.wpId)) return prev;
            const updated = [...prev, { ...profile, likedAt: new Date().toISOString() }];
            setStored(STORAGE_KEYS.LIKES, updated);
            return updated;
        });
    }, []);

    // Add a match
    const addMatch = useCallback((profile, score = 85) => {
        setMatches(prev => {
            if (prev.find(m => m.wpId === profile.wpId)) return prev;
            const updated = [...prev, { ...profile, score, matchedAt: new Date().toISOString() }];
            setStored(STORAGE_KEYS.MATCHES, updated);
            return updated;
        });
    }, []);

    // Pass on a profile
    const addPass = useCallback((profileWpId) => {
        setPasses(prev => {
            if (prev.includes(profileWpId)) return prev;
            const updated = [...prev, profileWpId];
            setStored(STORAGE_KEYS.PASSES, updated);
            return updated;
        });
    }, []);

    // Check if profile was already swiped
    const isProfileSwiped = useCallback((wpId) => {
        return likes.some(l => l.wpId === wpId) || passes.includes(wpId);
    }, [likes, passes]);

    // Delete account
    function deleteAccount() {
        Object.values(STORAGE_KEYS).forEach(k => {
            if (typeof window !== 'undefined') localStorage.removeItem(k);
        });
        setUser(null);
        setGuest(false);
        setLikes([]);
        setMatches([]);
        setPasses([]);
    }

    const value = {
        user,
        guest,
        loading,
        profile: user,
        likes,
        matches,
        signIn,
        signOut,
        skipLogin,
        updateProfile,
        addLike,
        addMatch,
        addPass,
        isProfileSwiped,
        deleteAccount,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
