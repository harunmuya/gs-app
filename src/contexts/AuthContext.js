'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
    openDB, migrateFromLocalStorage, getActiveSession, createSession, destroySession,
    registerUser, loginUser, updateUser,
    addLikeDB, addSuperLikeDB, addMatchDB, addPassDB, isSwipedDB,
    getUserLikes, getUserMatches, clearPassesDB,
    saveProfileDB, unsaveProfileDB, getUserSaved,
    addActivityDB, getUserActivity, markAllActivityReadDB,
    sendMessageDB, getUserConversations, getConversationMessages, markMessagesSeenDB,
    addInboxMessageDB, getUserInboxMessages, markAllInboxReadDB,
    getVerificationDB, saveVerificationDB,
    getSettingsDB, updateSettingsDB,
    getSubscriptionDB, updateSubscriptionDB,
    reportUserDB, blockUserDB, getBlockedUsersDB,
    deleteAllUserData,
    dbGet, STORES,
} from '@/lib/database';

const AuthContext = createContext({});

const DEFAULT_SETTINGS = {
    isPublic: true,
    locationEnabled: false,
    notifications: true,
    showOnline: true,
    showAge: true,
    emailNotifications: false,
    darkMode: false,
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
    const [messages, setMessages] = useState([]); // inbox/notification messages
    const [conversations, setConversations] = useState([]); // chat conversations
    const [verificationStatus, setVerificationStatus] = useState(null);
    const [subscription, setSubscription] = useState(null);
    const [realProfilePool, setRealProfilePool] = useState([]);
    const [blockedUsers, setBlockedUsers] = useState([]);

    // ---- Initialize: Open DB, migrate, restore session ----
    useEffect(() => {
        async function init() {
            try {
                await openDB();
                await migrateFromLocalStorage();

                // Check for active session
                const session = await getActiveSession();
                if (session && session.email) {
                    const userData = await dbGet(STORES.users, session.email);
                    if (userData) {
                        setUser(userData);
                        // Load all user data
                        await loadUserData(session.email);
                    }
                } else {
                    // Check legacy guest mode
                    const guestMode = typeof window !== 'undefined' ? localStorage.getItem('guest_mode') : null;
                    if (guestMode === 'true') setGuest(true);
                }
            } catch (err) {
                console.error('[Auth] Init error:', err);
                // Fallback: try legacy localStorage
                try {
                    const userStr = typeof window !== 'undefined' ? localStorage.getItem('gsm_user') : null;
                    if (userStr) {
                        const u = JSON.parse(userStr);
                        if (u) setUser(u);
                    }
                } catch { }
            } finally {
                setLoading(false);
            }
        }
        init();
    }, []);

    // Load all user data from IndexedDB
    async function loadUserData(email) {
        try {
            const [userLikes, userMatches, userSaved, userActivity, userInbox, userSettings, userVerification, userSubscription, userBlocked, userConvs] = await Promise.all([
                getUserLikes(email),
                getUserMatches(email),
                getUserSaved(email),
                getUserActivity(email),
                getUserInboxMessages(email),
                getSettingsDB(email),
                getVerificationDB(email),
                getSubscriptionDB(email),
                getBlockedUsersDB(email),
                getUserConversations(email),
            ]);

            setLikes(userLikes || []);
            setMatches(userMatches || []);
            setSaved(userSaved || []);
            setActivity(userActivity || []);
            setMessages(userInbox || []);
            setSettings({ ...DEFAULT_SETTINGS, ...(userSettings || {}) });
            setVerificationStatus(userVerification?.status || null);
            setSubscription(userSubscription || null);
            setBlockedUsers(userBlocked || []);
            setConversations(userConvs || []);
        } catch (err) {
            console.error('[Auth] loadUserData error:', err);
        }
    }

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
    const logActivity = useCallback(async (type, data) => {
        const email = user?.email;
        if (!email) return;
        try {
            const entry = await addActivityDB(email, type, data);
            setActivity(prev => [entry, ...prev].slice(0, 100));
        } catch (err) {
            console.error('[Activity] log error:', err);
        }
    }, [user?.email]);

    const markActivityRead = useCallback(async () => {
        if (!user?.email) return;
        try {
            await markAllActivityReadDB(user.email);
            setActivity(prev => prev.map(a => ({ ...a, read: true })));
        } catch { }
    }, [user?.email]);

    // ---- Inbox Messages (system/AI) ----
    const addMessage = useCallback(async (msg) => {
        const email = user?.email;
        if (!email) return;
        try {
            const entry = await addInboxMessageDB(email, msg);
            setMessages(prev => [entry, ...prev].slice(0, 200));
        } catch { }
    }, [user?.email]);

    const markMessagesRead = useCallback(async () => {
        if (!user?.email) return;
        try {
            await markAllInboxReadDB(user.email);
            setMessages(prev => prev.map(m => ({ ...m, read: true })));
        } catch { }
    }, [user?.email]);

    // ---- Auth Methods ----
    async function signUp(email, password, displayName, extraData = {}) {
        try {
            const userData = await registerUser({
                email,
                password,
                displayName: displayName || email.split('@')[0],
                ...extraData,
            });
            await createSession(email);
            setUser(userData);
            setGuest(false);
            await loadUserData(email);

            // Welcome message
            setTimeout(async () => {
                await addInboxMessageDB(email, {
                    type: 'gs_support',
                    sender: 'GS Support',
                    senderImage: '',
                    title: 'Welcome to Genuine Sugarmummies!',
                    body: `Hi ${userData.display_name}! Thanks for joining Genuine Sugarmummies. Interact with sugar mummies profiles, then request a hookup. Our admin Mary G is always available on Telegram @GSADMINMARYGAGENCY to facilitate connections. Enjoy!`,
                });
                const inbox = await getUserInboxMessages(email);
                setMessages(inbox);
            }, 1000);

            return userData;
        } catch (err) {
            throw err;
        }
    }

    async function signIn(email, password) {
        try {
            // If password provided, do real login
            if (password) {
                const userData = await loginUser(email, password);
                await createSession(email);
                setUser(userData);
                setGuest(false);
                await loadUserData(email);

                await addActivityDB(email, 'login', { title: 'Signed in', message: `Welcome back, ${userData.display_name}!` });
                const userActivity_ = await getUserActivity(email);
                setActivity(userActivity_);

                return userData;
            }

            // Legacy: email-only login (for backward compat)
            // Check if user exists — if so, require password
            const existing = await dbGet(STORES.users, email);
            if (existing && existing.passwordHash) {
                throw new Error('This account requires a password. Please enter your password.');
            }

            // Create new user without password (legacy mode)
            const userData = await registerUser({
                email,
                password: 'changeme123', // default password for legacy
                displayName: email.split('@')[0],
            });
            await createSession(email);
            setUser(userData);
            setGuest(false);
            await loadUserData(email);
            return userData;
        } catch (err) {
            throw err;
        }
    }

    function skipLogin() {
        setGuest(true);
        if (typeof window !== 'undefined') {
            localStorage.setItem('guest_mode', 'true');
        }
    }

    async function signOut() {
        if (user?.email) {
            try {
                await updateUser(user.email, { isOnline: false });
            } catch { }
        }
        await destroySession();
        setUser(null);
        setGuest(false);
        setLikes([]);
        setMatches([]);
        setPasses([]);
        setSaved([]);
        setActivity([]);
        setMessages([]);
        setConversations([]);
        setSettings(DEFAULT_SETTINGS);
        setVerificationStatus(null);
        setSubscription(null);
        setBlockedUsers([]);
        if (typeof window !== 'undefined') {
            localStorage.removeItem('guest_mode');
        }
    }

    // ---- Profile Management ----
    async function updateProfile(updates) {
        if (!user?.email) return;
        try {
            const updated = await updateUser(user.email, updates);
            setUser(updated);
            await addActivityDB(user.email, 'profile_update', { title: 'Profile updated', message: 'You updated your profile info' });
            return updated;
        } catch { }
    }

    function addPhoto(dataUrl) {
        if (!user) return;
        const photos = [...(user.photos || []), dataUrl].slice(0, 6);
        const updates = { photos };
        if (!user.avatar_url && photos.length > 0) updates.avatar_url = photos[0];
        updateProfile(updates);
    }

    function removePhoto(index) {
        if (!user) return;
        const photos = [...(user.photos || [])];
        photos.splice(index, 1);
        const updates = { photos, avatar_url: photos[0] || '' };
        updateProfile(updates);
        if (index === 0) {
            setVerificationStatus(null);
            if (user.email) saveVerificationDB(user.email, { status: null });
        }
    }

    // ---- Verification System (Strict — requires selfie + ID) ----
    async function verifyProfile(selfieDataUrl, idDocumentDataUrl) {
        if (!user) {
            setVerificationStatus('failed');
            addMessage({ type: 'verification', sender: 'GS Verification', senderImage: '', title: 'Verification Failed', body: 'You must be signed in to verify your profile.' });
            return 'failed';
        }

        const profilePic = user.avatar_url || (user.photos && user.photos[0]);
        if (!profilePic) {
            setVerificationStatus('failed');
            addMessage({ type: 'verification', sender: 'GS Verification', senderImage: '', title: 'Verification Failed', body: 'You must upload a profile photo first.' });
            return 'failed';
        }

        if (!selfieDataUrl || !selfieDataUrl.startsWith('data:image/')) {
            setVerificationStatus('failed');
            addMessage({ type: 'verification', sender: 'GS Verification', senderImage: '', title: 'Verification Failed', body: 'Invalid selfie image. Please upload a clear photo of yourself.' });
            return 'failed';
        }

        if (!idDocumentDataUrl || !idDocumentDataUrl.startsWith('data:image/')) {
            setVerificationStatus('failed');
            addMessage({ type: 'verification', sender: 'GS Verification', senderImage: '', title: 'Verification Failed', body: 'You must upload a valid ID or passport photo for verification.' });
            return 'failed';
        }

        // Start verification processing
        setVerificationStatus('processing');
        await saveVerificationDB(user.email, {
            status: 'processing',
            selfie: selfieDataUrl.substring(0, 200), // Store reference only
            idDocument: idDocumentDataUrl.substring(0, 200),
            submittedAt: new Date().toISOString(),
        });

        try {
            const result = await _runVerificationAnalysis(selfieDataUrl, profilePic, idDocumentDataUrl);

            if (result.status === 'pending_review') {
                setVerificationStatus('pending_review');
                await saveVerificationDB(user.email, {
                    status: 'pending_review',
                    submittedAt: new Date().toISOString(),
                    selfieValid: result.selfieValid,
                    idValid: result.idValid,
                });
                await addActivityDB(user.email, 'profile_update', {
                    title: 'Verification Submitted',
                    message: 'Your verification is under review. This may take 24-48 hours.',
                });
                addMessage({
                    type: 'verification',
                    sender: 'GS Verification',
                    senderImage: '',
                    title: '⏳ Verification Under Review',
                    body: 'Your selfie and ID have been submitted for review. Our team will verify your identity within 24-48 hours. You will be notified once your verification is approved or if additional information is needed.',
                });
            } else {
                setVerificationStatus('failed');
                await saveVerificationDB(user.email, {
                    status: 'failed',
                    reason: result.reason,
                    submittedAt: new Date().toISOString(),
                });
                addMessage({
                    type: 'verification',
                    sender: 'GS Verification',
                    senderImage: '',
                    title: 'Verification Denied',
                    body: result.reason || 'Verification failed. Please try again.',
                });
            }

            return result.status;
        } catch (err) {
            setVerificationStatus('failed');
            await saveVerificationDB(user.email, { status: 'failed' });
            addMessage({
                type: 'verification',
                sender: 'GS Verification',
                senderImage: '',
                title: 'Verification Error',
                body: 'Something went wrong. Please try again.',
            });
            return 'failed';
        }
    }

    // Canvas-based analysis — does NOT auto-verify
    async function _runVerificationAnalysis(selfieDataUrl, profilePicUrl, idDocUrl) {
        const loadImage = (src) => new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = src;
        });

        try {
            await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));

            const selfieImg = await loadImage(selfieDataUrl);

            // Rule 1: Size check
            if (selfieImg.width < 100 || selfieImg.height < 100) {
                return { status: 'failed', reason: 'Selfie too small. Min 100x100 pixels.' };
            }

            // Rule 2: Face detection (skin tone)
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const size = 100;
            canvas.width = size;
            canvas.height = size;
            ctx.drawImage(selfieImg, 0, 0, size, size);
            const selfieData = ctx.getImageData(0, 0, size, size).data;

            let skinPixels = 0;
            const totalPixels = size * size;
            for (let i = 0; i < selfieData.length; i += 4) {
                const r = selfieData[i], g = selfieData[i + 1], b = selfieData[i + 2];
                if (r > 60 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 10 && r - b > 15) {
                    skinPixels++;
                }
            }
            const skinRatio = skinPixels / totalPixels;
            const selfieValid = skinRatio >= 0.08;

            if (!selfieValid) {
                return { status: 'failed', reason: 'No face detected in selfie. Please upload a clear photo showing your face.' };
            }

            // Rule 3: Not blank
            const uniqueColors = new Set();
            for (let i = 0; i < selfieData.length; i += 16) {
                uniqueColors.add(`${Math.floor(selfieData[i] / 32)}-${Math.floor(selfieData[i + 1] / 32)}-${Math.floor(selfieData[i + 2] / 32)}`);
            }
            if (uniqueColors.size < 15) {
                return { status: 'failed', reason: 'Selfie appears blank. Please upload a real photo.' };
            }

            // Rule 4: Not identical to profile pic
            if (profilePicUrl.startsWith('data:image/')) {
                try {
                    const profileImg = await loadImage(profilePicUrl);
                    canvas.width = size;
                    canvas.height = size;
                    ctx.drawImage(profileImg, 0, 0, size, size);
                    const profileData = ctx.getImageData(0, 0, size, size).data;
                    let matching = 0;
                    for (let i = 0; i < selfieData.length; i += 4) {
                        if (Math.abs(selfieData[i] - profileData[i]) < 10 &&
                            Math.abs(selfieData[i + 1] - profileData[i + 1]) < 10 &&
                            Math.abs(selfieData[i + 2] - profileData[i + 2]) < 10) matching++;
                    }
                    if (matching / totalPixels > 0.95) {
                        return { status: 'failed', reason: 'Selfie is the same as profile photo. Upload a different selfie.' };
                    }
                } catch { }
            }

            // Rule 5: Validate ID document exists and is a real image
            try {
                const idImg = await loadImage(idDocUrl);
                if (idImg.width < 200 || idImg.height < 100) {
                    return { status: 'failed', reason: 'ID/Passport image too small. Please upload a clear, readable photo.' };
                }

                // Check ID is not blank
                canvas.width = 80;
                canvas.height = 80;
                ctx.drawImage(idImg, 0, 0, 80, 80);
                const idData = ctx.getImageData(0, 0, 80, 80).data;
                const idColors = new Set();
                for (let i = 0; i < idData.length; i += 16) {
                    idColors.add(`${Math.floor(idData[i] / 32)}-${Math.floor(idData[i + 1] / 32)}-${Math.floor(idData[i + 2] / 32)}`);
                }
                if (idColors.size < 20) {
                    return { status: 'failed', reason: 'ID document appears blank or unreadable. Please upload a clear photo of your ID or passport.' };
                }
            } catch {
                return { status: 'failed', reason: 'Could not process ID document. Please try a JPEG or PNG.' };
            }

            // All checks passed → PENDING REVIEW (NOT auto-verified)
            return { status: 'pending_review', selfieValid: true, idValid: true };

        } catch (err) {
            return { status: 'failed', reason: 'Could not process images. Please try JPEG or PNG format.' };
        }
    }

    function clearVerification() {
        setVerificationStatus(null);
        if (user?.email) saveVerificationDB(user.email, { status: null });
    }

    // ---- Settings ----
    async function updateSettingsHandler(updates) {
        const updated = { ...settings, ...updates };
        setSettings(updated);
        if (user?.email) {
            try { await updateSettingsDB(user.email, updates); } catch { }
        }
    }

    // ---- Like/Match/Pass ----
    const addLike = useCallback(async (profile) => {
        if (!user?.email) return;
        try {
            const like = await addLikeDB(user.email, profile);
            setLikes(prev => {
                if (prev.find(l => l.wpId === profile.wpId)) return prev;
                return [...prev, like];
            });
            await addActivityDB(user.email, 'like', {
                title: `You liked ${profile.name || 'someone'}`,
                message: profile.location || '',
                image: profile.imageUrl,
                profileId: profile.wpId,
            });
            setActivity(await getUserActivity(user.email));
        } catch { }
    }, [user?.email]);

    const addMatch = useCallback(async (profile, score = 85) => {
        if (!user?.email) return;
        try {
            const match = await addMatchDB(user.email, profile, score);
            setMatches(prev => {
                if (prev.find(m => m.wpId === profile.wpId)) return prev;
                return [...prev, match];
            });
            // Refresh conversations
            const convs = await getUserConversations(user.email);
            setConversations(convs);
            await addActivityDB(user.email, 'match', {
                title: `Matched with ${profile.name || 'someone'}!`,
                message: `${score}% compatibility`,
                image: profile.imageUrl,
                profileId: profile.wpId,
            });
            setActivity(await getUserActivity(user.email));
        } catch { }
    }, [user?.email]);

    const addPass = useCallback(async (profileWpId) => {
        if (!user?.email) return;
        try {
            await addPassDB(user.email, profileWpId);
            setPasses(prev => {
                if (prev.includes(profileWpId)) return prev;
                return [...prev, profileWpId];
            });
        } catch { }
    }, [user?.email]);

    const isProfileSwiped = useCallback(async (wpId) => {
        if (!user?.email) return false;
        try {
            return await isSwipedDB(user.email, wpId);
        } catch {
            return likes.some(l => l.wpId === wpId) || passes.includes(wpId);
        }
    }, [user?.email, likes, passes]);

    // Synchronous version for compatibility
    const isProfileSwipedSync = useCallback((wpId) => {
        return likes.some(l => l.wpId === wpId) || passes.includes(wpId);
    }, [likes, passes]);

    const addSuperLike = useCallback(async (profile) => {
        if (!user?.email) return;
        try {
            await addSuperLikeDB(user.email, profile);
            setLikes(prev => {
                if (prev.find(l => l.wpId === profile.wpId)) return prev;
                return [...prev, { ...profile, likedAt: new Date().toISOString(), super: true }];
            });
            await addActivityDB(user.email, 'like', {
                title: `You super liked ${profile.name || 'someone'}`,
                message: `${profile.location || ''} — Super Like!`,
                image: profile.imageUrl,
                profileId: profile.wpId,
            });
        } catch { }
    }, [user?.email]);

    const clearSwipeHistory = useCallback(async () => {
        if (!user?.email) return;
        try {
            await clearPassesDB(user.email);
            setPasses([]);
        } catch { }
    }, [user?.email]);

    // ---- Save/Unsave ----
    const saveProfile_ = useCallback(async (profile) => {
        if (!user?.email) return;
        try {
            await saveProfileDB(user.email, profile);
            setSaved(prev => {
                if (prev.find(s => s.wpId === profile.wpId)) return prev;
                return [...prev, { ...profile, savedAt: new Date().toISOString() }];
            });
        } catch { }
    }, [user?.email]);

    const unsaveProfile_ = useCallback(async (wpId) => {
        if (!user?.email) return;
        try {
            await unsaveProfileDB(user.email, wpId);
            setSaved(prev => prev.filter(s => s.wpId !== wpId));
        } catch { }
    }, [user?.email]);

    const isProfileSaved = useCallback((wpId) => {
        return saved.some(s => s.wpId === wpId);
    }, [saved]);

    // ---- Chat ----
    const sendChatMessage = useCallback(async (conversationId, text) => {
        if (!user?.email) return null;
        try {
            const msg = await sendMessageDB(conversationId, user.email, user.display_name, text);
            // Refresh conversations
            const convs = await getUserConversations(user.email);
            setConversations(convs);
            return msg;
        } catch {
            return null;
        }
    }, [user?.email, user?.display_name]);

    const getChatMessages = useCallback(async (conversationId) => {
        try {
            return await getConversationMessages(conversationId);
        } catch {
            return [];
        }
    }, []);

    const markChatSeen = useCallback(async (conversationId) => {
        if (!user?.email) return;
        try {
            await markMessagesSeenDB(conversationId, user.email);
            const convs = await getUserConversations(user.email);
            setConversations(convs);
        } catch { }
    }, [user?.email]);

    // ---- Request Connection (Telegram) ----
    const requestConnection = useCallback(async (profileName, profileId) => {
        if (!user?.email) return;
        await addActivityDB(user.email, 'connection_request', {
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
    }, [user?.email, addMessage]);

    // ---- Log helpers ----
    const logMessageSent = useCallback(async (profileName, profileImage) => {
        if (!user?.email) return;
        await addActivityDB(user.email, 'message', { title: `Message sent to ${profileName}`, message: 'Awaiting moderation', image: profileImage });
        addMessage({
            type: 'comment_sent',
            sender: 'You',
            senderImage: '',
            title: `Comment on ${profileName}'s profile`,
            body: 'Your comment has been submitted and is awaiting admin approval.',
        });
    }, [user?.email, addMessage]);

    const logProfileView = useCallback(async (profile) => {
        if (!user?.email) return;
        await addActivityDB(user.email, 'view', {
            title: `Viewed ${profile.name || 'a profile'}`,
            message: profile.location || '',
            image: profile.imageUrl,
            profileId: profile.wpId,
        });
    }, [user?.email]);

    // ---- Report / Block ----
    const reportUser = useCallback(async (targetWpId, reason) => {
        if (!user?.email) return;
        await reportUserDB(user.email, targetWpId, reason);
        addMessage({
            type: 'report',
            sender: 'GS Support',
            senderImage: '',
            title: 'Report Submitted',
            body: 'Thank you for reporting. We will review this profile and take appropriate action.',
        });
    }, [user?.email, addMessage]);

    const blockUser = useCallback(async (targetWpId) => {
        if (!user?.email) return;
        await blockUserDB(user.email, targetWpId);
        setBlockedUsers(prev => [...prev, targetWpId]);
        addMessage({
            type: 'block',
            sender: 'GS Support',
            senderImage: '',
            title: 'User Blocked',
            body: 'This user has been blocked. You will no longer see their profile.',
        });
    }, [user?.email, addMessage]);

    // ---- Subscription ----
    const updateSubscription = useCallback(async (planData) => {
        if (!user?.email) return;
        const updated = await updateSubscriptionDB(user.email, planData);
        setSubscription(updated);
    }, [user?.email]);

    // ---- AI Engagement System (uses REAL profiles, context-aware) ----
    const aiTimerRef = useRef(null);
    const realProfilePoolRef = useRef([]);
    const userRef = useRef(null);
    const activityRef = useRef([]);

    useEffect(() => { realProfilePoolRef.current = realProfilePool; }, [realProfilePool]);
    useEffect(() => { userRef.current = user; }, [user]);
    useEffect(() => { activityRef.current = activity; }, [activity]);

    useEffect(() => {
        if (loading || !user?.email) return;

        const AI_LOCATIONS = [
            'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika',
            'Westlands', 'Kilimani', 'Karen', 'Langata', 'Kiambu', 'Ruiru',
        ];

        // Context-aware templates — use user's actual likes/activity
        const getContextTemplates = () => {
            const u = userRef.current;
            const recentAct = activityRef.current.slice(0, 5);
            const hasLikes = recentAct.some(a => a.type === 'like');
            const hasViews = recentAct.some(a => a.type === 'view');
            const lastTemplate = recentAct[0]?.type || '';

            // Build templates based on user behavior
            const templates = [];

            if (hasLikes) {
                templates.push(
                    { type: 'match', msg: (n, l) => ({ title: `${n} also liked your profile`, message: `It's a match — she's in ${l}` }) },
                    { type: 'connection_request', msg: (n, l) => ({ title: `${n} noticed your interest`, message: `She's online now in ${l}` }) },
                );
            }

            if (hasViews) {
                templates.push(
                    { type: 'like', msg: (n, l) => ({ title: `${n} liked you back`, message: `Based on your profile views from ${l}` }) },
                );
            }

            // Always available (general)
            templates.push(
                { type: 'meetup_ready', msg: (n, l) => ({ title: `${n} is available today`, message: `Currently in ${l}` }) },
                { type: 'like', msg: (n, l) => ({ title: `${n} from ${l} viewed your profile`, message: `She seems interested` }) },
                { type: 'connection_request', msg: (n, l) => ({ title: `${n} wants to connect`, message: `She's looking for someone in ${l}` }) },
            );

            // Avoid repeating the same type
            const filtered = templates.filter(t => t.type !== lastTemplate);
            return filtered.length > 0 ? filtered : templates;
        };

        const generateAIAlert = async () => {
            const pool = realProfilePoolRef.current;
            let name, location, profileId, image;

            if (pool.length > 0) {
                const profile = pool[Math.floor(Math.random() * pool.length)];
                name = profile.name || 'Someone';
                location = profile.location || AI_LOCATIONS[Math.floor(Math.random() * AI_LOCATIONS.length)];
                profileId = profile.wpId;
                image = profile.imageUrl || '';
            } else {
                const NAMES = ['Faith', 'Grace', 'Mercy', 'Joy', 'Hope', 'Rose', 'Lilian', 'Agnes', 'Esther', 'Margaret'];
                name = NAMES[Math.floor(Math.random() * NAMES.length)];
                location = AI_LOCATIONS[Math.floor(Math.random() * AI_LOCATIONS.length)];
                profileId = null;
                image = '';
            }

            const templates = getContextTemplates();
            const template = templates[Math.floor(Math.random() * templates.length)];
            const { title, message } = template.msg(name, location);

            const email = userRef.current?.email;
            if (!email) return;

            try {
                await addActivityDB(email, template.type, { title, message, profileId, image });
                const userAct = await getUserActivity(email);
                setActivity(userAct);

                await addInboxMessageDB(email, {
                    type: 'ai_engagement',
                    sender: name,
                    senderImage: image,
                    title,
                    body: message,
                    profileId,
                });
                const inbox = await getUserInboxMessages(email);
                setMessages(inbox);
            } catch { }
        };

        const scheduleNext = () => {
            // Vary timing: 45s-120s based on user engagement
            const recentCount = activityRef.current.filter(a =>
                Date.now() - new Date(a.timestamp).getTime() < 300000
            ).length;
            const baseDelay = recentCount > 3 ? 45000 : 90000;
            const delay = baseDelay + Math.random() * 60000;

            aiTimerRef.current = setTimeout(() => {
                generateAIAlert();
                scheduleNext();
            }, delay);
        };

        const initialDelay = setTimeout(() => {
            generateAIAlert();
            scheduleNext();
        }, 8000);

        return () => {
            clearTimeout(initialDelay);
            if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
        };
    }, [loading, user?.email]);

    // ---- Delete Account ----
    async function deleteAccount() {
        if (user?.email) {
            try { await deleteAllUserData(user.email); } catch { }
        }
        setUser(null);
        setGuest(false);
        setLikes([]);
        setMatches([]);
        setPasses([]);
        setSaved([]);
        setActivity([]);
        setMessages([]);
        setConversations([]);
        setSettings(DEFAULT_SETTINGS);
        setVerificationStatus(null);
        setSubscription(null);
        setBlockedUsers([]);
    }

    const value = {
        user, guest, loading, profile: user,
        likes, matches, saved, activity, settings,
        messages, conversations, verificationStatus, realProfilePool,
        subscription, blockedUsers,
        signUp, signIn, signOut, skipLogin,
        updateProfile, addPhoto, removePhoto,
        updateSettings: updateSettingsHandler,
        addLike, addMatch, addPass,
        isProfileSwiped: isProfileSwipedSync, // sync version for filter/UI
        isProfileSwipedAsync: isProfileSwiped, // async version
        addSuperLike, clearSwipeHistory,
        saveProfile: saveProfile_, unsaveProfile: unsaveProfile_, isProfileSaved,
        logActivity, logMessageSent, logProfileView, markActivityRead,
        requestConnection,
        addMessage, markMessagesRead,
        sendChatMessage, getChatMessages, markChatSeen,
        verifyProfile, clearVerification,
        reportUser, blockUser,
        updateSubscription,
        deleteAccount,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
