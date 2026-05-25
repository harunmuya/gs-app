'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { initNotifications, notifyMatch, notifyMessage, notifyLike } from '@/lib/notifications';

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

// IndexedDB helper for local caching (non-auth data only)
async function openCacheDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('gs_cache_v2', 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('profileCache')) db.createObjectStore('profileCache', { keyPath: 'wpId' });
            if (!db.objectStoreNames.contains('uiState')) db.createObjectStore('uiState', { keyPath: 'key' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getCached(key) {
    try {
        const db = await openCacheDB();
        return new Promise((resolve) => {
            const tx = db.transaction('uiState', 'readonly');
            const req = tx.objectStore('uiState').get(key);
            req.onsuccess = () => resolve(req.result?.value);
            req.onerror = () => resolve(null);
        });
    } catch { return null; }
}

async function setCached(key, value) {
    try {
        const db = await openCacheDB();
        const tx = db.transaction('uiState', 'readwrite');
        tx.objectStore('uiState').put({ key, value, cachedAt: Date.now() });
    } catch { }
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [likes, setLikes] = useState([]);
    const [matches, setMatches] = useState([]);
    const [saved, setSaved] = useState([]);
    const [activity, setActivity] = useState([]);
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [messages, setMessages] = useState([]); // inbox/notification messages
    const [conversations, setConversations] = useState([]); // chat conversations
    const [verificationStatus, setVerificationStatus] = useState(null);
    const [subscription, setSubscription] = useState(null);
    const [realProfilePool, setRealProfilePool] = useState([]);
    const [blockedUsers, setBlockedUsers] = useState([]);
    const [campaigns, setCampaigns] = useState({
        bannerAds: true,
        intercomPromo: false,
        lockMessageLimit: true,
        dailySwipeLimit: true
    });

    const presenceIntervalRef = useRef(null);
    const userRef = useRef(null);
    useEffect(() => { userRef.current = user; }, [user]);

    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // ---- Load App campaigns config ----
    useEffect(() => {
        async function loadCampaigns() {
            try {
                const res = await fetch('/api/admin/settings');
                if (res.ok) {
                    const data = await res.json();
                    setCampaigns(data);
                }
            } catch (err) {
                console.error('Failed to load campaigns config:', err);
            }
        }
        loadCampaigns();
    }, []);

    // ---- Initialize: Supabase auth session ----
    useEffect(() => {
        let mounted = true;

        // Register GoNative/Median Native Google Sign-In Callback
        if (typeof window !== 'undefined') {
            window.gonativeGoogleSignInCallback = async (authData) => {
                console.log('[Native Google Auth] Callback received:', authData);
                
                let payload = authData;
                if (typeof authData === 'string') {
                    try {
                        payload = JSON.parse(authData);
                    } catch (e) {
                        console.error('[Native Google Auth] Failed to parse authData string:', e);
                    }
                }

                if (payload && payload.idToken) {
                    setLoading(true);
                    try {
                        const { data: authRes, error: authErr } = await supabase.auth.signInWithIdToken({
                            provider: 'google',
                            token: payload.idToken
                        });

                        if (authErr) throw authErr;

                        if (authRes?.user) {
                            // Perform welcome upsert server-side to guarantee profile is created
                            const displayName = payload.name || payload.email?.split('@')[0] || 'User';
                            fetch('/api/welcome', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    userId: authRes.user.id,
                                    email: payload.email || authRes.user.email,
                                    displayName: displayName,
                                    extraData: {
                                        avatar_url: payload.imageUrl || '',
                                    }
                                }),
                            }).catch(err => console.warn('[Native Google Auth] Welcome API failed:', err));

                            const userData = await fetchUserProfile(authRes.user.id, authRes.user);
                            if (mounted) {
                                setUser(userData);
                                await loadUserData(authRes.user.id);
                                window.location.href = '/discover';
                            }
                        }
                    } catch (err) {
                        console.error('[Native Google Auth] Sign-in error:', err);
                        alert('Native Google Sign-in failed: ' + (err.message || err));
                    } finally {
                        if (mounted) setLoading(false);
                    }
                } else {
                    const errText = payload?.error || 'No ID Token received from device.';
                    console.error('[Native Google Auth] Invalid payload:', payload);
                    alert('Google Sign-in failed: ' + errText);
                }
            };
        }

        // Fast loading: check localStorage and cookies synchronously to resolve loading instantly if no session
        let tokenExists = false;
        let hasAuthCookie = false;
        let isAuthCallback = false;
        try {
            tokenExists = Object.keys(localStorage).some(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
            if (typeof document !== 'undefined') {
                hasAuthCookie = document.cookie.split(';').some(c => c.trim().startsWith('sb-'));
            }
            if (typeof window !== 'undefined') {
                isAuthCallback = 
                    window.location.hash.includes('access_token=') || 
                    window.location.search.includes('code=') ||
                    window.location.pathname.includes('/auth/callback');
            }
        } catch (_) {}

        // Failsafe: if token, cookie, or callback exists, wait up to 4s. Otherwise, resolve in 2500ms
        const timeoutMs = (tokenExists || hasAuthCookie || isAuthCallback) ? 4000 : 2500;
        const failsafe = setTimeout(() => {
            if (mounted) {
                setLoading(false);
            }
        }, timeoutMs);

        async function init() {
            try {
                initNotifications().catch(() => { });

                // Get current session
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    console.error('[Auth] Session error:', error);
                }

                if (session?.user && mounted) {
                    const userData = await fetchUserProfile(session.user.id, session.user);
                    if (mounted) {
                        setUser(userData);
                        await loadUserData(session.user.id);
                    }
                } else if (mounted) {
                    // No session — user will be redirected to login by AuthGuard
                }
            } catch (err) {
                console.error('[Auth] Init error:', err);
            } finally {
                clearTimeout(failsafe);
                if (mounted) setLoading(false);
            }
        }

        init();

        // Listen for auth changes (login, logout, token refresh)
        const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (!mounted) return;

                // Defer async operations to the next event loop tick to prevent deadlocks
                // inside Supabase's internal state transitions (e.g. during exchangeCodeForSession)
                setTimeout(async () => {
                    if (!mounted) return;
                    try {
                        if (event === 'SIGNED_IN' && session?.user) {
                            const userData = await fetchUserProfile(session.user.id, session.user);
                            if (mounted) {
                                setUser(userData);
                                await loadUserData(session.user.id);
                            }
                        } else if (event === 'SIGNED_OUT') {
                            if (mounted) {
                                setUser(null);
                                resetState();
                            }
                        }
                    } catch (err) {
                        console.error('[Auth] Error handling auth state change:', err);
                    }
                }, 0);
            }
        );

        return () => {
            mounted = false;
            clearTimeout(failsafe);
            authSub?.unsubscribe();
        };
    }, []);

    // ---- Fetch or create user profile from Supabase ----
    async function fetchUserProfile(userId, authUser) {
        // Fetch fallback badge from app_settings ledger
        let fallbackBadge = '';
        try {
            const { data: ledgerRes } = await supabase
                .from('app_settings')
                .select('*')
                .eq('key', 'fallback_ledger')
                .single();
            if (ledgerRes && ledgerRes.value) {
                const ledger = typeof ledgerRes.value === 'string' ? JSON.parse(ledgerRes.value) : ledgerRes.value;
                if (ledger.custom_badges && ledger.custom_badges[userId]) {
                    fallbackBadge = ledger.custom_badges[userId];
                }
            }
        } catch {}

        try {
            const { data: profile, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (error && error.code === 'PGRST116') {
                // Profile doesn't exist yet — create it (for OAuth users)
                const { data: newProfile } = await supabase
                    .from('users')
                    .insert({
                        id: userId,
                        email: authUser.email,
                        display_name: authUser.user_metadata?.display_name
                            || authUser.user_metadata?.full_name
                            || authUser.user_metadata?.name
                            || authUser.email?.split('@')[0] || 'User',
                        avatar_url: authUser.user_metadata?.avatar_url
                            || authUser.user_metadata?.picture || '',
                    })
                    .select()
                    .single();

                const formatted = formatUserData(newProfile || { id: userId, email: authUser.email });
                if (fallbackBadge) formatted.customBadge = fallbackBadge;

                // Send welcome message server-side (service role key — bypasses RLS safely)
                fetch('/api/welcome', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId,
                        displayName: formatted.display_name,
                    }),
                }).catch(err => console.warn('[Auth] Welcome API call failed:', err));

                return formatted;
            }

            if (error) {
                console.error('[Auth] Profile fetch error:', error);
                // Return minimal user data from auth with proper defaults
                const formatted = formatUserData({
                    id: userId,
                    email: authUser.email,
                    display_name: authUser.user_metadata?.display_name 
                        || authUser.user_metadata?.full_name 
                        || authUser.user_metadata?.name 
                        || authUser.email?.split('@')[0] || 'User',
                    avatar_url: authUser.user_metadata?.avatar_url || '',
                });
                if (fallbackBadge) formatted.customBadge = fallbackBadge;
                return formatted;
            }

            const formatted = formatUserData(profile);
            if (fallbackBadge) formatted.customBadge = fallbackBadge;
            return formatted;
        } catch (err) {
            console.error('[Auth] fetchUserProfile error:', err);
            const formatted = formatUserData({
                id: userId,
                email: authUser.email,
                display_name: authUser.email?.split('@')[0] || 'User',
                avatar_url: '',
            });
            if (fallbackBadge) formatted.customBadge = fallbackBadge;
            return formatted;
        }
    }

    function formatUserData(profile) {
        return {
            id: profile.id,
            email: profile.email,
            display_name: profile.display_name || profile.email?.split('@')[0] || 'User',
            avatar_url: profile.avatar_url || '',
            photos: profile.images || [],
            bio: profile.bio || '',
            interests: profile.interests || [],
            hobbies: profile.hobbies || [],
            gender: profile.gender || '',
            lookingFor: profile.looking_for || '',
            age: profile.age || null,
            location: profile.location || '',
            phone: profile.phone || '',
            isPublic: profile.is_public !== false,
            isOnline: profile.is_online || false,
            lastSeenAt: profile.last_seen_at || null,
            createdAt: profile.created_at,
            isAdmin: profile.is_admin || false,
            isBanned: profile.is_banned || false,
            customBadge: profile.custom_badge || '',
        };
    }

    // Helper to resolve the last unlocked message for each conversation
    async function resolveConversations(convs, userId) {
        if (!convs || convs.length === 0) return [];
        try {
            const convIds = convs.map(c => c.id);
            const { data: latestMsgs } = await supabase
                .from('messages')
                .select('conversation_id, content, created_at')
                .in('conversation_id', convIds)
                .lte('created_at', new Date().toISOString())
                .order('created_at', { ascending: false });

            const latestMap = {};
            if (latestMsgs) {
                latestMsgs.forEach(m => {
                    if (!latestMap[m.conversation_id]) {
                        latestMap[m.conversation_id] = m;
                    }
                });
            }

            return convs.map(c => {
                const latest = latestMap[c.id];
                return {
                    id: c.id,
                    matchWpId: c.match_wp_id,
                    matchName: c.match_name,
                    matchImage: c.match_image,
                    lastMessage: latest ? latest.content : c.last_message,
                    lastMessageAt: latest ? latest.created_at : c.last_message_at,
                    unreadCount: c.unread_count,
                };
            });
        } catch (err) {
            console.error('Failed to resolve conversations:', err);
            return convs.map(c => ({
                id: c.id,
                matchWpId: c.match_wp_id,
                matchName: c.match_name,
                matchImage: c.match_image,
                lastMessage: c.last_message,
                lastMessageAt: c.last_message_at,
                unreadCount: c.unread_count,
            }));
        }
    }

    // ---- Load all user data from Supabase ----
    async function loadUserData(userId) {
        try {
            const [
                likesRes, matchesRes, savedRes, activityRes,
                notifRes, convRes, verifRes, subRes, blockedRes, prefsRes,
            ] = await Promise.all([
                supabase.from('likes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
                supabase.from('matches').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
                supabase.from('saved_profiles').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
                supabase.from('activity').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
                supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(200),
                supabase.from('conversations').select('*').eq('user_id', userId).order('last_message_at', { ascending: false }),
                supabase.from('verification_requests').select('*').eq('user_id', userId).single(),
                supabase.from('subscriptions').select('*').eq('user_id', userId).single(),
                supabase.from('blocked_users').select('blocked_wp_id').eq('blocker_id', userId),
                supabase.from('preferences').select('*').eq('user_id', userId).single(),
            ]);

            setLikes((likesRes.data || []).map(l => ({
                wpId: l.profile_wp_id, name: l.profile_name,
                imageUrl: l.profile_image, location: l.profile_location,
                likedAt: l.created_at, super: l.is_super_like,
            })));

            setMatches((matchesRes.data || []).map(m => ({
                wpId: m.profile_wp_id, name: m.profile_name,
                imageUrl: m.profile_image, location: m.profile_location,
                score: m.score, seen: m.seen, matchedAt: m.created_at,
            })));

            setSaved((savedRes.data || []).map(s => ({
                wpId: s.profile_wp_id, name: s.profile_name,
                imageUrl: s.profile_image, location: s.profile_location,
                savedAt: s.created_at,
            })));

            setActivity((activityRes.data || []).map(a => ({
                id: a.id, type: a.type, title: a.title,
                message: a.message, image: a.image,
                profileId: a.profile_id, read: a.is_read,
                timestamp: a.created_at,
            })));

            setMessages((notifRes.data || []).map(n => ({
                id: n.id, type: n.type, sender: n.sender,
                senderImage: n.sender_image, title: n.title,
                body: n.body, profileId: n.profile_id,
                read: n.is_read, createdAt: n.created_at, timestamp: n.created_at
            })));

            // --- Welcome message is now sent server-side via /api/welcome on new user creation ---
            // (See fetchUserProfile above — only fires once per user, idempotent)

            const resolvedConvs = await resolveConversations(convRes.data || [], userId);
            setConversations(resolvedConvs);

            let activeSub = subRes.data || null;
            if (!activeSub) {
                try {
                    const { data: ledgerRes } = await supabase
                        .from('app_settings')
                        .select('*')
                        .eq('key', 'fallback_ledger')
                        .single();
                    if (ledgerRes && ledgerRes.value) {
                        const ledger = typeof ledgerRes.value === 'string' ? JSON.parse(ledgerRes.value) : ledgerRes.value;
                        if (ledger.user_plans && ledger.user_plans[userId]) {
                            activeSub = {
                                user_id: userId,
                                plan: ledger.user_plans[userId].plan,
                                started_at: ledger.user_plans[userId].started_at,
                                expires_at: ledger.user_plans[userId].expires_at,
                            };
                        }
                    }
                } catch (ledgerLoadErr) {
                    console.warn('[Auth] Fallback ledger load error:', ledgerLoadErr.message);
                }
            }

            setVerificationStatus(verifRes.data?.status || null);
            setSubscription(activeSub);
            setBlockedUsers((blockedRes.data || []).map(b => b.blocked_wp_id));

            if (prefsRes.data) {
                setSettings({
                    isPublic: prefsRes.data.is_public ?? true,
                    locationEnabled: prefsRes.data.location_enabled ?? false,
                    notifications: prefsRes.data.notifications_enabled ?? true,
                    showOnline: prefsRes.data.show_online ?? true,
                    showAge: prefsRes.data.show_age ?? true,
                    emailNotifications: prefsRes.data.email_notifications ?? false,
                    darkMode: false,
                });
            }
        } catch (err) {
            console.error('[Auth] loadUserData error:', err);
        }
    }

    // ---- Realtime: Listen for verification status changes ----
    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel('verification-updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'verification_requests',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    const newStatus = payload.new?.status;
                    if (newStatus) {
                        setVerificationStatus(newStatus);
                        if (newStatus === 'verified') {
                            // Trigger push notification
                            import('@/lib/notifications').then(({ notifySystem }) => {
                                notifySystem('✅ Profile Verified!', 'Your identity has been verified. You now have the GS verified badge!');
                            });
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    // ---- Realtime: Listen for subscription plan changes (badge updates) ----
    useEffect(() => {
        if (!user?.id) return;

        // Primary: realtime DB listener on subscriptions table
        let channel;
        try {
            channel = supabase
                .channel('subscription-updates')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'subscriptions',
                        filter: `user_id=eq.${user.id}`,
                    },
                    (payload) => {
                        const updated = payload.new;
                        if (updated && updated.plan) {
                            setSubscription({
                                user_id: updated.user_id,
                                plan: updated.plan,
                                started_at: updated.started_at,
                                expires_at: updated.expires_at,
                            });
                        }
                    }
                )
                .subscribe();
        } catch (realtimeErr) {
            console.warn('[Auth] Subscription realtime failed, using polling fallback:', realtimeErr);
        }

        // Fallback: Poll the app_settings fallback ledger every 30s for plan updates
        const pollLedger = async () => {
            try {
                const { data: ledgerRec } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'fallback_ledger')
                    .single();
                if (ledgerRec?.value) {
                    const ledger = typeof ledgerRec.value === 'string' ? JSON.parse(ledgerRec.value) : ledgerRec.value;
                    if (ledger.user_plans?.[user.id]) {
                        const ledgerPlan = ledger.user_plans[user.id];
                        setSubscription(prev => {
                            // Only update if the plan actually changed
                            if (!prev || prev.plan !== ledgerPlan.plan) {
                                return {
                                    user_id: user.id,
                                    plan: ledgerPlan.plan,
                                    started_at: ledgerPlan.started_at,
                                    expires_at: ledgerPlan.expires_at,
                                };
                            }
                            return prev;
                        });
                    }
                }
            } catch { /* silent */ }
        };
        const pollInterval = setInterval(pollLedger, 30000);

        return () => {
            if (channel) supabase.removeChannel(channel);
            clearInterval(pollInterval);
        };
    }, [user?.id]);

    // ---- Realtime: Listen for new notifications ----
    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel('notification-updates')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    const newNotif = payload.new;
                    if (newNotif) {
                        setMessages(prev => [{
                            id: newNotif.id,
                            type: newNotif.type,
                            sender: newNotif.sender,
                            senderImage: newNotif.sender_image,
                            title: newNotif.title,
                            body: newNotif.body,
                            profileId: newNotif.profile_id,
                            read: newNotif.is_read,
                            createdAt: newNotif.created_at,
                        }, ...prev]);

                        // Show push notification for new alerts
                        import('@/lib/notifications').then(({ sendNotification }) => {
                            sendNotification(newNotif.title, newNotif.body, {
                                tag: `notif-${newNotif.id}`,
                                icon: newNotif.sender_image || '/gs-logo.png',
                            });
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    // ---- Fetch Real Profile Pool (for matching) ----
    useEffect(() => {
        async function loadProfilePool() {
            try {
                const res = await fetch('/api/profiles?page=1&per_page=30');
                const data = await res.json();
                if (data.profiles && data.profiles.length > 0) {
                    setRealProfilePool(data.profiles);
                }
            } catch (err) {
                console.error('Failed to load profile pool:', err);
            }
        }
        loadProfilePool();
    }, []);

    // ---- Presence System: Update last_seen periodically ----
    useEffect(() => {
        if (!user?.id) {
            if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current);
            return;
        }

        const updatePresence = async () => {
            try {
                await supabase
                    .from('users')
                    .update({ is_online: true, last_seen_at: new Date().toISOString() })
                    .eq('id', user.id);
            } catch { }
        };

        // Update immediately and then every 2 minutes
        updatePresence();
        presenceIntervalRef.current = setInterval(updatePresence, 120000);

        // Set offline on page unload
        const handleUnload = () => {
            navigator.sendBeacon?.(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`, '');
        };
        window.addEventListener('beforeunload', handleUnload);

        return () => {
            if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current);
            window.removeEventListener('beforeunload', handleUnload);
        };
    }, [user?.id]);

    // ---- Activity Logger ----
    const logActivity = useCallback(async (type, data) => {
        if (!user?.id) return;
        try {
            const { data: entry, error } = await supabase
                .from('activity')
                .insert({
                    user_id: user.id,
                    type,
                    title: data.title || '',
                    message: data.message || '',
                    image: data.image || '',
                    profile_id: data.profileId || null,
                })
                .select()
                .single();

            if (!error && entry) {
                setActivity(prev => [{
                    id: entry.id, type: entry.type, title: entry.title,
                    message: entry.message, image: entry.image,
                    profileId: entry.profile_id, read: false,
                    timestamp: entry.created_at,
                }, ...prev].slice(0, 100));
            }
        } catch (err) {
            console.error('[Activity] log error:', err);
        }
    }, [user?.id]);

    const markActivityRead = useCallback(async () => {
        if (!user?.id) return;
        try {
            await supabase
                .from('activity')
                .update({ is_read: true })
                .eq('user_id', user.id)
                .eq('is_read', false);
            setActivity(prev => prev.map(a => ({ ...a, read: true })));
        } catch { }
    }, [user?.id]);

    const markSingleActivityRead = useCallback(async (activityId) => {
        if (!user?.id) return;
        try {
            await supabase
                .from('activity')
                .update({ is_read: true })
                .eq('id', activityId)
                .eq('user_id', user.id);
            setActivity(prev => prev.map(a => a.id === activityId ? { ...a, read: true } : a));
        } catch { }
    }, [user?.id]);

    // ---- Inbox Messages (system notifications) ----
    const addMessage = useCallback(async (msg) => {
        if (!user?.id) return;
        try {
            const { data: entry } = await supabase
                .from('notifications')
                .insert({
                    user_id: user.id,
                    type: msg.type || 'system',
                    sender: msg.sender || 'GS Support',
                    sender_image: msg.senderImage || (['GS Support', 'GS Verification', 'GS Admin', 'GS support', 'GS verification'].includes(msg.sender || 'GS Support') ? '/gs-logo.png' : ''),
                    title: msg.title || '',
                    body: msg.body || '',
                    profile_id: msg.profileId || null,
                })
                .select()
                .single();

            if (entry) {
                setMessages(prev => [{
                    id: entry.id, type: entry.type, sender: entry.sender,
                    senderImage: entry.sender_image, title: entry.title,
                    body: entry.body, profileId: entry.profile_id,
                    read: false, createdAt: entry.created_at, timestamp: entry.created_at
                }, ...prev].slice(0, 200));
            }
        } catch { }
    }, [user?.id]);

    const markMessagesRead = useCallback(async () => {
        if (!user?.id) return;
        try {
            await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', user.id)
                .eq('is_read', false);
            setMessages(prev => prev.map(m => ({ ...m, read: true })));
        } catch { }
    }, [user?.id]);

    const markSingleMessageRead = useCallback(async (messageId) => {
        if (!user?.id) return;
        try {
            await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', messageId)
                .eq('user_id', user.id);
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, read: true } : m));
        } catch { }
    }, [user?.id]);

    const deleteMessage = useCallback(async (messageId) => {
        if (!user?.id) return;
        try {
            await supabase
                .from('notifications')
                .delete()
                .eq('id', messageId)
                .eq('user_id', user.id);
            setMessages(prev => prev.filter(m => m.id !== messageId));
        } catch (err) {
            console.error('[AuthContext] Failed to delete notification:', err);
        }
    }, [user?.id]);

    // ---- Auth Methods ----
    async function signUp(email, password, displayName, extraData = {}) {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        display_name: displayName || email.split('@')[0],
                        gender: extraData.gender || '',
                        looking_for: extraData.lookingFor || '',
                        age: extraData.age || null,
                        location: extraData.location || '',
                    },
                },
            });

            if (error) throw new Error(error.message);
            if (!data.user) throw new Error('Registration failed. Please try again.');

            // Upsert the user profile with extra data to avoid race conditions with database triggers
            const profilePayload = {
                id: data.user.id,
                email: email,
                display_name: displayName || email.split('@')[0],
                gender: extraData.gender || null,
                looking_for: extraData.lookingFor || null,
                age: extraData.age || null,
                location: extraData.location || '',
                interests: extraData.interests || [],
                hobbies: extraData.hobbies || [],
                is_public: extraData.isPublic !== false,
            };

            let { error: profileError } = await supabase
                .from('users')
                .upsert(profilePayload);

            if (profileError && (
                profileError.message?.includes('hobbies') || 
                profileError.code === 'PGRST100' || 
                profileError.code === '42703'
            )) {
                console.warn('[Auth] hobbies column missing on signup upsert, retrying without it...');
                const fallbackPayload = { ...profilePayload };
                delete fallbackPayload.hobbies;
                const retry = await supabase
                    .from('users')
                    .upsert(fallbackPayload);
                profileError = retry.error;
            }

            if (profileError) {
                console.error('[Auth] Profile update after signup error:', profileError);
            }

            const userData = await fetchUserProfile(data.user.id, data.user);
            setUser(userData);

            // Send welcome message server-side — safe, idempotent, bypasses RLS
            // Performs server-side upsert using service_role key to prevent client RLS block
            fetch('/api/welcome', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: data.user.id,
                    email: email,
                    displayName: displayName || email.split('@')[0],
                    extraData: {
                        gender: extraData.gender || null,
                        lookingFor: extraData.lookingFor || null,
                        age: extraData.age || null,
                        location: extraData.location || '',
                        interests: extraData.interests || [],
                        hobbies: extraData.hobbies || [],
                        isPublic: extraData.isPublic !== false,
                    }
                }),
            }).catch(err => console.warn('[Auth] Welcome API call failed (signup):', err));

            return userData;
        } catch (err) {
            throw err;
        }
    }

    async function signIn(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw new Error(error.message);
            if (!data.user) throw new Error('Login failed. Please try again.');

            const userData = await fetchUserProfile(data.user.id, data.user);
            setUser(userData);
            
            // Load matches, likes, saves, and notifications immediately on login
            await loadUserData(data.user.id);

            // Log login activity
            await logActivity('login', {
                title: 'Signed in',
                message: `Welcome back, ${userData.display_name}!`,
            });

            return userData;
        } catch (err) {
            throw err;
        }
    }

    async function signInWithGoogle() {
        try {
            const isLocal = typeof window !== 'undefined' && 
                (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
            const redirectOrigin = isLocal ? window.location.origin : 'https://genuine-sugarmummies-app.vercel.app';

            // Check if device is mobile (to bypass popup block issues entirely)
            const isMobileDevice = typeof window !== 'undefined' && 
                (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

            // Detect if running inside any WebView (to bypass Google disallowed_useragent blocks)
            let isWebView = false;
            if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
                const ua = navigator.userAgent;
                const isAndroidWebView = /Android/i.test(ua) && (/Version\/[0-9.]+/i.test(ua) || ua.includes('wv'));
                const isIOSWebView = /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(ua);
                
                if (isAndroidWebView || 
                    isIOSWebView || 
                    window.gonative || 
                    window.median ||
                    window.webkit?.messageHandlers?.gonative || 
                    window.webkit?.messageHandlers?.median ||
                    ua.includes('GoNative') || 
                    ua.includes('Median') ||
                    localStorage.getItem('is_gonative') === 'true') {
                    isWebView = true;
                }
            }

            // 1. FOR WEBVIEWS: Try Native Google Sign-In first (pop up Gmail selector on device)
            // We ONLY trigger native if the actual JS Bridge or iOS webkit handlers exist.
            if (isWebView) {
                let nativeTriggered = false;
                try {
                    // Try Median JS API
                    if (window.median && window.median.google && typeof window.median.google.signIn === 'function') {
                        console.log('[Native Google Auth] Triggering Median JS API...');
                        window.median.google.signIn({ callback: 'gonativeGoogleSignInCallback' });
                        nativeTriggered = true;
                    } 
                    // Try GoNative JS API
                    else if (window.gonative && window.gonative.google && typeof window.gonative.google.signIn === 'function') {
                        console.log('[Native Google Auth] Triggering GoNative JS API...');
                        window.gonative.google.signIn({ callback: 'gonativeGoogleSignInCallback' });
                        nativeTriggered = true;
                    } 
                    // Try iOS Median message handler
                    else if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.medianGoogleSignIn) {
                        console.log('[Native Google Auth] Triggering iOS Median postMessage...');
                        window.webkit.messageHandlers.medianGoogleSignIn.postMessage({ callback: 'gonativeGoogleSignInCallback' });
                        nativeTriggered = true;
                    }
                    // Try iOS GoNative message handler
                    else if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.gonativeGoogleSignIn) {
                        console.log('[Native Google Auth] Triggering iOS GoNative postMessage...');
                        window.webkit.messageHandlers.gonativeGoogleSignIn.postMessage({ callback: 'gonativeGoogleSignInCallback' });
                        nativeTriggered = true;
                    }
                } catch (nativeErr) {
                    console.warn('[Native Google Auth] Failed to trigger native flow, falling back to secure browser sync...', nativeErr);
                }

                if (nativeTriggered) {
                    return { isPopup: false };
                }

                // --- Fallback: Secure system browser sync flow (with sync_code) ---
                // Generate a one-time sync code
                const syncCode = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
                
                // Initialize the sync session record in public app_settings table
                await supabase.from('app_settings').upsert({
                    key: `auth_sync_${syncCode}`,
                    value: { status: 'pending', createdAt: Date.now() }
                }, { onConflict: 'key' });

                // Generate Google sign-in URL with the sync_code query parameter
                const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: `${redirectOrigin}/auth/callback?sync_code=${syncCode}`,
                        queryParams: {
                            access_type: 'offline',
                            prompt: 'consent',
                        },
                        skipBrowserRedirect: true,
                    },
                });

                if (error) throw new Error(error.message);
                if (!data?.url) throw new Error('Failed to generate Google Sign-In URL');

                // Define a failproof function to trigger opening in native/external browser
                const openExternalBrowser = (url) => {
                    let opened = false;
                    try {
                        if (typeof window !== 'undefined') {
                            if (window.median && window.median.browser && typeof window.median.browser.open === 'function') {
                                window.median.browser.open({ url });
                                opened = true;
                            } else if (window.gonative && window.gonative.browser && typeof window.gonative.browser.open === 'function') {
                                window.gonative.browser.open({ url });
                                opened = true;
                            } else if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.median) {
                                window.webkit.messageHandlers.median.postMessage({
                                    browser: {
                                        open: url
                                    }
                                });
                                opened = true;
                            } else if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.gonative) {
                                window.webkit.messageHandlers.gonative.postMessage({
                                    browser: {
                                        open: url
                                    }
                                });
                                opened = true;
                            }
                        }
                    } catch (bridgeErr) {
                        console.error('[GoNative/Median Bridge Open Error]', bridgeErr);
                    }

                    if (!opened) {
                        try {
                            const iframe = document.createElement('iframe');
                            iframe.style.display = 'none';
                            iframe.src = 'gonative://browser/open?url=' + encodeURIComponent(url);
                            document.body.appendChild(iframe);
                            setTimeout(() => iframe.remove(), 500);
                            opened = true;
                        } catch (e) {
                            try {
                                const iframe = document.createElement('iframe');
                                iframe.style.display = 'none';
                                iframe.src = 'median://browser/open?url=' + encodeURIComponent(url);
                                document.body.appendChild(iframe);
                                setTimeout(() => iframe.remove(), 500);
                                opened = true;
                            } catch (e2) {
                                window.location.href = 'gonative://browser/open?url=' + encodeURIComponent(url);
                                opened = true;
                            }
                        }
                    }
                };

                // Automatically trigger in-app secure tab opening on start (forces Chrome Custom Tabs / Safari View Controller in GoNative)
                let autoOpened = false;
                try {
                    if (typeof window !== 'undefined') {
                        const pop = window.open(data.url, '_blank');
                        if (pop) autoOpened = true;
                    }
                } catch (e) {
                    console.error('[Auto window.open error]', e);
                }

                if (!autoOpened) {
                    openExternalBrowser(data.url);
                }

                // Show a beautiful full-screen loading overlay inside the app WebView
                let overlay = null;
                if (typeof document !== 'undefined') {
                    overlay = document.createElement('div');
                    overlay.id = 'gs-google-sync-overlay';
                    overlay.style.position = 'fixed';
                    overlay.style.inset = '0';
                    overlay.style.zIndex = '99999';
                    overlay.style.display = 'flex';
                    overlay.style.flexDirection = 'column';
                    overlay.style.alignItems = 'center';
                    overlay.style.justifyContent = 'center';
                    overlay.style.background = 'rgba(15, 15, 20, 0.96)';
                    overlay.style.backdropFilter = 'blur(10px)';
                    overlay.style.color = '#FFFFFF';
                    overlay.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
                    overlay.style.padding = '24px';
                    overlay.style.textAlign = 'center';
                    overlay.innerHTML = `
                        <div style="animation: spin 1s linear infinite; width: 44px; height: 44px; border: 3.5px solid rgba(255,255,255,0.1); border-top-color: #FF5A5F; border-radius: 50%; margin-bottom: 20px;"></div>
                        <h3 style="font-size: 18px; font-weight: 800; margin: 0 0 8px 0; color: #FFFFFF;">Waiting for Google Sign-In</h3>
                        <p style="font-size: 13px; color: rgba(255,255,255,0.7); max-width: 265px; margin: 0 0 24px 0; line-height: 1.5;">We have opened Google Sign-In in your secure device browser. Please sign in there to connect.</p>
                        
                        <!-- Recovery Buttons -->
                        <div style="display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 240px; margin-bottom: 12px;">
                            <button id="gs-manual-open-btn" style="background: linear-gradient(135deg, #FF5A5F 0%, #FF2A6D 100%); border: none; color: #FFFFFF; font-size: 13px; font-weight: 700; padding: 12px 20px; border-radius: 14px; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 15px rgba(255,90,95,0.3); outline: none; -webkit-tap-highlight-color: transparent;">Open Sign-In Browser</button>
                            <button id="gs-cancel-sync-btn" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #FFFFFF; font-size: 13px; font-weight: 600; padding: 11px 20px; border-radius: 14px; cursor: pointer; transition: all 0.2s; outline: none; -webkit-tap-highlight-color: transparent;">Cancel</button>
                        </div>
                        <p style="font-size: 11px; color: rgba(255,255,255,0.4); max-width: 220px; margin: 0; line-height: 1.4;">If the sign-in page did not open automatically, click the red button above.</p>
                        
                        <style>
                            @keyframes spin { to { transform: rotate(360deg); } }
                            #gs-manual-open-btn:active { transform: scale(0.96); opacity: 0.9; }
                            #gs-cancel-sync-btn:active { background: rgba(255,255,255,0.18); transform: scale(0.96); }
                        </style>
                    `;
                    document.body.appendChild(overlay);
                }

                // Poll the Supabase app_settings table for the session token
                let pollCount = 0;
                const pollInterval = setInterval(async () => {
                    pollCount++;
                    // Timeout after 5 minutes (200 polls of 1.5s)
                    if (pollCount > 200) {
                        clearInterval(pollInterval);
                        if (overlay) overlay.remove();
                        supabase.from('app_settings').delete().eq('key', `auth_sync_${syncCode}`).catch(() => {});
                        alert('Sign-in timed out. Please try again.');
                        return;
                    }

                    try {
                        const { data: syncRes } = await supabase
                            .from('app_settings')
                            .select('value')
                            .eq('key', `auth_sync_${syncCode}`)
                            .maybeSingle();

                        if (syncRes?.value && syncRes.value.status === 'completed') {
                            clearInterval(pollInterval);
                            const sessionData = syncRes.value.session;

                            // Apply session to main WebView Supabase client
                            const { error: setSessionErr } = await supabase.auth.setSession({
                                access_token: sessionData.access_token,
                                refresh_token: sessionData.refresh_token
                            });

                            if (overlay) overlay.remove();
                            
                            // Delete sync code row from database
                            await supabase.from('app_settings').delete().eq('key', `auth_sync_${syncCode}`).catch(() => {});

                            if (!setSessionErr) {
                                window.location.href = '/discover';
                            } else {
                                alert('Failed to sync session: ' + setSessionErr.message);
                            }
                        }
                    } catch (pollErr) {
                        console.error('[Google OAuth Poll] Error:', pollErr);
                    }
                }, 1500);

                // Wire manual open button
                const manualOpenBtn = document.getElementById('gs-manual-open-btn');
                if (manualOpenBtn) {
                    manualOpenBtn.onclick = () => {
                        let manualOpened = false;
                        try {
                            if (typeof window !== 'undefined') {
                                const pop = window.open(data.url, '_blank');
                                if (pop) manualOpened = true;
                            }
                        } catch (e) {
                            console.error('[Manual window.open error]', e);
                        }

                        if (!manualOpened) {
                            openExternalBrowser(data.url);
                        }
                    };
                }

                // Wire cancel button
                const cancelBtn = document.getElementById('gs-cancel-sync-btn');
                if (cancelBtn) {
                    cancelBtn.onclick = async () => {
                        clearInterval(pollInterval);
                        if (overlay) overlay.remove();
                        await supabase.from('app_settings').delete().eq('key', `auth_sync_${syncCode}`).catch(() => {});
                    };
                }

                return { isPopup: false };
            }

            // 2. FOR MOBILE BROWSERS: Always use standard page redirection to avoid popup blockers
            if (isMobileDevice) {
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: `${redirectOrigin}/auth/callback`,
                        queryParams: {
                            access_type: 'offline',
                            prompt: 'consent',
                        },
                    },
                });

                if (error) throw new Error(error.message);
                return { isPopup: false };
            }

            // 3. FOR DESKTOP BROWSERS: Try popup first, fallback to standard redirect if blocked
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${redirectOrigin}/auth/callback`,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                    skipBrowserRedirect: true,
                },
            });

            if (error) throw new Error(error.message);
            if (!data?.url) throw new Error('Failed to generate Google Sign-In URL');

            const width = 500;
            const height = 650;
            const left = window.screen.width / 2 - width / 2;
            const top = window.screen.height / 2 - height / 2;
            
            const popup = window.open(
                data.url,
                'Google Login',
                `width=${width},height=${height},top=${top},left=${left},status=no,resizable=yes,scrollbars=yes`
            );

            if (popup) {
                return { isPopup: true, popup };
            }

            // Fallback for desktop browser if popup is blocked
            const { error: redirectError } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${redirectOrigin}/auth/callback`,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            });

            if (redirectError) throw new Error(redirectError.message);
            return { isPopup: false };
        } catch (err) {
            throw err;
        }
    }

    async function resetPassword(email) {
        try {
            const isLocal = typeof window !== 'undefined' && 
                (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
            const redirectOrigin = isLocal ? window.location.origin : 'https://genuine-sugarmummies-app.vercel.app';

            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${redirectOrigin}/auth/login`,
            });
            if (error) throw new Error(error.message);
            return true;
        } catch (err) {
            throw err;
        }
    }

    async function signOut() {
        // Set offline before signing out
        if (user?.id) {
            try {
                await supabase
                    .from('users')
                    .update({ is_online: false })
                    .eq('id', user.id);
            } catch { }
        }

        await supabase.auth.signOut();
        resetState();
        if (typeof window !== 'undefined') {
            localStorage.removeItem('guest_mode');
        }
    }

    function resetState() {
        setUser(null);
        setLikes([]);
        setMatches([]);
        setSaved([]);
        setActivity([]);
        setMessages([]);
        setConversations([]);
        setSettings(DEFAULT_SETTINGS);
        setVerificationStatus(null);
        setSubscription(null);
        setBlockedUsers([]);
    }

    // Check if user needs to complete onboarding (Google OAuth users)
    const needsOnboarding = user && (!user.gender || !user.lookingFor || !user.age);

    // ---- Profile Management ----
    async function updateProfile(updates) {
        if (!user?.id) return;
        try {
            const dbUpdates = {};
            if (updates.display_name !== undefined) dbUpdates.display_name = updates.display_name;
            if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
            if (updates.interests !== undefined) dbUpdates.interests = updates.interests;
            if (updates.hobbies !== undefined) dbUpdates.hobbies = updates.hobbies;
            if (updates.age !== undefined) dbUpdates.age = updates.age;
            if (updates.location !== undefined) dbUpdates.location = updates.location;
            if (updates.gender !== undefined) dbUpdates.gender = updates.gender;
            if (updates.lookingFor !== undefined) dbUpdates.looking_for = updates.lookingFor;
            if (updates.avatar_url !== undefined) dbUpdates.avatar_url = updates.avatar_url;
            if (updates.photos !== undefined) dbUpdates.images = updates.photos;
            if (updates.isPublic !== undefined) dbUpdates.is_public = updates.isPublic;
            if (updates.phone !== undefined) dbUpdates.phone = updates.phone;

            let { data: updated, error } = await supabase
                .from('users')
                .update(dbUpdates)
                .eq('id', user.id)
                .select()
                .single();

            if (error) {
                if (dbUpdates.hobbies !== undefined && (
                    error.message?.includes('hobbies') || 
                    error.code === 'PGRST100' || 
                    error.code === '42703'
                )) {
                    console.warn('[Profile] hobbies column missing, retrying update without it...');
                    const fallbackUpdates = { ...dbUpdates };
                    delete fallbackUpdates.hobbies;
                    const retry = await supabase
                        .from('users')
                        .update(fallbackUpdates)
                        .eq('id', user.id)
                        .select()
                        .single();
                    if (retry.error) throw retry.error;
                    updated = retry.data;
                } else {
                    throw error;
                }
            }

            const newUser = formatUserData(updated);
            setUser(newUser);
            return newUser;
        } catch (err) {
            console.error('[Profile] Update error:', err);
        }
    }

    // Helper to upload base64 images directly to Supabase Storage (zero server load!)
    async function uploadBase64Image(base64Data, bucket, filenamePrefix) {
        if (!base64Data || !base64Data.startsWith('data:image/')) {
            return base64Data; // Return as-is if already a URL or empty
        }

        try {
            // Convert data URL to Blob
            const arr = base64Data.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            const blob = new Blob([u8arr], { type: mime });

            const ext = mime.split('/')[1] || 'jpg';
            const filename = `${filenamePrefix}_${Date.now()}.${ext}`;

            // Try direct signed URL upload
            const signedRes = await fetch(`/api/admin/setup?userId=${user?.id || 'guest'}&filename=${encodeURIComponent(filename)}&bucket=${bucket}`);
            if (signedRes.ok) {
                const signedData = await signedRes.json();
                if (signedData.signedUrl && !signedData.fallbackMode) {
                    const uploadRes = await fetch(signedData.signedUrl, {
                        method: 'PUT',
                        body: blob,
                        headers: { 'Content-Type': mime }
                    });
                    if (uploadRes.ok) {
                        return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${signedData.path}`;
                    }
                }
            }

            // Fallback to Next.js API PUT route
            const b64Res = await fetch('/api/admin/setup', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user?.id || 'guest',
                    filename,
                    base64Data,
                    mimeType: mime,
                    bucket
                })
            });
            const b64Data = await b64Res.json();
            if (b64Data.url) return b64Data.url;

        } catch (err) {
            console.error('[Storage Upload Helper Error]', err);
        }

        return base64Data; // Fallback to base64 if everything fails
    }

    async function addPhoto(dataUrl) {
        if (!user) return;
        setVerificationStatus('processing');
        try {
            const uploadedUrl = await uploadBase64Image(dataUrl, 'avatars', 'photo');
            const photos = [...(user.photos || []), uploadedUrl].slice(0, 6);
            const updates = { photos };
            if (!user.avatar_url && photos.length > 0) updates.avatar_url = photos[0];
            await updateProfile(updates);
        } catch (err) {
            console.error('[Profile Add Photo Error]', err);
        } finally {
            setVerificationStatus(null);
        }
    }

    function removePhoto(index) {
        if (!user) return;
        const photos = [...(user.photos || [])];
        photos.splice(index, 1);
        const updates = { photos, avatar_url: photos[0] || '' };
        updateProfile(updates);
        if (index === 0) {
            setVerificationStatus(null);
        }
    }

    // ---- Verification System ----
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

        setVerificationStatus('processing');

        try {
            // Upload to private/public verification bucket on Supabase Storage
            const selfieUrl = await uploadBase64Image(selfieDataUrl, 'verification-docs', 'selfie');
            const idDocUrl = await uploadBase64Image(idDocumentDataUrl, 'verification-docs', 'id_doc');

            // 1. Try standard table insert
            let dbError = null;
            try {
                const { error } = await supabase
                    .from('verification_requests')
                    .upsert({
                        user_id: user.id,
                        selfie_url: selfieUrl,
                        id_doc_url: idDocUrl,
                        status: 'pending_review',
                        submitted_at: new Date().toISOString(),
                    });
                if (error) dbError = error;
            } catch (err) {
                dbError = err;
            }

            // 2. Sync / Fallback to fallback_ledger inside app_settings
            try {
                const { data: ledgerRes } = await supabase
                    .from('app_settings')
                    .select('*')
                    .eq('key', 'fallback_ledger')
                    .single();

                let ledger = { custom_badges: {}, user_plans: {}, transactions: [], verifications: {} };
                let ledgerId = null;

                if (ledgerRes) {
                    ledgerId = ledgerRes.id;
                    ledger = typeof ledgerRes.value === 'string' ? JSON.parse(ledgerRes.value) : ledgerRes.value;
                }

                if (!ledger.verifications) ledger.verifications = {};
                ledger.verifications[user.id] = {
                    user_id: user.id,
                    status: 'pending_review',
                    selfie_url: selfieUrl,
                    id_doc_url: idDocUrl,
                    submitted_at: new Date().toISOString()
                };

                if (ledgerId) {
                    await supabase.from('app_settings').update({ value: ledger, updated_at: new Date().toISOString() }).eq('id', ledgerId);
                } else {
                    await supabase.from('app_settings').insert({ key: 'fallback_ledger', value: ledger });
                }
            } catch (fallbackErr) {
                console.warn('[Verification Fallback] Failed to sync to fallback ledger:', fallbackErr.message);
                if (dbError) throw dbError;
            }

            setVerificationStatus('pending_review');

            await logActivity('profile_update', {
                title: 'Verification Submitted',
                message: 'Your verification is under review. This may take 24-48 hours.',
            });

            addMessage({
                type: 'verification',
                sender: 'GS Verification',
                senderImage: '',
                title: '⏳ Verification Under Review',
                body: 'Your selfie and ID have been submitted for review. Our team will verify your identity within 24-48 hours.',
            });

            return 'pending_review';
        } catch (err) {
            setVerificationStatus('failed');
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

    function clearVerification() {
        setVerificationStatus(null);
        if (user?.id) {
            supabase
                .from('verification_requests')
                .delete()
                .eq('user_id', user.id)
                .then(() => { });
        }
    }

    // ---- Settings ----
    async function updateSettingsHandler(updates) {
        const updated = { ...settings, ...updates };
        setSettings(updated);
        if (user?.id) {
            try {
                await supabase
                    .from('preferences')
                    .upsert({
                        user_id: user.id,
                        notifications_enabled: updated.notifications,
                        email_notifications: updated.emailNotifications,
                        location_enabled: updated.locationEnabled,
                        show_online: updated.showOnline,
                        show_age: updated.showAge,
                    });
            } catch { }
        }
    }

    // ---- Like/Match/Pass ----
    const addLike = useCallback(async (profile) => {
        if (!user?.id) return { success: false };
        
        // Limit free user to 10 likes per day
        if (campaigns?.dailySwipeLimit && (!subscription || subscription.plan === 'free')) {
            try {
                const today = new Date();
                today.setHours(0,0,0,0);
                const { count } = await supabase
                    .from('likes')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .gte('created_at', today.toISOString());
                if (count >= 10) {
                    addMessage({
                        type: 'system',
                        sender: 'GS Support',
                        title: 'Daily Like Limit Reached',
                        body: 'Free accounts are limited to 10 swipes per day. Upgrade to Silver, Gold, or Diamond to swipe without limits!',
                    });
                    return { success: false, limitReached: true };
                }
            } catch (err) {
                console.error('[Likes] Check error:', err);
            }
        }

        try {
            await supabase
                .from('likes')
                .upsert({
                    user_id: user.id,
                    profile_wp_id: profile.wpId,
                    profile_name: profile.name || '',
                    profile_image: profile.imageUrl || '',
                    profile_location: profile.location || '',
                });

            setLikes(prev => {
                if (prev.find(l => l.wpId === profile.wpId)) return prev;
                return [...prev, { ...profile, likedAt: new Date().toISOString() }];
            });

            await logActivity('like', {
                title: `You liked ${profile.name || 'someone'}`,
                message: profile.location || '',
                image: profile.imageUrl,
                profileId: profile.wpId,
            });
            return { success: true };
        } catch {
            return { success: false };
        }
    }, [user?.id, subscription, addMessage, logActivity, campaigns]);

    const addMatch = useCallback(async (profile, score = 0) => {
        if (!user?.id) return;
        try {
            // Add to matches table
            await supabase
                .from('matches')
                .upsert({
                    user_id: user.id,
                    profile_wp_id: profile.wpId,
                    profile_name: profile.name || '',
                    profile_image: profile.imageUrl || '',
                    profile_location: profile.location || '',
                    score: score,
                });

            setMatches(prev => {
                if (prev.find(m => m.wpId === profile.wpId)) return prev;
                return [...prev, { ...profile, score, matchedAt: new Date().toISOString() }];
            });

            // Create a conversation for this match
            await supabase
                .from('conversations')
                .upsert({
                    user_id: user.id,
                    match_wp_id: profile.wpId,
                    match_name: profile.name || '',
                    match_image: profile.imageUrl || '',
                });

            // Refresh conversations
            const { data: convs } = await supabase
                .from('conversations')
                .select('*')
                .eq('user_id', user.id)
                .order('last_message_at', { ascending: false });

            if (convs) {
                const resolved = await resolveConversations(convs, user.id);
                setConversations(resolved);
            }

            await logActivity('match', {
                title: `Matched with ${profile.name || 'someone'}!`,
                message: score > 0 ? `${score}% compatibility` : 'New match!',
                image: profile.imageUrl,
                profileId: profile.wpId,
            });

            notifyMatch(profile.name || 'Someone');
        } catch { }
    }, [user?.id, logActivity]);

    const addPass = useCallback(async (profileWpId) => {
        if (!user?.id) return;
        try {
            await supabase
                .from('passes')
                .upsert({
                    user_id: user.id,
                    profile_wp_id: profileWpId,
                });
        } catch { }
    }, [user?.id]);

    // Sync version for UI filtering
    const isProfileSwiped = useCallback((wpId) => {
        return likes.some(l => l.wpId === wpId) || false;
    }, [likes]);

    // Async version with DB check
    const isProfileSwipedAsync = useCallback(async (wpId) => {
        if (!user?.id) return false;
        try {
            const { data: like } = await supabase
                .from('likes')
                .select('id')
                .eq('user_id', user.id)
                .eq('profile_wp_id', wpId)
                .single();

            if (like) return true;

            const { data: pass } = await supabase
                .from('passes')
                .select('id')
                .eq('user_id', user.id)
                .eq('profile_wp_id', wpId)
                .single();

            return !!pass;
        } catch {
            return likes.some(l => l.wpId === wpId);
        }
    }, [user?.id, likes]);

    const addSuperLike = useCallback(async (profile) => {
        if (!user?.id) return { success: false };

        // Free users cannot use Super Likes at all
        if (!subscription || subscription.plan === 'free') {
            addMessage({
                type: 'system',
                sender: 'GS Support',
                title: 'Super Like Locked',
                body: 'Super Likes are premium features. Upgrade your plan to unlock Super Likes and match instantly!',
            });
            return { success: false, limitReached: true };
        }

        try {
            await supabase
                .from('likes')
                .upsert({
                    user_id: user.id,
                    profile_wp_id: profile.wpId,
                    profile_name: profile.name || '',
                    profile_image: profile.imageUrl || '',
                    profile_location: profile.location || '',
                    is_super_like: true,
                });

            setLikes(prev => {
                if (prev.find(l => l.wpId === profile.wpId)) return prev;
                return [...prev, { ...profile, likedAt: new Date().toISOString(), super: true }];
            });

            await logActivity('like', {
                title: `You super liked ${profile.name || 'someone'}`,
                message: `${profile.location || ''} — Super Like!`,
                image: profile.imageUrl,
                profileId: profile.wpId,
            });
            return { success: true };
        } catch {
            return { success: false };
        }
    }, [user?.id, subscription, addMessage, logActivity]);

    const clearSwipeHistory = useCallback(async () => {
        if (!user?.id) return;
        try {
            await supabase
                .from('passes')
                .delete()
                .eq('user_id', user.id);
        } catch { }
    }, [user?.id]);

    // ---- Save/Unsave ----
    const saveProfile_ = useCallback(async (profile) => {
        if (!user?.id) return;
        try {
            await supabase
                .from('saved_profiles')
                .upsert({
                    user_id: user.id,
                    profile_wp_id: profile.wpId,
                    profile_name: profile.name || '',
                    profile_image: profile.imageUrl || '',
                    profile_location: profile.location || '',
                });

            setSaved(prev => {
                if (prev.find(s => s.wpId === profile.wpId)) return prev;
                return [...prev, { ...profile, savedAt: new Date().toISOString() }];
            });
        } catch { }
    }, [user?.id]);

    const unsaveProfile_ = useCallback(async (wpId) => {
        if (!user?.id) return;
        try {
            await supabase
                .from('saved_profiles')
                .delete()
                .eq('user_id', user.id)
                .eq('profile_wp_id', wpId);

            setSaved(prev => prev.filter(s => s.wpId !== wpId));
        } catch { }
    }, [user?.id]);

    const isProfileSaved = useCallback((wpId) => {
        return saved.some(s => s.wpId === wpId);
    }, [saved]);

    const getOrCreateConversation = useCallback(async (profileWpId, profileName = '', profileImage = '') => {
        if (!user?.id) return null;
        try {
            const { data: existing } = await supabase
                .from('conversations')
                .select('*')
                .eq('user_id', user.id)
                .eq('match_wp_id', profileWpId)
                .maybeSingle();

            if (existing) return existing;

            const { data: newConv, error } = await supabase
                .from('conversations')
                .upsert({
                    user_id: user.id,
                    match_wp_id: profileWpId,
                    match_name: profileName || 'Sugar Mummy',
                    match_image: profileImage || '',
                })
                .select()
                .single();

            if (error) throw error;

            const { data: convs } = await supabase
                .from('conversations')
                .select('*')
                .eq('user_id', user.id)
                .order('last_message_at', { ascending: false });

            if (convs) {
                const resolved = await resolveConversations(convs, user.id);
                setConversations(resolved);
            }

            return newConv;
        } catch (err) {
            console.error('Failed to get/create conversation:', err);
            return null;
        }
    }, [user?.id]);

    const deleteConversation = useCallback(async (conversationId) => {
        if (!user?.id) return;
        try {
            await supabase
                .from('messages')
                .delete()
                .eq('conversation_id', conversationId);

            await supabase
                .from('conversations')
                .delete()
                .eq('id', conversationId)
                .eq('user_id', user.id);

            setConversations(prev => prev.filter(c => c.id !== conversationId));
        } catch (err) {
            console.error('[AuthContext] Failed to delete conversation:', err);
        }
    }, [user?.id]);

     // ---- Chat ----
     const sendChatMessage = useCallback(async (conversationId, text, senderId = null, createdAt = null) => {
         if (!user?.id) return null;
         try {
             const insertData = {
                 conversation_id: conversationId,
                 sender_id: senderId === 'match' ? null : (senderId || user.id),
                 sender_name: senderId === 'match' 
                     ? (conversations?.find(c => c.id === conversationId)?.matchName || 'Match') 
                     : (user.display_name || user.email?.split('@')[0]),
                 content: text,
             };
             if (createdAt) {
                 insertData.created_at = createdAt.toISOString();
             }
 
             const { data: msg, error } = await supabase
                 .from('messages')
                 .insert(insertData)
                 .select()
                 .single();
 
             if (error) throw error;
 
             // Update conversation last message if it's not a future message
             if (!createdAt || createdAt <= new Date()) {
                 await supabase
                     .from('conversations')
                     .update({
                         last_message: text.substring(0, 100),
                         last_message_at: createdAt ? createdAt.toISOString() : new Date().toISOString(),
                     })
                     .eq('id', conversationId);
             }
 
             // Refresh conversations
             const { data: convs } = await supabase
                 .from('conversations')
                 .select('*')
                 .eq('user_id', user.id)
                 .order('last_message_at', { ascending: false });
 
             if (convs) {
                 const resolved = await resolveConversations(convs, user.id);
                 setConversations(resolved);
             }
 
             return msg;
         } catch (err) {
             console.error('Failed to send message:', err);
             return null;
         }
     }, [user?.id, user?.display_name, conversations]);
 
     const getChatMessages = useCallback(async (conversationId) => {
         try {
             const { data: msgs } = await supabase
                 .from('messages')
                 .select('*')
                 .eq('conversation_id', conversationId)
                 .order('created_at', { ascending: true });
 
             const now = new Date();
             return (msgs || [])
                 .filter(m => new Date(m.created_at) <= now)
                 .map(m => ({
                     id: m.id,
                     senderId: m.sender_id,
                     senderName: m.sender_name,
                     content: m.content,
                     text: m.content,
                     isRead: m.is_read,
                     createdAt: m.created_at,
                     timestamp: m.created_at,
                 }));
         } catch {
             return [];
         }
     }, []);
 
     const markChatSeen = useCallback(async (conversationId) => {
         if (!user?.id) return;
         try {
             await supabase
                 .from('messages')
                 .update({ is_read: true })
                 .eq('conversation_id', conversationId)
                 .neq('sender_id', user.id);
 
             await supabase
                 .from('conversations')
                 .update({ unread_count: 0 })
                 .eq('id', conversationId);
 
             // Refresh
             const { data: convs } = await supabase
                 .from('conversations')
                 .select('*')
                 .eq('user_id', user.id)
                 .order('last_message_at', { ascending: false });
 
             if (convs) {
                 const resolved = await resolveConversations(convs, user.id);
                 setConversations(resolved);
             }
         } catch { }
     }, [user?.id]);

    // ---- Request Connection (Telegram) ----
    const requestConnection = useCallback(async (profileName, profileId) => {
        if (!user?.id) return;
        await logActivity('connection_request', {
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
    }, [user?.id, logActivity, addMessage]);

    // ---- Log helpers ----
    const logMessageSent = useCallback(async (profileName, profileImage) => {
        if (!user?.id) return;
        await logActivity('message', { title: `Message sent to ${profileName}`, message: 'Awaiting moderation', image: profileImage });
        addMessage({
            type: 'comment_sent',
            sender: 'You',
            senderImage: '',
            title: `Comment on ${profileName}'s profile`,
            body: 'Your comment has been submitted and is awaiting admin approval.',
        });
    }, [user?.id, logActivity, addMessage]);

    const logProfileView = useCallback(async (profile) => {
        if (!user?.id) return;
        await logActivity('view', {
            title: `Viewed ${profile.name || 'a profile'}`,
            message: profile.location || '',
            image: profile.imageUrl,
            profileId: profile.wpId,
        });
    }, [user?.id, logActivity]);

    // ---- Report / Block ----
    const reportUser = useCallback(async (targetWpId, reason) => {
        if (!user?.id) return;
        await supabase
            .from('reports')
            .insert({
                reporter_id: user.id,
                target_wp_id: targetWpId,
                reason,
            });
        addMessage({
            type: 'report',
            sender: 'GS Support',
            senderImage: '',
            title: 'Report Submitted',
            body: 'Thank you for reporting. We will review this profile and take appropriate action.',
        });
    }, [user?.id, addMessage]);

    const blockUser = useCallback(async (targetWpId) => {
        if (!user?.id) return;
        await supabase
            .from('blocked_users')
            .upsert({
                blocker_id: user.id,
                blocked_wp_id: targetWpId,
            });
        setBlockedUsers(prev => [...prev, targetWpId]);
        addMessage({
            type: 'block',
            sender: 'GS Support',
            senderImage: '',
            title: 'User Blocked',
            body: 'This user has been blocked. You will no longer see their profile.',
        });
    }, [user?.id, addMessage]);

    // ---- Subscription ----
    const updateSubscription = useCallback(async (planData) => {
        if (!user?.id) return;
        const { data: updated } = await supabase
            .from('subscriptions')
            .upsert({
                user_id: user.id,
                plan: planData.plan || 'free',
                started_at: new Date().toISOString(),
                expires_at: planData.expiresAt || null,
            })
            .select()
            .single();
        setSubscription(updated);
    }, [user?.id]);

    // ---- Delete Account ----
    async function deleteAccount() {
        if (user?.id) {
            try {
                // Delete all user data from Supabase
                await Promise.all([
                    supabase.from('likes').delete().eq('user_id', user.id),
                    supabase.from('passes').delete().eq('user_id', user.id),
                    supabase.from('matches').delete().eq('user_id', user.id),
                    supabase.from('saved_profiles').delete().eq('user_id', user.id),
                    supabase.from('activity').delete().eq('user_id', user.id),
                    supabase.from('notifications').delete().eq('user_id', user.id),
                    supabase.from('conversations').delete().eq('user_id', user.id),
                    supabase.from('verification_requests').delete().eq('user_id', user.id),
                    supabase.from('subscriptions').delete().eq('user_id', user.id),
                    supabase.from('reports').delete().eq('reporter_id', user.id),
                    supabase.from('blocked_users').delete().eq('blocker_id', user.id),
                    supabase.from('preferences').delete().eq('user_id', user.id),
                    supabase.from('user_locations').delete().eq('user_id', user.id),
                    supabase.from('users').delete().eq('id', user.id),
                ]);
            } catch (err) {
                console.error('[Auth] Delete account error:', err);
            }
        }
        await supabase.auth.signOut();
        resetState();
    }

    const value = {
        user, loading, profile: user,
        needsOnboarding,
        likes, matches, saved, activity, settings,
        messages, conversations, verificationStatus, realProfilePool,
        subscription, blockedUsers, campaigns,
        signUp, signIn, signInWithGoogle, signOut, resetPassword,
        updateProfile, addPhoto, removePhoto,
        updateSettings: updateSettingsHandler,
        addLike, addMatch, addPass,
        isProfileSwiped,
        isProfileSwipedAsync,
        addSuperLike, clearSwipeHistory,
        saveProfile: saveProfile_, unsaveProfile: unsaveProfile_, isProfileSaved,
        logActivity, logMessageSent, logProfileView, markActivityRead, markSingleActivityRead,
        requestConnection,
        addMessage, markMessagesRead, markSingleMessageRead, deleteMessage,
        sendChatMessage, getChatMessages, markChatSeen,
        getOrCreateConversation, deleteConversation,
        verifyProfile, clearVerification,
        reportUser, blockUser,
        updateSubscription,
        deleteAccount,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
