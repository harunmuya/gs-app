'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, X, MapPin, Eye, Sparkles, RefreshCw, Bookmark, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useRouter } from 'next/navigation';
import VerifiedBadge from '@/components/VerifiedBadge';
import Logo from '@/components/Logo';
import SkeletonCard from '@/components/SkeletonCard';

const PROFILES_PER_PAGE = 12;

// ---- Dating Algorithm ----
function calculateMatchScore(profile, userLocation) {
    let score = 50; // Base
    // Location proximity boost
    if (userLocation && profile.coords) {
        const dist = getDistanceKm(userLocation, profile.coords);
        if (dist < 20) score += 30;
        else if (dist < 50) score += 20;
        else if (dist < 100) score += 10;
    }
    // Recency boost
    if (profile.postDate) {
        const daysSince = (Date.now() - new Date(profile.postDate).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 7) score += 15;
        else if (daysSince < 30) score += 10;
        else if (daysSince < 90) score += 5;
    }
    // Popularity boost
    if (profile.views > 5000) score += 5;
    if (profile.views > 10000) score += 5;
    // Has image boost
    if (profile.imageUrl) score += 5;
    // Has bio boost
    if (profile.bio && profile.bio.length > 40) score += 5;
    // Slight randomness for variety
    score += Math.floor(Math.random() * 8);
    return Math.min(99, Math.max(60, score));
}

