'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, X, MapPin, MessageCircle, Sparkles, RefreshCw, Bookmark, ChevronDown, Users, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useRouter } from 'next/navigation';
import VerifiedBadge from '@/components/VerifiedBadge';
import UserAvatar from '@/components/UserAvatar';
import BlurImage from '@/components/BlurImage';

// ---- Deterministic Match Scoring ----
function calculateMatchScore(profile, userLocation) {
    let score = 50;

    if (userLocation && profile.coords) {
        const dist = getDistanceKm(userLocation, profile.coords);
        if (dist < 10) score += 25;
        else if (dist < 30) score += 18;
        else if (dist < 60) score += 12;
        else if (dist < 100) score += 6;
    } else if (profile.location && profile.location !== 'Kenya') {
        score += 8;
    }

    if (profile.daysSincePost) {
        if (profile.daysSincePost < 3) score += 20;
        else if (profile.daysSincePost < 7) score += 15;
        else if (profile.daysSincePost < 14) score += 10;
        else if (profile.daysSincePost < 30) score += 5;
    }

    if (profile.commentCount > 10) score += 10;
    else if (profile.commentCount > 5) score += 7;
    else if (profile.commentCount > 0) score += 4;

    if (profile.imageUrl) score += 5;
    if (profile.bio && profile.bio.length > 30) score += 3;
    if (profile.age) score += 2;

    return Math.min(99, Math.max(55, score));
}

function shouldMatch(profile, matchScore) {
    if (matchScore >= 80) return true;
    if (matchScore >= 70 && profile.commentCount >= 3) return true;
    if (matchScore >= 65 && profile.daysSincePost < 7 && profile.imageUrl) return true;
    return false;
}

