'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, X, Star, MapPin, MessageCircle, RefreshCw, Search, Sparkles, Navigation, Database } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import VerifiedBadge from '@/components/VerifiedBadge';
import UserAvatar from '@/components/UserAvatar';
import BlurImage from '@/components/BlurImage';
import Link from 'next/link';

// ---- LocalStorage profile cache for instant loads ----
const CACHE_KEY = 'gsm_profile_cache';
const CACHE_TS_KEY = 'gsm_profile_cache_ts';
const CACHE_TTL = 10 * 60 * 1000; // 10 mins

function getCachedProfiles() {
    if (typeof window === 'undefined') return null;
    try {
        const ts = localStorage.getItem(CACHE_TS_KEY);
        if (ts && Date.now() - parseInt(ts) < CACHE_TTL) {
            const data = localStorage.getItem(CACHE_KEY);
            return data ? JSON.parse(data) : null;
        }
    } catch { }
    return null;
}

function setCachedProfiles(profiles) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(profiles));
        localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
    } catch { }
}

// ---- Scoring ----
function calculateMatchScore(profile, userCoords) {
    let score = 50;
    if (profile.daysSincePost < 3) score += 25;
    else if (profile.daysSincePost < 7) score += 20;
    else if (profile.daysSincePost < 14) score += 15;
    else if (profile.daysSincePost < 30) score += 10;
    if (profile.commentCount >= 10) score += 15;
    else if (profile.commentCount >= 5) score += 10;
    else if (profile.commentCount >= 1) score += 5;
    if (profile.imageUrl) score += 5;
    if (profile.age) score += 5;
    if (profile.location) score += 3;
    if (profile.bio) score += 2;
    if (userCoords && profile.coords) {
        const dist = haversineDistance(userCoords, profile.coords);
        if (dist < 10) score += 20;
        else if (dist < 30) score += 15;
        else if (dist < 50) score += 10;
        else if (dist < 100) score += 5;
    }
    return Math.min(99, score);
}

