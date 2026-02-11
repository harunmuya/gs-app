'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Star, MessageCircle, Navigation, MapPin, Eye, ChevronLeft, ChevronRight, User, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import Link from 'next/link';
import Logo from '@/components/Logo';
import VerifiedBadge from '@/components/VerifiedBadge';
import ContactButtons from '@/components/ContactButtons';
import CommentForm from '@/components/CommentForm';

export default function DiscoverPage() {
    const { user, guest } = useAuth();
    const { location, requestLocation } = useGeolocation();

    // Data states
    const [profiles, setProfiles] = useState([]);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [matchesLoading, setMatchesLoading] = useState(true);

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const PER_PAGE = 6;

    // UI states
    const [commentProfile, setCommentProfile] = useState(null);
    const [showMatch, setShowMatch] = useState(null);
    const [selectedProfile, setSelectedProfile] = useState(null); // For detailed view
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);

    // Fetch Matches for Slider
    useEffect(() => {
        if (user) {
            fetchMatches();
        } else {
            setMatchesLoading(false);
        }
    }, [user]);

    const fetchMatches = async () => {
        try {
            const res = await fetch('/api/matches');
            const data = await res.json();
            setMatches(data.matches || []);
        } catch (error) {
            console.error('Error fetching matches:', error);
        } finally {
            setMatchesLoading(false);
        }
    };

    // Fetch Profiles for Grid
    useEffect(() => {
        fetchProfiles(page);
    }, [page]);

    const fetchProfiles = async (pageNum) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/profiles?page=${pageNum}&per_page=${PER_PAGE}`);
            const data = await res.json();

            if (data.profiles) {
                setProfiles(data.profiles);
                setTotalPages(data.totalPages || 1);
            }
        } catch (error) {
            console.error('Error fetching profiles:', error);
        } finally {
            setLoading(false);
        }
    };

    // Actions
    const handleLike = async (profile, type = 'like') => {
        if (!user && guest) {
            setShowLoginPrompt(true);
            return;
        }
        if (!user) return; // Or prompt login
        try {
            const res = await fetch('/api/likes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    profileWpId: profile.wpId,
                    profileName: profile.name,
                    profileImage: profile.imageUrl,
                    profileLocation: profile.location,
                    profileBio: profile.bio,
                    profileCoords: profile.coords,
                    type,
                }),
            });
            const data = await res.json();
            if (data.isMatch) {
                setShowMatch(profile);
                setTimeout(() => setShowMatch(null), 3000);
            }
        } catch (error) {
            console.error('Like error:', error);
        }
    };

    const handleMessage = (profile) => {
        if (!user && guest) {
            setShowLoginPrompt(true);
            return;
        }
        setCommentProfile(profile);
    };

    return (
        <div className="pb-24 pt-4 px-4 max-w-lg mx-auto md:max-w-4xl">
            {/* Header */}
            <header className="flex items-center justify-between mb-6 sticky top-0 bg-bg-dark/80 backdrop-blur-md z-40 py-2">
                <div className="flex items-center gap-2">
                    <Logo size={28} />
                    <h1 className="text-xl font-bold text-gradient">Discover</h1>
                </div>
                <div className="flex items-center gap-2">
                    {location && (
                        <span className="flex items-center gap-1 text-xs text-text-secondary bg-surface rounded-full px-2.5 py-1">
                            <Navigation size={10} className="text-primary" />
                            {location.city || 'Nearby'}
                        </span>
                    )}
                    <button onClick={() => fetchProfiles(page)} className="p-2 hover:bg-surface rounded-full transition-colors">
                        <Navigation size={18} className="text-text-muted rotate-45" />
                    </button>
                </div>
            </header>

            {/* Featured Slider (Matches) */}
            {user && matches.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3 px-1">
                        Recent Matches
                    </h2>
                    <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar">
                        {matches.map((match) => (
                            <Link href="/matches" key={match.id} className="snap-center shrink-0 w-20 flex flex-col items-center gap-2 group">
                                <div className="w-16 h-16 rounded-full p-0.5 gradient-primary group-hover:scale-105 transition-transform">
                                    <div className="w-full h-full rounded-full overflow-hidden border-2 border-bg-dark">
                                        <img src={match.profile_image} alt={match.profile_name} className="w-full h-full object-cover" />
                                    </div>
                                </div>
                                <span className="text-xs font-medium text-text-primary truncate w-full text-center">
                                    {match.profile_name}
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Profiles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {loading ? (
                    [...Array(6)].map((_, i) => (
                        <div key={i} className="aspect-[2/3] rounded-3xl bg-surface animate-pulse" />
                    ))
                ) : profiles.map((profile, index) => (
                    <div
                        key={profile.wpId}
                        onClick={() => setSelectedProfile(profile)}
                        className="relative group rounded-3xl overflow-hidden bg-bg-card card-shadow aspect-[2/3] cursor-pointer"
                    >
                        {/* Image */}
                        <img
                            src={profile.imageUrl}
                            alt={profile.name}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading={index < 4 ? "eager" : "lazy"}
                            decoding="async"
                        />
                        <div className="absolute inset-0 gradient-card" />

                        {/* Top badges */}
                        <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
                            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full glass text-[10px] text-white/90 font-medium">
                                <Eye size={12} />
                                {profile.views?.toLocaleString()}
                            </div>
                        </div>

                        {/* Content Overlay */}
                        <div className="absolute bottom-0 inset-x-0 p-4 space-y-3 z-10">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-1.5">
                                    {profile.name}
                                    <VerifiedBadge size={16} />
                                </h3>
                                <div className="flex items-center gap-1 text-white/80 text-sm mt-0.5">
                                    <MapPin size={12} />
                                    {profile.location} • {profile.age} yrs
                                </div>
                            </div>

                            {/* Like Action Buttons on Card (Quick actions) */}
                            <div className="flex items-center gap-2 pt-1" onClick={e => e.stopPropagation()}>
                                <button
                                    onClick={() => handleLike(profile)}
                                    className="p-3 rounded-full bg-surface/20 hover:bg-surface/40 backdrop-blur-md transition-colors text-white hover:text-rose-500"
                                >
                                    <Heart size={20} />
                                </button>
                                <button
                                    onClick={() => handleLike(profile, 'superlike')}
                                    className="p-3 rounded-full bg-surface/20 hover:bg-surface/40 backdrop-blur-md transition-colors text-white hover:text-amber-400"
                                >
                                    <Star size={20} />
                                </button>
                                <div className="flex-1 text-right text-xs text-white/70 font-medium">
                                    Tap to view details
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-center gap-4 py-6">
                <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="p-3 rounded-xl bg-surface hover:bg-surface-light disabled:opacity-50 transition-colors"
                >
                    <ChevronLeft size={20} />
                </button>

                <span className="text-sm font-medium text-text-secondary">
                    Page {page} of {totalPages}
                </span>

                <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                    className="p-3 rounded-xl bg-surface hover:bg-surface-light disabled:opacity-50 transition-colors"
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Detailed Profile Modal */}
            <AnimatePresence>
                {selectedProfile && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 overflow-y-auto"
                        onClick={() => setSelectedProfile(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 50 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-bg-card rounded-3xl w-full max-w-md overflow-hidden relative"
                            onClick={e => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setSelectedProfile(null)}
                                className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-md"
                            >
                                <X size={20} />
                            </button>

                            {/* Image Header */}
                            <div className="relative aspect-[3/4]">
                                <img
                                    src={selectedProfile.imageUrl}
                                    alt={selectedProfile.name}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 gradient-overlay" />
                                <div className="absolute bottom-0 px-6 pb-6 w-full">
                                    <h2 className="text-3xl font-extrabold text-white flex items-center gap-2">
                                        {selectedProfile.name}
                                        <VerifiedBadge size={24} />
                                    </h2>
                                    <div className="flex items-center gap-2 text-white/90 mt-1">
                                        <MapPin size={16} />
                                        <span>{selectedProfile.location}</span>
                                        <span>•</span>
                                        <span>{selectedProfile.age} yrs</span>
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-6 bg-bg-card">
                                {/* Bio */}
                                <div>
                                    <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">About</h3>
                                    <p className="text-text-primary leading-relaxed text-sm">
                                        {selectedProfile.bio}
                                    </p>
                                </div>

                                {/* Social / Contact Buttons */}
                                <div>
                                    <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3">Contact Info</h3>
                                    <ContactButtons profileName={selectedProfile.name} />
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-3 pt-2 border-t border-white/10">
                                    <button
                                        onClick={() => {
                                            handleLike(selectedProfile);
                                            setSelectedProfile(null);
                                        }}
                                        className="flex-1 py-3 rounded-xl font-bold bg-surface hover:bg-surface-light text-text-primary transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Heart size={18} /> Like
                                    </button>
                                    <button
                                        onClick={() => handleMessage(selectedProfile)}
                                        className="flex-1 py-3 rounded-xl font-bold text-white gradient-primary shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                                    >
                                        <MessageCircle size={18} /> Message
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Login Prompt Modal */}
            <AnimatePresence>
                {showLoginPrompt && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                        onClick={() => setShowLoginPrompt(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-bg-card p-6 rounded-3xl text-center max-w-sm w-full border border-white/10"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mx-auto mb-4">
                                <User size={32} className="text-primary" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">Sign In Required</h2>
                            <p className="text-text-secondary mb-6 text-sm">
                                Create a free account to like profiles, send messages, and save your matches.
                            </p>
                            <Link
                                href="/auth/login"
                                className="block w-full py-3 rounded-xl font-bold text-white gradient-primary mb-3"
                            >
                                Sign In / Sign Up
                            </Link>
                            <button
                                onClick={() => setShowLoginPrompt(false)}
                                className="w-full py-3 rounded-xl text-text-muted hover:bg-surface transition-colors font-medium"
                            >
                                Maybe Later
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Match Modal */}
            <AnimatePresence>
                {showMatch && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                        onClick={() => setShowMatch(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.8, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            className="bg-bg-card p-8 rounded-3xl text-center max-w-sm w-full border border-white/10"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="text-6xl mb-4">💖</div>
                            <h2 className="text-2xl font-bold text-white mb-2">It's a Match!</h2>
                            <p className="text-text-secondary mb-6">
                                You and <span className="text-primary font-bold">{showMatch.name}</span> like each other!
                            </p>
                            <div className="relative w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-primary mb-6">
                                <img src={showMatch.imageUrl} alt={showMatch.name} className="w-full h-full object-cover" />
                            </div>
                            <button
                                onClick={() => {
                                    setShowMatch(null);
                                    setCommentProfile(showMatch);
                                }}
                                className="w-full py-3 rounded-xl font-bold text-white gradient-primary"
                            >
                                Send Message
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {commentProfile && (
                <CommentForm
                    profile={commentProfile}
                    onClose={() => setCommentProfile(null)}
                />
            )}
        </div>
    );
}