function getDistanceKm(loc1, loc2) {
    if (!loc1?.lat || !loc2?.lat) return 999;
    const R = 6371;
    const dLat = ((loc2.lat - loc1.lat) * Math.PI) / 180;
    const dLng = ((loc2.lng - loc1.lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((loc1.lat * Math.PI) / 180) * Math.cos((loc2.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const BATCH_SIZE = 20;
const PREFETCH_THRESHOLD = 5; // fetch next batch when 5 profiles left

export default function DiscoverPage() {
    const { user, guest, addLike, addMatch, addPass, isProfileSwiped, saveProfile, isProfileSaved, addSuperLike } = useAuth();
    const { location } = useGeolocation();
    const router = useRouter();

    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [swipeDirection, setSwipeDirection] = useState(null);
    const [totalAvailable, setTotalAvailable] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [nextPage, setNextPage] = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [noMorePages, setNoMorePages] = useState(false);
    const fetchingRef = useRef(false);
    const initialLoadRef = useRef(false);

    const userCoords = location ? { lat: location.latitude, lng: location.longitude } : null;

    // Fetch a batch of profiles
    const fetchBatch = useCallback(async (page) => {
        if (fetchingRef.current) return null;
        fetchingRef.current = true;
        try {
            const res = await fetch(`/api/profiles?page=${page}&per_page=${BATCH_SIZE}`);
            const data = await res.json();
            fetchingRef.current = false;

            if (!data.profiles || data.profiles.length === 0) {
                return { profiles: [], totalPages: data.totalPages || 0, totalPosts: data.totalPosts || 0, done: true };
            }

            // Score profiles
            const scored = data.profiles.map(p => ({
                ...p,
                matchScore: calculateMatchScore(p, userCoords)
            }));

            return {
                profiles: scored,
                totalPages: data.totalPages || 1,
                totalPosts: data.totalPosts || 0,
                done: false,
            };
        } catch (error) {
            console.error('Error fetching profiles batch:', error);
            fetchingRef.current = false;
            return null;
        }
    }, [userCoords]);

    // Initial load — fetch first batch instantly
    useEffect(() => {
        if (initialLoadRef.current) return;
        initialLoadRef.current = true;

        (async () => {
            setLoading(true);
            const result = await fetchBatch(1);
            if (result) {
                const unswiped = result.profiles.filter(p => !isProfileSwiped(p.wpId));
                setProfiles(unswiped);
                setTotalAvailable(result.totalPosts);
                setTotalPages(result.totalPages);
                setNextPage(2);
                if (result.done || result.totalPages <= 1) setNoMorePages(true);
            }
            setLoading(false);
        })();
    }, []);

    // Auto-load next batch when approaching the end
    useEffect(() => {
        const remaining = profiles.length - currentIndex;
        if (remaining <= PREFETCH_THRESHOLD && !loadingMore && !noMorePages && !loading) {
            loadNextBatch();
        }
    }, [currentIndex, profiles.length, loadingMore, noMorePages, loading]);

    const loadNextBatch = async () => {
        if (loadingMore || noMorePages || fetchingRef.current) return;
        setLoadingMore(true);

        const result = await fetchBatch(nextPage);
        if (result && result.profiles.length > 0) {
            const unswiped = result.profiles.filter(p => !isProfileSwiped(p.wpId));
            setProfiles(prev => [...prev, ...unswiped]);
            setNextPage(prev => prev + 1);
            setTotalAvailable(result.totalPosts);
            if (nextPage >= result.totalPages) {
                setNoMorePages(true);
            }
        } else {
            setNoMorePages(true);
        }
        setLoadingMore(false);
    };

    const currentProfile = profiles[currentIndex];

    const handleLike = () => {
        if (!currentProfile) return;
        setSwipeDirection('right');
        addLike(currentProfile);

        const matchScore = currentProfile.matchScore || 70;
        if (shouldMatch(currentProfile, matchScore)) {
            addMatch(currentProfile, matchScore);
        }

        setTimeout(() => { setSwipeDirection(null); goNext(); }, 300);
    };

    const handleSuperLike = () => {
        if (!currentProfile) return;
        setSwipeDirection('up');
        if (addSuperLike) {
            addSuperLike(currentProfile);
        } else {
            addLike(currentProfile);
        }

        const matchScore = Math.min(99, (currentProfile.matchScore || 70) + 10);
        addMatch(currentProfile, matchScore);

        setTimeout(() => { setSwipeDirection(null); goNext(); }, 300);
    };

    const handlePass = () => {
        if (!currentProfile) return;
        setSwipeDirection('left');
        addPass(currentProfile.wpId);
        setTimeout(() => { setSwipeDirection(null); goNext(); }, 300);
    };

    const goNext = () => {
        setCurrentIndex(prev => prev + 1);
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        initialLoadRef.current = false;
        fetchingRef.current = false;
        setCurrentIndex(0);
        setNextPage(1);
        setNoMorePages(false);
        setProfiles([]);

        const result = await fetchBatch(1);
        if (result) {
            const unswiped = result.profiles.filter(p => !isProfileSwiped(p.wpId));
            setProfiles(unswiped);
            setTotalAvailable(result.totalPosts);
            setTotalPages(result.totalPages);
            setNextPage(2);
            if (result.done || result.totalPages <= 1) setNoMorePages(true);
        }
        setRefreshing(false);
    };

    const openProfile = () => {
        if (currentProfile) router.push(`/discover/${currentProfile.wpId}`);
    };

    const remainingCount = profiles.length - currentIndex;
    const totalCount = totalAvailable || profiles.length;

    // Minimal skeleton — instant feel
    if (loading) {
        return (
            <div className="px-4 pt-4 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={20} className="text-primary" />
                    <h1 className="text-lg font-bold text-text-primary">Discover</h1>
                </div>
                <div className="rounded-3xl overflow-hidden bg-surface animate-pulse" style={{ aspectRatio: '3/4', maxHeight: '55vh' }} />
                <div className="flex items-center justify-center gap-5 mt-5">
                    <div className="w-16 h-16 rounded-full bg-surface animate-pulse" />
                    <div className="w-12 h-12 rounded-full bg-surface animate-pulse" />
                    <div className="w-12 h-12 rounded-full bg-surface animate-pulse" />
                    <div className="w-16 h-16 rounded-full bg-surface animate-pulse" />
                </div>
            </div>
        );
    }

    // All swiped
    if (!currentProfile || currentIndex >= profiles.length) {
        const allSwiped = profiles.length > 0 || noMorePages;
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-6">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-6xl">
                    {allSwiped ? '🎉' : '💫'}
                </motion.div>
                <div className="space-y-2">
                    <h2 className="text-xl font-bold text-text-primary">
                        {allSwiped ? "You've seen everyone!" : 'Loading profiles...'}
                    </h2>
                    <p className="text-text-secondary text-sm max-w-xs mx-auto">
                        {allSwiped
                            ? `You've viewed all ${totalCount} available profiles. Refresh to see them again!`
                            : 'Pull to refresh and discover more profiles.'}
                    </p>
                </div>
                <button onClick={handleRefresh} className="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 active:scale-95 transition-transform">
                    <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                    {allSwiped ? 'Start Over' : 'Refresh Profiles'}
                </button>
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                    <Users size={14} />
                    <span>{totalCount} profiles in database</span>
                </div>
            </div>
        );
    }

    return (
        <div className="px-4 pt-4 pb-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Sparkles size={20} className="text-primary" />
                    <h1 className="text-lg font-bold text-text-primary">Discover</h1>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted bg-surface rounded-full px-2.5 py-1">
                        {currentIndex + 1} / {profiles.length}
                    </span>
                    <span className="text-[10px] text-primary bg-primary/10 rounded-full px-2 py-0.5 font-medium">
                        {totalCount} total
                    </span>
                    {loadingMore && (
                        <span className="text-[10px] text-text-muted animate-pulse">loading more...</span>
                    )}
                </div>
            </div>

            {/* Profile Card */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentProfile.wpId}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{
                        opacity: 1, scale: 1,
                        x: swipeDirection === 'left' ? -300 : swipeDirection === 'right' ? 300 : 0,
                        y: swipeDirection === 'up' ? -300 : 0,
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="rounded-3xl overflow-hidden card-shadow bg-white cursor-pointer"
                    style={{ border: '1px solid var(--color-border)' }}
                    onClick={openProfile}
                >
                    <div className="relative" style={{ aspectRatio: '3/4', maxHeight: '55vh' }}>
                        {currentProfile.imageUrl ? (
                            <BlurImage src={currentProfile.imageUrl} alt={currentProfile.name} fill priority className="absolute inset-0 w-full h-full" />
                        ) : (
                            <div className="absolute inset-0 bg-surface flex items-center justify-center">
                                <UserAvatar name={currentProfile.name} size={100} />
                            </div>
                        )}
                        <div className="absolute inset-0 gradient-overlay" />

                        {/* Top badges */}
                        <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {currentProfile.daysSincePost < 3 && (
                                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-success text-white shadow-lg">🆕 Newly Available</span>
                                )}
                                {currentProfile.daysSincePost >= 3 && currentProfile.daysSincePost <= 14 && (
                                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-gold text-white shadow-lg">⭐ Featured</span>
                                )}
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] glass">
                                    <MessageCircle size={12} className="text-white/70" />
                                    <span className="text-white/80 font-medium profile-overlay-text">{currentProfile.commentCount} comments</span>
                                </div>
                            </div>
                            <div className="px-2.5 py-1 rounded-full text-xs font-bold glass">
                                <span className="text-gold">{currentProfile.matchScore || 85}%</span>
                            </div>
                        </div>

                        {/* Profile info */}
                        <div className="absolute bottom-0 left-0 right-0 p-5 space-y-1.5">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2 profile-overlay-text">
                                {currentProfile.name || 'Sugar Mummy'}
                                {currentProfile.age && <span className="text-white/70 font-normal text-lg">{currentProfile.age}</span>}
                                <VerifiedBadge size={18} />
                            </h2>
                            {currentProfile.location && (
                                <div className="flex items-center gap-1.5 text-white/80 profile-overlay-text">
                                    <MapPin size={14} />
                                    <span className="text-sm">{currentProfile.location}</span>
                                </div>
                            )}
                            {currentProfile.bio && (
                                <p className="text-white/70 text-sm line-clamp-2 profile-overlay-text">{currentProfile.bio}</p>
                            )}
                            <div className="flex items-center gap-1 text-white/50 text-xs pt-1 profile-overlay-text">
                                <ChevronDown size={14} />
                                Tap to view full profile
                            </div>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-4 mt-5">
                <motion.button whileTap={{ scale: 0.85 }} onClick={handlePass}
                    className="w-15 h-15 rounded-full bg-white flex items-center justify-center shadow-lg hover:bg-danger/10 transition-colors group"
                    style={{ border: '2px solid var(--color-border)', width: 60, height: 60 }}>
                    <X size={26} className="text-text-muted group-hover:text-danger transition-colors" />
                </motion.button>

                <motion.button whileTap={{ scale: 0.85 }} onClick={(e) => { e.stopPropagation(); if (currentProfile) { if (isProfileSaved(currentProfile.wpId)) return; saveProfile(currentProfile); } }}
                    className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-lg hover:bg-gold/10 transition-colors group"
                    style={{ border: '1px solid var(--color-border)' }}>
                    <Bookmark size={20} className={`transition-colors ${isProfileSaved(currentProfile?.wpId) ? 'text-gold fill-gold' : 'text-text-muted group-hover:text-gold'}`} />
                </motion.button>

                <motion.button whileTap={{ scale: 0.85 }} onClick={handleSuperLike}
                    className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-lg hover:bg-blue-50 transition-colors group"
                    style={{ border: '2px solid #3B82F6' }}>
                    <Zap size={20} className="text-blue-500 group-hover:text-blue-600 transition-colors" fill="currentColor" />
                </motion.button>

                <motion.button whileTap={{ scale: 0.85 }} onClick={handleRefresh}
                    className="w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-md hover:bg-accent/10 transition-colors group"
                    style={{ border: '1px solid var(--color-border)' }}>
                    <RefreshCw size={18} className={`text-text-muted group-hover:text-accent transition-colors ${refreshing ? 'animate-spin' : ''}`} />
                </motion.button>

                <motion.button whileTap={{ scale: 0.85 }} onClick={handleLike}
                    className="rounded-full gradient-primary flex items-center justify-center shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all group"
                    style={{ width: 60, height: 60 }}>
                    <Heart size={26} className="text-white group-hover:scale-110 transition-transform" fill="currentColor" />
                </motion.button>
            </div>

            {/* Remaining count */}
            <div className="text-center mt-3">
                <p className="text-[11px] text-text-muted">
                    {remainingCount > 1 ? `${remainingCount} profiles remaining` : 'Last profile!'}
                    {loadingMore && ' • Loading more...'}
                </p>
            </div>
        </div>
    );
}
