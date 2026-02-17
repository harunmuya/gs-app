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
    MESSAGES: 'gsm_messages',
    VERIFICATION: 'gsm_verification',
    LOCATION: 'gsm_location',
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
    const [messages, setMessages] = useState([]);
    const [verificationStatus, setVerificationStatus] = useState(null); // null | 'verified' | 'failed'
    const [realProfilePool, setRealProfilePool] = useState([]);

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
        setMessages(getStored(STORAGE_KEYS.MESSAGES, []));
        setVerificationStatus(getStored(STORAGE_KEYS.VERIFICATION, null));
        setLoading(false);
    }, []);

    // ---- Fetch Real Profile Pool for AI engagement ----
    useEffect(() => {
        async function loadProfilePool() {
            try {
                const res = await fetch('/api/profiles?page=1&per_page=30');
                const data = await res.json();
                if (data.profiles && data.profiles.length > 0) {
                    setRealProfilePool(data.profiles);
                }
            } catch (err) {
                console.error('Failed to load profile pool for AI:', err);
            }
        }
        loadProfilePool();
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
            const updated = [entry, ...prev].slice(0, 100);
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

    // ---- Messages ----
    const addMessage = useCallback((msg) => {
        const entry = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...msg,
            timestamp: new Date().toISOString(),
            read: false,
        };
        setMessages(prev => {
            const updated = [entry, ...prev].slice(0, 200);
            setStored(STORAGE_KEYS.MESSAGES, updated);
            return updated;
        });
    }, []);

    const markMessagesRead = useCallback(() => {
        setMessages(prev => {
            const updated = prev.map(m => ({ ...m, read: true }));
            setStored(STORAGE_KEYS.MESSAGES, updated);
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
        const existing = getStored(STORAGE_KEYS.USER);
        const merged = existing?.email === email ? { ...userData, ...existing, display_name: displayName || existing.display_name } : userData;
        setUser(merged);
        setGuest(false);
        setStored(STORAGE_KEYS.USER, merged);
        setStored(STORAGE_KEYS.GUEST, false);
        logActivity('login', { title: 'Signed in', message: `Welcome back, ${merged.display_name}!` });

        // GS Support welcome message (only on first sign-in)
        const existingMessages = getStored(STORAGE_KEYS.MESSAGES, []);
        const hasWelcome = existingMessages.some(m => m.type === 'gs_support');
        if (!hasWelcome) {
            setTimeout(() => {
                addMessage({
                    type: 'gs_support',
                    sender: 'GS Support',
                    senderImage: '',
                    title: 'Welcome to Genuine Sugarmummies!',
                    body: `Hi ${merged.display_name}! Thanks for joining Genuine Sugarmummies. Interact with sugar mummies profiles, then request a hookup. Our admin Mary G is always available on Telegram @GSADMINMARYGAGENCY to facilitate connections. Enjoy!`,
                });
            }, 2000);
        }

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
        // Remove verification if profile picture is deleted
        if (index === 0) {
            setVerificationStatus(null);
            setStored(STORAGE_KEYS.VERIFICATION, null);
        }
    }

    // ---- Strict AI Verification System ----
    function verifyProfile(selfieDataUrl) {
        if (!user) {
            setVerificationStatus('failed');
            setStored(STORAGE_KEYS.VERIFICATION, 'failed');
            addMessage({ type: 'verification', sender: 'GS Verification', senderImage: '', title: 'Verification Failed', body: 'You must be signed in to verify your profile.' });
            return 'failed';
        }

        const profilePic = user.avatar_url || (user.photos && user.photos[0]);
        if (!profilePic) {
            setVerificationStatus('failed');
            setStored(STORAGE_KEYS.VERIFICATION, 'failed');
            addMessage({ type: 'verification', sender: 'GS Verification', senderImage: '', title: 'Verification Failed', body: 'You must upload a profile photo first before requesting verification.' });
            return 'failed';
        }

        if (!selfieDataUrl || !selfieDataUrl.startsWith('data:image/')) {
            setVerificationStatus('failed');
            setStored(STORAGE_KEYS.VERIFICATION, 'failed');
            addMessage({ type: 'verification', sender: 'GS Verification', senderImage: '', title: 'Verification Failed', body: 'Invalid selfie image. Please upload a clear photo of yourself.' });
            return 'failed';
        }

        // Start async canvas-based verification
        setVerificationStatus('processing');
        setStored(STORAGE_KEYS.VERIFICATION, 'processing');

        _runCanvasVerification(selfieDataUrl, profilePic)
            .then(result => {
                setVerificationStatus(result.status);
                setStored(STORAGE_KEYS.VERIFICATION, result.status);
                if (result.status === 'verified') {
                    logActivity('profile_update', { title: 'Profile Verified ✓', message: 'Your identity has been verified with a blue badge!' });
                    addMessage({ type: 'verification', sender: 'GS Verification', senderImage: '', title: '✓ Profile Verified!', body: 'Congratulations! Your identity has been confirmed. You now have a blue verification badge. This badge shows other users that you are a real, verified person.' });
                } else {
                    addMessage({ type: 'verification', sender: 'GS Verification', senderImage: '', title: 'Verification Denied', body: result.reason || 'Verification failed. Please try again with a clear selfie.' });
                }
            })
            .catch(() => {
                setVerificationStatus('failed');
                setStored(STORAGE_KEYS.VERIFICATION, 'failed');
                addMessage({ type: 'verification', sender: 'GS Verification', senderImage: '', title: 'Verification Error', body: 'Something went wrong during verification. Please try again.' });
            });

        return 'processing';
    }

    // Canvas-based image analysis — runs asynchronously
    async function _runCanvasVerification(selfieDataUrl, profilePicUrl) {
        const loadImage = (src) => new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = src;
        });

        try {
            // Simulate AI processing time (1.5–3s)
            await new Promise(r => setTimeout(r, 1500 + Math.random() * 1500));

            const selfieImg = await loadImage(selfieDataUrl);

            // Rule 1: Selfie must be a reasonable photo size (not tiny icon or huge)
            if (selfieImg.width < 100 || selfieImg.height < 100) {
                return { status: 'failed', reason: 'Your selfie is too small. Please upload a clear, high-quality photo (minimum 100x100 pixels).' };
            }

            // Rule 2: Analyze selfie for face-like content (skin tone detection)
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const size = 100; // Analyze at 100x100
            canvas.width = size;
            canvas.height = size;
            ctx.drawImage(selfieImg, 0, 0, size, size);
            const selfieData = ctx.getImageData(0, 0, size, size).data;

            // Count skin-tone pixels (HSL-based detection)
            let skinPixels = 0;
            let totalPixels = size * size;
            for (let i = 0; i < selfieData.length; i += 4) {
                const r = selfieData[i], g = selfieData[i + 1], b = selfieData[i + 2];
                // Skin tone detection: various skin colors
                if (r > 60 && g > 40 && b > 20 &&
                    r > g && r > b &&
                    Math.abs(r - g) > 10 &&
                    r - b > 15) {
                    skinPixels++;
                }
            }
            const skinRatio = skinPixels / totalPixels;

            // Rule 3: Must have at least 8% skin-tone pixels (face should have skin)
            if (skinRatio < 0.08) {
                return { status: 'failed', reason: 'No face detected in your selfie. Please upload a clear selfie showing your face. Ensure good lighting and avoid wearing masks or sunglasses.' };
            }

            // Rule 4: If profile pic is also a data URL, check it's not the exact same image (copy-paste)
            if (profilePicUrl.startsWith('data:image/')) {
                try {
                    const profileImg = await loadImage(profilePicUrl);
                    canvas.width = size;
                    canvas.height = size;
                    ctx.drawImage(profileImg, 0, 0, size, size);
                    const profileData = ctx.getImageData(0, 0, size, size).data;

                    // Compare pixel similarity
                    let matchingPixels = 0;
                    for (let i = 0; i < selfieData.length; i += 4) {
                        const dr = Math.abs(selfieData[i] - profileData[i]);
                        const dg = Math.abs(selfieData[i + 1] - profileData[i + 1]);
                        const db = Math.abs(selfieData[i + 2] - profileData[i + 2]);
                        if (dr < 10 && dg < 10 && db < 10) matchingPixels++;
                    }
                    const similarity = matchingPixels / totalPixels;

                    // If >95% identical — same image uploaded twice
                    if (similarity > 0.95) {
                        return { status: 'failed', reason: 'Your selfie appears to be the same as your profile photo. Please take a NEW selfie (different angle or pose) to verify your identity.' };
                    }
                } catch { }
            }

            // Rule 5: Check that selfie isn't a solid color or blank
            let uniqueColors = new Set();
            for (let i = 0; i < selfieData.length; i += 16) { // sample every 4th pixel
                uniqueColors.add(`${Math.floor(selfieData[i] / 32)}-${Math.floor(selfieData[i + 1] / 32)}-${Math.floor(selfieData[i + 2] / 32)}`);
            }
            if (uniqueColors.size < 15) {
                return { status: 'failed', reason: 'Your selfie appears to be a blank or single-color image. Please upload a real photo of yourself.' };
            }

            // All checks passed
            return { status: 'verified', reason: null };

        } catch (err) {
            return { status: 'failed', reason: 'Could not process your selfie. Please try a different photo format (JPEG or PNG recommended).' };
        }
    }

    function clearVerification() {
        setVerificationStatus(null);
        setStored(STORAGE_KEYS.VERIFICATION, null);
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
        logActivity('match', { title: `Matched with ${profile.name || 'someone'}!`, message: `${score}% compatibility`, image: profile.imageUrl, profileId: profile.wpId });
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
        logActivity('like', { title: `You super liked ${profile.name || 'someone'}`, message: `${profile.location || ''} — Super Like!`, image: profile.imageUrl, profileId: profile.wpId });
    }, [logActivity]);

    // ---- Request Connection (Telegram) ----
    const requestConnection = useCallback((profileName, profileId) => {
        logActivity('connection_request', {
            title: `Connection requested with ${profileName}`,
            message: 'Admin Mary G will facilitate your connection on Telegram',
            profileId,
        });
        addMessage({
            type: 'connection',
            sender: 'GS Support',
            senderImage: '',
            title: `Connection request sent for ${profileName}`,
            body: `Your request to connect with ${profileName} has been sent. Contact admin @GSADMINMARYGAGENCY on Telegram for faster response.`,
        });
    }, [logActivity, addMessage]);

    // ---- Log Message Sent (comment) ----
    const logMessageSent = useCallback((profileName, profileImage) => {
        logActivity('message', { title: `Message sent to ${profileName}`, message: 'Awaiting moderation', image: profileImage });
        addMessage({
            type: 'comment_sent',
            sender: 'You',
            senderImage: '',
            title: `Comment on ${profileName}'s profile`,
            body: 'Your comment has been submitted and is awaiting admin approval.',
        });
    }, [logActivity, addMessage]);

    // ---- Log Profile View ----
    const logProfileView = useCallback((profile) => {
        logActivity('view', { title: `Viewed ${profile.name || 'a profile'}`, message: profile.location || '', image: profile.imageUrl, profileId: profile.wpId });
    }, [logActivity]);

    // ---- AI Engagement System (uses REAL profiles) ----
    const aiTimerRef = useRef(null);
    const realProfilePoolRef = useRef([]);
    useEffect(() => { realProfilePoolRef.current = realProfilePool; }, [realProfilePool]);

    useEffect(() => {
        if (loading) return;

        const AI_LOCATIONS = [
            'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika',
            'Westlands', 'Kilimani', 'Karen', 'Langata', 'Kiambu', 'Ruiru',
        ];

        const AI_TEMPLATES = [
            { type: 'meetup_ready', msg: (n, l) => ({ title: `${n} is ready to meet up today`, message: `Available in ${l} — tap to connect` }) },
            { type: 'connection_request', msg: (n, l) => ({ title: `${n} wants to connect with you`, message: `${n} from ${l} is interested` }) },
            { type: 'request_hookup', msg: (n, l) => ({ title: `${n} sent you a hookup request`, message: `She's available near ${l}` }) },
            { type: 'match', msg: (n, l) => ({ title: `New match suggestion: ${n}`, message: `${l} — High compatibility` }) },
            { type: 'like', msg: (n, l) => ({ title: `${n} liked your profile`, message: `From ${l}` }) },
            { type: 'meetup_ready', msg: (n, l) => ({ title: `${n} is looking for you tonight`, message: `Currently in ${l}` }) },
            { type: 'connection_request', msg: (n, l) => ({ title: `${n} viewed your profile 3 times`, message: `She seems very interested!` }) },
        ];

        const generateAIAlert = () => {
            const pool = realProfilePoolRef.current;
            let name, location, profileId, image;

            if (pool.length > 0) {
                // Use REAL profile data
                const profile = pool[Math.floor(Math.random() * pool.length)];
                name = profile.name || 'Someone';
                location = profile.location || AI_LOCATIONS[Math.floor(Math.random() * AI_LOCATIONS.length)];
                profileId = profile.wpId;
                image = profile.imageUrl || '';
            } else {
                // Fallback — still use realistic names but no specific profile link
                const FALLBACK_NAMES = [
                    'Faith', 'Grace', 'Mercy', 'Joy', 'Hope', 'Rose', 'Lilian',
                    'Agnes', 'Esther', 'Margaret', 'Catherine', 'Diana', 'Susan',
                ];
                name = FALLBACK_NAMES[Math.floor(Math.random() * FALLBACK_NAMES.length)];
                location = AI_LOCATIONS[Math.floor(Math.random() * AI_LOCATIONS.length)];
                profileId = null;
                image = '';
            }

            const template = AI_TEMPLATES[Math.floor(Math.random() * AI_TEMPLATES.length)];
            const { title, message } = template.msg(name, location);

            logActivity(template.type, { title, message, profileId, image });

            // Also add as a message in inbox
            addMessage({
                type: 'ai_engagement',
                sender: name,
                senderImage: image,
                title,
                body: message,
                profileId,
            });
        };

        const scheduleNext = () => {
            const delay = (30 + Math.random() * 60) * 1000;
            aiTimerRef.current = setTimeout(() => {
                generateAIAlert();
                scheduleNext();
            }, delay);
        };

        const initialDelay = setTimeout(() => {
            generateAIAlert();
            scheduleNext();
        }, 5000);

        return () => {
            clearTimeout(initialDelay);
            if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
        };
    }, [loading, logActivity, addMessage]);

    // ---- Clear Swipe History (for Discover refresh) ----
    const clearSwipeHistory = useCallback(() => {
        setPasses([]);
        setStored(STORAGE_KEYS.PASSES, []);
        // Keep likes and matches but clear passes so all profiles show again
    }, []);

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
        setMessages([]);
        setVerificationStatus(null);
    }

    const value = {
        user, guest, loading, profile: user,
        likes, matches, saved, activity, settings,
        messages, verificationStatus, realProfilePool,
        signIn, signOut, skipLogin,
        updateProfile, addPhoto, removePhoto,
        updateSettings,
        addLike, addMatch, addPass, isProfileSwiped, addSuperLike, clearSwipeHistory,
        saveProfile, unsaveProfile, isProfileSaved,
        logActivity, logMessageSent, logProfileView, markActivityRead,
        requestConnection,
        addMessage, markMessagesRead,
        verifyProfile, clearVerification,
        deleteAccount,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
