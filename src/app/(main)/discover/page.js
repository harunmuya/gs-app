'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, X, Star, MapPin, MessageCircle, RefreshCw, Sparkles, Navigation, Database } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import VerifiedBadge from '@/components/VerifiedBadge';
import UserAvatar from '@/components/UserAvatar';
import Link from 'next/link';

// ---- Ultra-fast profile cache ----
const CACHE_KEY = 'gsm_profiles_v2';
const CACHE_TS = 'gsm_profiles_ts';
const TTL = 10 * 60 * 1000; // 10 min

function getCache() {
    if (typeof window === 'undefined') return null;
    try {
        const ts = localStorage.getItem(CACHE_TS);
        if (ts && Date.now() - parseInt(ts) < TTL) {
            const d = localStorage.getItem(CACHE_KEY);
            return d ? JSON.parse(d) : null;
        }
    } catch { }
    return null;
}
function setCache(profiles) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(profiles));
        localStorage.setItem(CACHE_TS, String(Date.now()));
    } catch { }
}

// ---- Match scoring ----
function matchScore(p, coords) {
    let s = 50;
    if (p.daysSincePost < 3) s += 25;
    else if (p.daysSincePost < 7) s += 20;
    else if (p.daysSincePost < 14) s += 15;
    else if (p.daysSincePost < 30) s += 10;
    if (p.commentCount >= 10) s += 15;
    else if (p.commentCount >= 5) s += 10;
    else if (p.commentCount >= 1) s += 5;
    if (p.imageUrl) s += 5;
    if (p.age) s += 5;
    if (p.location) s += 3;
    if (p.bio) s += 2;
    if (coords && p.coords) {
        const d = haversine(coords, p.coords);
        if (d < 10) s += 20; else if (d < 30) s += 15; else if (d < 50) s += 10; else if (d < 100) s += 5;
    }
    return Math.min(99, s);
}
function haversine(c1, c2) {
    const R = 6371, toR = Math.PI / 180;
    const dLat = (c2.latitude - c1.latitude) * toR;
    const dLon = (c2.longitude - c1.longitude) * toR;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(c1.latitude * toR) * Math.cos(c2.latitude * toR) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---- Fetch with timeout ----
async function fetchWithTimeout(url, ms = 8000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(timer);
        return res;
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}

export default function DiscoverPage() {
    const { addLike, addMatch, addPass, isProfileSwiped, addSuperLike, clearSwipeHistory } = useAuth();
    const { location: userLocation, requestLocation } = useGeolocation();

    const [allProfiles, setAllProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [swipeDir, setSwipeDir] = useState(null);
    const [viewedAll, setViewedAll] = useState(false);
    const [dbTotal, setDbTotal] = useState(0);
    const fetchingRef = useRef(false);

    // ---- FAST LOAD: cache → show instantly → background update ----
    const loadProfiles = useCallback(async (forceRefresh = false) => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;

        try {
            // Step 1: Show cache INSTANTLY
            if (!forceRefresh) {
                const cached = getCache();
                if (cached && cached.length > 0) {
                    setAllProfiles(cached);
                    setDbTotal(cached.length);
                    setLoading(false);
                }
            }

            // Step 2: Fetch page 1 FAST (show immediately if no cache)
            const res1 = await fetchWithTimeout('/api/profiles?page=1&per_page=50', 10000);
            if (!res1.ok) throw new Error('API failed');
            const data1 = await res1.json();
            const page1 = data1.profiles || [];
            const totalPages = data1.totalPages || 1;
            const totalPosts = data1.totalPosts || page1.length;

            // Show page 1 immediately
            if (page1.length > 0) {
                setAllProfiles(page1);
                setDbTotal(totalPosts);
                setLoading(false);
                setCache(page1);
            }

            // Step 3: Fetch remaining pages IN PARALLEL (background)
            if (totalPages > 1) {
                const promises = [];
                for (let p = 2; p <= totalPages; p++) {
                    promises.push(
                        fetchWithTimeout(`/api/profiles?page=${p}&per_page=50`, 12000)
                            .then(r => r.ok ? r.json() : { profiles: [] })
                            .then(d => d.profiles || [])
                            .catch(() => [])
                    );
                }
                const results = await Promise.all(promises);
                const moreProfiles = results.flat();

                if (moreProfiles.length > 0) {
                    const all = [...page1, ...moreProfiles];
                    // Deduplicate
                    const seen = new Set();
                    const unique = all.filter(p => {
                        if (seen.has(p.wpId)) return false;
                        seen.add(p.wpId);
                        return true;
                    });
                    setAllProfiles(unique);
                    setDbTotal(totalPosts);
                    setCache(unique);
                }
            }
        } catch (err) {
            console.error('Profile load error:', err);
            // If we have nothing, try cache one more time
            if (allProfiles.length === 0) {
                const cached = getCache();
                if (cached && cached.length > 0) {
                    setAllProfiles(cached);
                    setDbTotal(cached.length);
                }
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
            fetchingRef.current = false;
        }
    }, []);

    // Mount: instant load
    useEffect(() => { loadProfiles(); }, [loadProfiles]);

    // Filter unswiped
    const displayProfiles = useMemo(() => {
        const unswiped = allProfiles.filter(p => !isProfileSwiped(p.wpId));
        if (userLocation && unswiped.length > 0) {
            return [...unswiped].sort((a, b) => matchScore(b, userLocation) - matchScore(a, userLocation));
        }
        return unswiped;
    }, [allProfiles, userLocation, isProfileSwiped]);

    // Detect viewed all
    useEffect(() => {
        if (allProfiles.length > 0 && displayProfiles.length === 0 && !loading) setViewedAll(true);
    }, [displayProfiles.length, allProfiles.length, loading]);

    // Swipe
    const handleSwipe = useCallback((dir, profile) => {
        if (!profile) return;
        setSwipeDir(dir);
        if (dir === 'right') {
            addLike(profile);
            const s = matchScore(profile, userLocation);
            if (s >= 70) addMatch(profile, s);
        } else if (dir === 'up') {
            addSuperLike(profile);
            addMatch(profile, Math.min(99, matchScore(profile, userLocation) + 10));
        } else {
            addPass(profile.wpId);
        }
        setTimeout(() => setSwipeDir(null), 200);
    }, [addLike, addMatch, addPass, addSuperLike, userLocation]);

    // Refresh
    const handleRefresh = () => {
        setRefreshing(true);
        setViewedAll(false);
        clearSwipeHistory();
        loadProfiles(true);
    };

    const currentProfile = displayProfiles[0];
    const nextProfile = displayProfiles[1];

    // ---- LOADING ----
    if (loading && allProfiles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
                <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <p className="text-sm text-text-muted">Loading profiles...</p>
            </div>
        );
    }

    // ---- EMPTY ----
    if (!loading && allProfiles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-5">
                <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center">
                    <Database size={36} className="text-text-muted" />
                </div>
                <h2 className="text-xl font-bold text-text-primary">No Profiles Available</h2>
                <p className="text-text-secondary text-sm leading-relaxed">
                    Could not load profiles. Check your internet connection and try again.
                </p>
                <button onClick={handleRefresh} disabled={refreshing}
                    className="flex items-center gap-2 px-8 py-3.5 rounded-2xl gradient-primary text-white font-semibold shadow-lg shadow-primary/20 transition-all active:scale-95">
                    <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                    {refreshing ? 'Loading...' : 'Retry'}
                </button>
            </div>
        );
    }

    // ---- VIEWED ALL ----
    if (viewedAll || (!currentProfile && allProfiles.length > 0)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-5">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles size={36} className="text-primary" />
                </div>
                <h2 className="text-xl font-bold text-text-primary">You've Seen Everyone!</h2>
                <p className="text-text-secondary text-sm leading-relaxed">
                    You have viewed all {allProfiles.length} profiles.<br />Refresh to see them again.
                </p>
                <button onClick={handleRefresh} disabled={refreshing}
                    className="flex items-center gap-2 px-8 py-3.5 rounded-2xl gradient-primary text-white font-semibold shadow-lg shadow-primary/20 transition-all active:scale-95">
                    <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                    {refreshing ? 'Loading...' : 'Refresh Profiles'}
                </button>
                <p className="text-[10px] text-text-muted">
                    {dbTotal} profiles in database
                </p>
            </div>
        );
    }

    const score = matchScore(currentProfile, userLocation);
    const isNearby = userLocation && currentProfile.coords && haversine(userLocation, currentProfile.coords) < 30;

    return (
        <div className="px-4 pt-2 pb-24">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Sparkles size={20} className="text-primary" />
                    <h1 className="text-lg font-bold text-text-primary">Discover</h1>
                    <span className="text-[10px] text-text-muted font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-surface)' }}>
                        {displayProfiles.length} left
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {!userLocation && (
                        <button onClick={requestLocation} className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-semibold text-white transition-colors" style={{ background: 'var(--color-primary)', opacity: 0.9 }}>
                            <Navigation size={10} /> Location
                        </button>
                    )}
                    <button onClick={handleRefresh} disabled={refreshing} className="p-2 rounded-full transition-colors" style={{ background: 'var(--color-surface)' }}>
                        <RefreshCw size={16} className={`text-text-muted ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Card Stack */}
            <div className="relative w-full aspect-[3/4] max-h-[65vh] rounded-3xl overflow-hidden mb-4">
                {/* Next card preview */}
                {nextProfile && (
                    <div className="absolute inset-2 rounded-2xl overflow-hidden bg-surface" style={{ transform: 'scale(0.95)', opacity: 0.6 }}>
                        {nextProfile.imageUrl && <img src={nextProfile.imageUrl} alt="" className="w-full h-full object-cover" loading="eager" />}
                    </div>
                )}

                {/* Current Card */}
                <AnimatePresence mode="popLayout">
                    <motion.div
                        key={currentProfile.wpId}
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1, x: swipeDir === 'left' ? -300 : swipeDir === 'right' ? 300 : 0, y: swipeDir === 'up' ? -300 : 0, rotate: swipeDir === 'left' ? -15 : swipeDir === 'right' ? 15 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 rounded-3xl overflow-hidden card-shadow"
                    >
                        <Link href={`/discover/${currentProfile.wpId}`} className="block w-full h-full">
                            {currentProfile.imageUrl ? (
                                <img
                                    src={currentProfile.imageUrl}
                                    alt={currentProfile.name}
                                    loading="eager"
                                    style={{
                                        position: 'absolute',
                                        inset: 0,
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                    }}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--color-surface)' }}>
                                    <UserAvatar name={currentProfile.name} size={120} />
                                </div>
                            )}

                            <div className="absolute inset-0 gradient-overlay" />

                            {/* Swipe indicators */}
                            {swipeDir === 'right' && (
                                <div className="absolute top-8 left-6 px-4 py-2 rounded-xl border-3 border-success rotate-[-15deg] z-20">
                                    <span className="text-success text-2xl font-black">LIKE</span>
                                </div>
                            )}
                            {swipeDir === 'left' && (
                                <div className="absolute top-8 right-6 px-4 py-2 rounded-xl border-3 border-danger rotate-[15deg] z-20">
                                    <span className="text-danger text-2xl font-black">PASS</span>
                                </div>
                            )}
                            {swipeDir === 'up' && (
                                <div className="absolute top-8 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl border-3 border-gold z-20">
                                    <span className="text-gold text-2xl font-black">SUPER</span>
                                </div>
                            )}

                            {/* Badges */}
                            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
                                <div className="flex items-center gap-1.5">
                                    {isNearby && (
                                        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-success/90 text-white text-[10px] font-bold">
                                            <Navigation size={9} /> Near You
                                        </span>
                                    )}
                                    {currentProfile.daysSincePost < 3 && (
                                        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-success/90 text-white text-[10px] font-bold">
                                            <Sparkles size={9} /> New
                                        </span>
                                    )}
                                    {currentProfile.daysSincePost >= 3 && currentProfile.daysSincePost < 14 && (
                                        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-gold/90 text-white text-[10px] font-bold">
                                            <Star size={9} /> Featured
                                        </span>
                                    )}
                                </div>
                                <span className="px-2 py-1 rounded-full glass text-[10px] text-white font-bold">
                                    {score}% Match
                                </span>
                            </div>

                            {/* Bottom info */}
                            <div className="absolute bottom-0 left-0 right-0 p-5 profile-overlay-text">
                                <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-0.5">
                                    {currentProfile.name || 'Sugar Mummy'}
                                    {currentProfile.age && <span className="text-white/70 text-lg font-normal">{currentProfile.age}</span>}
                                    <VerifiedBadge size={20} />
                                </h2>
                                {currentProfile.location && (
                                    <div className="flex items-center gap-1 text-white/80 mb-1.5">
                                        <MapPin size={13} />
                                        <span className="text-sm">{currentProfile.location}</span>
                                    </div>
                                )}
                                {currentProfile.excerpt && (
                                    <p className="text-xs text-white/70 line-clamp-2">{currentProfile.excerpt}</p>
                                )}
                                <div className="flex items-center gap-3 mt-2">
                                    {currentProfile.commentCount > 0 && (
                                        <span className="flex items-center gap-1 text-white/60 text-xs">
                                            <MessageCircle size={12} /> {currentProfile.commentCount}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-4">
                <motion.button whileTap={{ scale: 0.85 }}
                    onClick={() => handleSwipe('left', currentProfile)}
                    className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-colors"
                    style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                    <X size={28} className="text-text-muted" />
                </motion.button>

                <motion.button whileTap={{ scale: 0.85 }}
                    onClick={() => handleSwipe('up', currentProfile)}
                    className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-gold text-white">
                    <Star size={24} fill="white" />
                </motion.button>

                <motion.button whileTap={{ scale: 0.85 }}
                    onClick={() => handleSwipe('right', currentProfile)}
                    className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg gradient-primary text-white">
                    <Heart size={28} fill="white" />
                </motion.button>
            </div>

            {/* Count */}
            <p className="text-center text-[10px] text-text-muted mt-3">
                {displayProfiles.length} of {allProfiles.length} profiles remaining
            </p>
        </div>
    );
}
