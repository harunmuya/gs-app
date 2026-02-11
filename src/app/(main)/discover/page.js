'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, X, MapPin, Eye, Star, ChevronLeft, ChevronRight, Sparkles, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import ContactButtons from '@/components/ContactButtons';
import VerifiedBadge from '@/components/VerifiedBadge';
import CommentForm from '@/components/CommentForm';
import Logo from '@/components/Logo';
import SkeletonCard from '@/components/SkeletonCard';

const PROFILES_PER_PAGE = 10;

export default function DiscoverPage() {
    const { user, guest, addLike, addMatch, addPass, isProfileSwiped } = useAuth();
    const { location } = useGeolocation();

    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [commentProfile, setCommentProfile] = useState(null);
    const [swipeDirection, setSwipeDirection] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const fetchProfiles = useCallback(async (pageNum = 1) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/profiles?page=${pageNum}&per_page=${PROFILES_PER_PAGE}`);
            const data = await res.json();

            if (data.profiles && data.profiles.length > 0) {
                // Filter out already swiped profiles
                const fresh = data.profiles.filter(p => !isProfileSwiped(p.wpId));
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
    }, [isProfileSwiped]);

    useEffect(() => {
        fetchProfiles(page);
    }, [page]);

    const currentProfile = profiles[currentIndex];

    const handleLike = () => {
        if (!currentProfile) return;
        setSwipeDirection('right');

        addLike(currentProfile);

        // Random match chance (~40%)
        if (Math.random() < 0.4) {
            const score = Math.floor(Math.random() * 20) + 80;
            addMatch(currentProfile, score);
        }

        setTimeout(() => {
            setSwipeDirection(null);
            goNext();
        }, 300);
    };

    const handlePass = () => {
        if (!currentProfile) return;
        setSwipeDirection('left');
        addPass(currentProfile.wpId);

        setTimeout(() => {
            setSwipeDirection(null);
            goNext();
        }, 300);
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

    // Loading state
    if (loading) {
        return (
            <div className="px-4 pt-4 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={20} className="text-primary" />
                    <h1 className="text-lg font-bold text-text-primary">Discover</h1>
                </div>
                {[1, 2].map((i) => (
                    <SkeletonCard key={i} />
                ))}
            </div>
        );
    }

    // No more profiles
    if (!currentProfile) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-6">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-6xl"
                >
                    💫
                </motion.div>
                <div className="space-y-2">
                    <h2 className="text-xl font-bold text-white">No more profiles!</h2>
                    <p className="text-text-secondary text-sm max-w-xs mx-auto">
                        You&apos;ve seen all available profiles. Refresh to discover more sugar mummies.
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 active:scale-95 transition-transform"
                >
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
                        opacity: 1,
                        scale: 1,
                        x: swipeDirection === 'left' ? -300 : swipeDirection === 'right' ? 300 : 0,
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="rounded-3xl overflow-hidden card-shadow bg-bg-card"
                    style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                >
                    {/* Image */}
                    <div className="relative" style={{ aspectRatio: '3/4', maxHeight: '55vh' }}>
                        {currentProfile.imageUrl ? (
                            <img
                                src={currentProfile.imageUrl}
                                alt={currentProfile.name}
                                className="absolute inset-0 w-full h-full object-cover"
                                loading="eager"
                            />
                        ) : (
                            <div className="absolute inset-0 bg-surface flex items-center justify-center">
                                <Logo size={60} className="opacity-30" />
                            </div>
                        )}

                        {/* Gradient overlay */}
                        <div className="absolute inset-0 gradient-overlay" />

                        {/* Top badges */}
                        <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
                            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] glass">
                                <Eye size={12} className="text-text-secondary" />
                                <span className="text-text-secondary font-medium">
                                    {currentProfile.views ? currentProfile.views.toLocaleString() : '—'} views
                                </span>
                            </div>
                            <div className="px-2.5 py-1 rounded-full text-xs font-bold glass">
                                <span className="text-gold">★ Verified</span>
                            </div>
                        </div>

                        {/* Profile info overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-5 space-y-2">
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
                            {currentProfile.excerpt && (
                                <p className="text-white/70 text-sm line-clamp-2">
                                    {currentProfile.excerpt}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Contact + Comment */}
                    <div className="p-4 space-y-3">
                        <ContactButtons profileName={currentProfile.name} />
                        <button
                            onClick={() => setCommentProfile({
                                wpId: currentProfile.wpId,
                                name: currentProfile.name,
                            })}
                            className="w-full py-2.5 rounded-xl text-sm font-medium text-text-secondary bg-surface hover:bg-surface-light transition-colors"
                        >
                            💬 Leave a Comment
                        </button>
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-6 mt-5">
                <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={handlePass}
                    className="w-16 h-16 rounded-full bg-surface flex items-center justify-center shadow-lg hover:bg-danger/20 transition-colors group"
                    style={{ border: '2px solid rgba(255,255,255,0.08)' }}
                >
                    <X size={28} className="text-text-muted group-hover:text-danger transition-colors" />
                </motion.button>

                <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={handleRefresh}
                    className="w-12 h-12 rounded-full bg-surface flex items-center justify-center shadow-lg hover:bg-accent/20 transition-colors group"
                >
                    <RefreshCw size={20} className={`text-text-muted group-hover:text-accent transition-colors ${refreshing ? 'animate-spin' : ''}`} />
                </motion.button>

                <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={handleLike}
                    className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all group"
                >
                    <Heart size={28} className="text-white group-hover:scale-110 transition-transform" fill="currentColor" />
                </motion.button>
            </div>

            {/* Comment form modal */}
            {commentProfile && (
                <CommentForm
                    profile={commentProfile}
                    onClose={() => setCommentProfile(null)}
                />
            )}
        </div>
    );
}