function haversineDistance(c1, c2) {
    const R = 6371;
    const dLat = (c2.latitude - c1.latitude) * Math.PI / 180;
    const dLon = (c2.longitude - c1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(c1.latitude * Math.PI / 180) * Math.cos(c2.latitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function DiscoverPage() {
    const { addLike, addMatch, addPass, isProfileSwiped, addSuperLike, clearSwipeHistory } = useAuth();
    const { location: userLocation, requestLocation } = useGeolocation();

    const [allProfiles, setAllProfiles] = useState([]); // ALL profiles ever fetched
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [swipeDirection, setSwipeDirection] = useState(null);
    const [viewedAll, setViewedAll] = useState(false);
    const [dbTotal, setDbTotal] = useState(0);
    const fetchingRef = useRef(false);
    const loadedPagesRef = useRef(new Set());

    // ---- Load ALL pages of profiles aggressively ----
    const fetchAllProfiles = useCallback(async (resetSwipes = false) => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;

        try {
            let page = 1;
            let allFetched = [];
            let hasMore = true;
            let totalPosts = 0;

            while (hasMore) {
                const res = await fetch(`/api/profiles?page=${page}&per_page=25`);
                if (!res.ok) break;
                const data = await res.json();
                totalPosts = data.totalPosts || totalPosts;
                const batch = data.profiles || [];
                if (batch.length === 0) break;
                allFetched = [...allFetched, ...batch];
                hasMore = batch.length >= 20 && (data.totalPages ? page < data.totalPages : true);
                page++;
                // Don't wait too long between pages
            }

            // Deduplicate by wpId
            const seen = new Set();
            const unique = allFetched.filter(p => {
                if (seen.has(p.wpId)) return false;
                seen.add(p.wpId);
                return true;
            });

            setAllProfiles(unique);
            setDbTotal(totalPosts || unique.length);
            setCachedProfiles(unique);

            // If resetting swipes (refresh after viewing all), start from 0
            if (resetSwipes) {
                setCurrentIndex(0);
                setViewedAll(false);
            }
        } catch (err) {
            console.error('Failed to fetch profiles:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
            fetchingRef.current = false;
        }
    }, []);

    // ---- INSTANT load from cache, then background refresh ----
    useEffect(() => {
        const cached = getCachedProfiles();
        if (cached && cached.length > 0) {
            setAllProfiles(cached);
            setDbTotal(cached.length);
            setLoading(false);
            // Background refresh for fresh data
            fetchAllProfiles(false);
        } else {
            fetchAllProfiles(false);
        }
    }, [fetchAllProfiles]);

    // ---- Filter to unswiped profiles (or all if viewedAll reset) ----
    const displayProfiles = useMemo(() => {
        const unswiped = allProfiles.filter(p => !isProfileSwiped(p.wpId));

        // Sort by match score (proximity + recency)
        if (userLocation) {
            return [...unswiped].sort((a, b) =>
                calculateMatchScore(b, userLocation) - calculateMatchScore(a, userLocation)
            );
        }
        return unswiped;
    }, [allProfiles, userLocation, isProfileSwiped]);

    // ---- Detect viewed all ----
    useEffect(() => {
        if (allProfiles.length > 0 && displayProfiles.length === 0 && !loading) {
            setViewedAll(true);
        }
    }, [displayProfiles.length, allProfiles.length, loading]);

    // ---- Swipe handler ----
    const handleSwipe = useCallback((direction, profile) => {
        if (!profile) return;
        setSwipeDirection(direction);

        if (direction === 'right') {
            addLike(profile);
            const score = calculateMatchScore(profile, userLocation);
            if (score >= 70) addMatch(profile, score);
        } else if (direction === 'up') {
            addSuperLike(profile);
            const score = calculateMatchScore(profile, userLocation);
            addMatch(profile, Math.min(99, score + 10));
        } else {
            addPass(profile.wpId);
        }

        setTimeout(() => {
            setSwipeDirection(null);
        }, 200);
    }, [addLike, addMatch, addPass, addSuperLike, userLocation]);

    // ---- Refresh: re-fetch + allow re-viewing all profiles ----
    const handleRefresh = () => {
        setRefreshing(true);
        setViewedAll(false);
        clearSwipeHistory(); // Reset passes so all profiles show again
        fetchAllProfiles(true);
    };

    // The current profile to display (first unswiped)
    const currentProfile = displayProfiles[0];
    const nextProfile = displayProfiles[1];

    // ---- LOADING state: only show briefly, profiles should be instant from cache ----
    if (loading && allProfiles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
                <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                </div>
                <p className="text-sm text-text-muted">Loading profiles...</p>
            </div>
        );
    }

    // ---- 0 profiles in database ----
    if (!loading && allProfiles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-5">
                <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center">
                    <Database size={36} className="text-text-muted" />
                </div>
                <h2 className="text-xl font-bold text-text-primary">0 Profiles in Database</h2>
                <p className="text-text-secondary text-sm leading-relaxed">
                    No profiles are currently available. This may be due to a network issue. Check your connection and try again.
                </p>
                <button onClick={handleRefresh} disabled={refreshing}
                    className="flex items-center gap-2 px-8 py-3.5 rounded-2xl gradient-primary text-white font-semibold shadow-lg shadow-primary/20 transition-all active:scale-95">
                    <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                    {refreshing ? 'Loading...' : 'Retry'}
                </button>
            </div>
        );
    }

    // ---- Viewed ALL profiles ----
    if (viewedAll || (!currentProfile && allProfiles.length > 0)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-5">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles size={36} className="text-primary" />
                </div>
                <h2 className="text-xl font-bold text-text-primary">You've Seen Everyone!</h2>
                <p className="text-text-secondary text-sm leading-relaxed">
                    You have viewed all {allProfiles.length} available profiles.<br />
                    Refresh to see them again.
                </p>
                <button onClick={handleRefresh} disabled={refreshing}
                    className="flex items-center gap-2 px-8 py-3.5 rounded-2xl gradient-primary text-white font-semibold shadow-lg shadow-primary/20 transition-all active:scale-95">
                    <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                    {refreshing ? 'Loading...' : 'Refresh Profiles'}
                </button>
                <p className="text-[10px] text-text-muted">
                    {dbTotal} profiles in database · Last updated {new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                </p>
            </div>
        );
    }

    const matchScore = calculateMatchScore(currentProfile, userLocation);
    const isNearby = userLocation && currentProfile.coords && haversineDistance(userLocation, currentProfile.coords) < 30;

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
                {/* Background (next card) */}
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
                        animate={{ scale: 1, opacity: 1, x: swipeDirection === 'left' ? -300 : swipeDirection === 'right' ? 300 : 0, y: swipeDirection === 'up' ? -300 : 0, rotate: swipeDirection === 'left' ? -15 : swipeDirection === 'right' ? 15 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 rounded-3xl overflow-hidden card-shadow"
                    >
                        <Link href={`/discover/${currentProfile.wpId}`} className="block w-full h-full">
                            {currentProfile.imageUrl ? (
                                <BlurImage src={currentProfile.imageUrl} alt={currentProfile.name} fill className="w-full h-full" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--color-surface)' }}>
                                    <UserAvatar name={currentProfile.name} size={120} />
                                </div>
                            )}

                            {/* Overlay gradient */}
                            <div className="absolute inset-0 gradient-overlay" />

                            {/* Swipe indicators */}
                            {swipeDirection === 'right' && (
                                <div className="absolute top-8 left-6 px-4 py-2 rounded-xl border-3 border-success rotate-[-15deg] z-20">
                                    <span className="text-success text-2xl font-black">LIKE</span>
                                </div>
                            )}
                            {swipeDirection === 'left' && (
                                <div className="absolute top-8 right-6 px-4 py-2 rounded-xl border-3 border-danger rotate-[15deg] z-20">
                                    <span className="text-danger text-2xl font-black">PASS</span>
                                </div>
                            )}
                            {swipeDirection === 'up' && (
                                <div className="absolute top-8 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl border-3 border-gold z-20">
                                    <span className="text-gold text-2xl font-black">SUPER</span>
                                </div>
                            )}

                            {/* Top badges */}
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
                                    {matchScore}% Match
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

            {/* Remaining count */}
            <p className="text-center text-[10px] text-text-muted mt-3">
                {displayProfiles.length} of {allProfiles.length} profiles remaining
            </p>
        </div>
    );
}