function getDistanceKm(loc1, loc2) {
    if (!loc1?.lat || !loc2?.lat) return 999;
    const R = 6371;
    const dLat = ((loc2.lat - loc1.lat) * Math.PI) / 180;
    const dLng = ((loc2.lng - loc1.lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((loc1.lat * Math.PI) / 180) * Math.cos((loc2.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function DiscoverPage() {
    const { user, guest, addLike, addMatch, addPass, isProfileSwiped, saveProfile, isProfileSaved } = useAuth();
    const { location } = useGeolocation();
    const router = useRouter();

    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [swipeDirection, setSwipeDirection] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const fetchProfiles = useCallback(async (pageNum = 1) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/profiles?page=${pageNum}&per_page=${PROFILES_PER_PAGE}`);
            const data = await res.json();

            if (data.profiles?.length > 0) {
                // Filter already swiped + sort by match score (dating algorithm)
                const userCoords = location ? { lat: location.latitude, lng: location.longitude } : null;
                const fresh = data.profiles
                    .filter(p => !isProfileSwiped(p.wpId))
                    .map(p => ({ ...p, matchScore: calculateMatchScore(p, userCoords) }))
                    .sort((a, b) => b.matchScore - a.matchScore);

                setProfiles(fresh);
                setTotalPages(data.totalPages || 1);
                setCurrentIndex(0);
            } else {
                setProfiles([]);
            }
        } catch (error) {
            console.error('Error fetching profiles:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [isProfileSwiped, location]);

    useEffect(() => { fetchProfiles(page); }, [page]);

    const currentProfile = profiles[currentIndex];

    const handleLike = () => {
        if (!currentProfile) return;
        setSwipeDirection('right');
        addLike(currentProfile);
        // Match chance based on algorithm score
        const matchChance = (currentProfile.matchScore || 70) / 200;
        if (Math.random() < matchChance) {
            addMatch(currentProfile, currentProfile.matchScore || 85);
        }
        setTimeout(() => { setSwipeDirection(null); goNext(); }, 300);
    };

    const handlePass = () => {
        if (!currentProfile) return;
        setSwipeDirection('left');
        addPass(currentProfile.wpId);
        setTimeout(() => { setSwipeDirection(null); goNext(); }, 300);
    };

    const goNext = () => {
        if (currentIndex < profiles.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else if (page < totalPages) {
            setPage(prev => prev + 1);
        } else {
            setProfiles([]);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        const randomPage = Math.floor(Math.random() * Math.max(totalPages, 5)) + 1;
        setPage(randomPage);
    };

    const openProfile = () => {
        if (currentProfile) router.push(`/discover/${currentProfile.wpId}`);
    };

    // Loading
    if (loading) {
        return (
            <div className="px-4 pt-4 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={20} className="text-primary" />
                    <h1 className="text-lg font-bold text-text-primary">Discover</h1>
                </div>
                {[1, 2].map(i => <SkeletonCard key={i} />)}
            </div>
        );
    }

    // Empty state
    if (!currentProfile) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-6">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-6xl">💫</motion.div>
                <div className="space-y-2">
                    <h2 className="text-xl font-bold text-white">No more profiles!</h2>
                    <p className="text-text-secondary text-sm max-w-xs mx-auto">
                        You&apos;ve seen all available profiles. Refresh to discover more.
                    </p>
                </div>
                <button onClick={handleRefresh} className="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 active:scale-95 transition-transform">
                    <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                    Load More Profiles
                </button>
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
                <span className="text-xs text-text-muted bg-surface rounded-full px-2.5 py-1">
                    {currentIndex + 1} / {profiles.length}
                </span>
            </div>

            {/* Profile Card */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentProfile.wpId}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{
                        opacity: 1, scale: 1,
                        x: swipeDirection === 'left' ? -300 : swipeDirection === 'right' ? 300 : 0,
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="rounded-3xl overflow-hidden card-shadow bg-bg-card cursor-pointer"
                    style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                    onClick={openProfile}
                >
                    {/* Image */}
                    <div className="relative" style={{ aspectRatio: '3/4', maxHeight: '55vh' }}>
                        {currentProfile.imageUrl ? (
                            <img src={currentProfile.imageUrl} alt={currentProfile.name} className="absolute inset-0 w-full h-full object-cover" loading="eager" />
                        ) : (
                            <div className="absolute inset-0 bg-surface flex items-center justify-center">
                                <Logo size={60} className="opacity-30" />
                            </div>
                        )}
                        <div className="absolute inset-0 gradient-overlay" />

                        {/* Top badges */}
                        <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
                            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] glass">
                                <Eye size={12} className="text-text-secondary" />
                                <span className="text-text-secondary font-medium">{currentProfile.views?.toLocaleString() || '—'}</span>
                            </div>
                            <div className="px-2.5 py-1 rounded-full text-xs font-bold glass">
                                <span className="text-gold">{currentProfile.matchScore || 85}% Match</span>
                            </div>
                        </div>

                        {/* Profile info */}
                        <div className="absolute bottom-0 left-0 right-0 p-5 space-y-1.5">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                {currentProfile.name || 'Sugar Mummy'}
                                <VerifiedBadge size={18} />
                            </h2>
                            {currentProfile.location && (
                                <div className="flex items-center gap-1.5 text-white/80">
                                    <MapPin size={14} />
                                    <span className="text-sm">{currentProfile.location}</span>
                                </div>
                            )}
                            {currentProfile.bio && (
                                <p className="text-white/70 text-sm line-clamp-2">{currentProfile.bio}</p>
                            )}
                            <div className="flex items-center gap-1 text-white/50 text-xs pt-1">
                                <ChevronDown size={14} />
                                Tap to view full profile
                            </div>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-5 mt-5">
                <motion.button whileTap={{ scale: 0.85 }} onClick={handlePass}
                    className="w-16 h-16 rounded-full bg-surface flex items-center justify-center shadow-lg hover:bg-danger/20 transition-colors group"
                    style={{ border: '2px solid rgba(255,255,255,0.08)' }}>
                    <X size={28} className="text-text-muted group-hover:text-danger transition-colors" />
                </motion.button>

                <motion.button whileTap={{ scale: 0.85 }} onClick={(e) => { e.stopPropagation(); if (currentProfile) { if (isProfileSaved(currentProfile.wpId)) return; saveProfile(currentProfile); } }}
                    className="w-12 h-12 rounded-full bg-surface flex items-center justify-center shadow-lg hover:bg-gold/20 transition-colors group">
                    <Bookmark size={20} className={`transition-colors ${isProfileSaved(currentProfile?.wpId) ? 'text-gold fill-gold' : 'text-text-muted group-hover:text-gold'}`} />
                </motion.button>

                <motion.button whileTap={{ scale: 0.85 }} onClick={handleRefresh}
                    className="w-12 h-12 rounded-full bg-surface flex items-center justify-center shadow-lg hover:bg-accent/20 transition-colors group">
                    <RefreshCw size={20} className={`text-text-muted group-hover:text-accent transition-colors ${refreshing ? 'animate-spin' : ''}`} />
                </motion.button>

                <motion.button whileTap={{ scale: 0.85 }} onClick={handleLike}
                    className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all group">
                    <Heart size={28} className="text-white group-hover:scale-110 transition-transform" fill="currentColor" />
                </motion.button>
            </div>
        </div>
    );
}
