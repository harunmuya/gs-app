'use client';

import { useState, useEffect, use } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Heart, Bookmark, MapPin, Eye, MessageCircle, Share2, Star, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ContactButtons from '@/components/ContactButtons';
import CommentForm from '@/components/CommentForm';
import VerifiedBadge from '@/components/VerifiedBadge';
import Logo from '@/components/Logo';

export default function SingleProfilePage({ params }) {
    const resolvedParams = use(params);
    const profileId = resolvedParams.id;
    const router = useRouter();
    const {
        user, guest, addLike, addMatch, isProfileSwiped,
        saveProfile, unsaveProfile, isProfileSaved, logProfileView, likes
    } = useAuth();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showComment, setShowComment] = useState(false);
    const [liked, setLiked] = useState(false);

    useEffect(() => {
        async function loadProfile() {
            try {
                const res = await fetch(`/api/profiles?id=${profileId}`);
                const data = await res.json();
                if (data.profiles && data.profiles.length > 0) {
                    const p = data.profiles[0];
                    setProfile(p);
                    logProfileView(p);
                    setLiked(isProfileSwiped(p.wpId));
                }
            } catch (err) {
                console.error('Failed to load profile:', err);
            } finally {
                setLoading(false);
            }
        }
        if (profileId) loadProfile();
    }, [profileId]);

    const handleLike = () => {
        if (!profile || liked) return;
        addLike(profile);
        setLiked(true);
        if (Math.random() < 0.4) {
            const score = Math.floor(Math.random() * 20) + 80;
            addMatch(profile, score);
        }
    };

    const handleSave = () => {
        if (!profile) return;
        if (isProfileSaved(profile.wpId)) {
            unsaveProfile(profile.wpId);
        } else {
            saveProfile(profile);
        }
    };

    const handleShare = async () => {
        if (!profile) return;
        try {
            await navigator.share({
                title: profile.name,
                text: `Check out ${profile.name} on Genuine Sugar Mummies`,
                url: window.location.href,
            });
        } catch { }
    };

    if (loading) {
        return (
            <div className="min-h-dvh bg-bg-dark">
                <div className="animate-pulse">
                    <div className="h-[50vh] bg-surface" />
                    <div className="p-5 space-y-4">
                        <div className="h-8 w-48 bg-surface rounded-lg" />
                        <div className="h-4 w-32 bg-surface rounded" />
                        <div className="h-20 bg-surface rounded-xl" />
                    </div>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-4">
                <div className="text-5xl">🔍</div>
                <h2 className="text-lg font-bold text-white">Profile not found</h2>
                <button onClick={() => router.back()} className="px-6 py-3 rounded-2xl gradient-primary text-white font-semibold">
                    Go Back
                </button>
            </div>
        );
    }

    const isSaved = isProfileSaved(profile.wpId);

    return (
        <div className="min-h-dvh bg-bg-dark pb-8">
            {/* Hero Image */}
            <div className="relative" style={{ height: '55vh', minHeight: '350px' }}>
                {profile.imageUrl ? (
                    <img src={profile.imageUrl} alt={profile.name} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                    <div className="absolute inset-0 bg-surface flex items-center justify-center">
                        <Logo size={80} className="opacity-20" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-bg-dark via-bg-dark/30 to-transparent" />

                {/* Back button */}
                <button
                    onClick={() => router.back()}
                    className="absolute top-4 left-4 w-10 h-10 rounded-full glass flex items-center justify-center z-10"
                >
                    <ArrowLeft size={20} className="text-white" />
                </button>

                {/* Top right actions */}
                <div className="absolute top-4 right-4 flex gap-2 z-10">
                    <button onClick={handleShare} className="w-10 h-10 rounded-full glass flex items-center justify-center">
                        <Share2 size={18} className="text-white" />
                    </button>
                    <button onClick={handleSave} className="w-10 h-10 rounded-full glass flex items-center justify-center">
                        <Bookmark size={18} className={isSaved ? 'text-gold fill-gold' : 'text-white'} />
                    </button>
                </div>

                {/* Profile name overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-5">
                    <div className="flex items-end justify-between">
                        <div>
                            <h1 className="text-3xl font-extrabold text-white flex items-center gap-2 mb-1">
                                {profile.name || 'Sugar Mummy'}
                                <VerifiedBadge size={22} />
                            </h1>
                            {profile.location && (
                                <div className="flex items-center gap-1.5 text-white/80">
                                    <MapPin size={14} />
                                    <span className="text-sm">{profile.location}</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1 px-3 py-1.5 rounded-full glass">
                            <Eye size={14} className="text-text-secondary" />
                            <span className="text-sm text-text-secondary font-medium">
                                {profile.views?.toLocaleString() || '—'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content area */}
            <div className="px-5 space-y-5">
                {/* Quick Action Buttons */}
                <div className="flex items-center gap-3 -mt-5 relative z-10">
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={handleLike}
                        disabled={liked}
                        className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white shadow-lg transition-all ${liked ? 'bg-primary/30 cursor-default' : 'gradient-primary shadow-primary/30 hover:shadow-primary/50'}`}
                    >
                        <Heart size={20} fill={liked ? 'currentColor' : 'none'} />
                        {liked ? 'Liked ✓' : 'Like'}
                    </motion.button>
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setShowComment(true)}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white bg-surface-light border border-white/10 hover:bg-surface transition-all"
                    >
                        <MessageCircle size={20} />
                        Message
                    </motion.button>
                </div>

                {/* About Section */}
                <div className="bg-bg-card rounded-3xl p-5 border border-white/5">
                    <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                        <Star size={18} className="text-gold" />
                        About
                    </h2>
                    {profile.excerpt ? (
                        <p className="text-text-secondary leading-relaxed text-sm">{profile.excerpt}</p>
                    ) : (
                        <p className="text-text-muted text-sm italic">No description available.</p>
                    )}
                    {profile.content && (
                        <div className="mt-3 text-text-secondary text-sm leading-relaxed prose-sm"
                            dangerouslySetInnerHTML={{ __html: profile.content }}
                        />
                    )}
                </div>

                {/* Profile Details */}
                <div className="bg-bg-card rounded-3xl p-5 border border-white/5 space-y-3">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Details</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {profile.location && (
                            <div className="bg-surface rounded-xl p-3">
                                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Location</p>
                                <p className="text-sm font-semibold text-text-primary">{profile.location}</p>
                            </div>
                        )}
                        <div className="bg-surface rounded-xl p-3">
                            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Status</p>
                            <p className="text-sm font-semibold text-success">✓ Verified</p>
                        </div>
                        <div className="bg-surface rounded-xl p-3">
                            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Views</p>
                            <p className="text-sm font-semibold text-text-primary">{profile.views?.toLocaleString() || 'N/A'}</p>
                        </div>
                        {profile.date && (
                            <div className="bg-surface rounded-xl p-3">
                                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Joined</p>
                                <p className="text-sm font-semibold text-text-primary">
                                    {new Date(profile.date).toLocaleDateString('en-KE', { month: 'short', year: 'numeric' })}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Contact Buttons - After main content */}
                <ContactButtons profileName={profile.name} />

                {/* Leave Comment */}
                <button
                    onClick={() => setShowComment(true)}
                    className="w-full py-3.5 rounded-2xl text-sm font-semibold text-text-secondary bg-bg-card border border-white/5 hover:bg-surface transition-colors flex items-center justify-center gap-2"
                >
                    💬 Leave a Comment on this Profile
                </button>
            </div>

            {/* Comment Form Modal */}
            {showComment && (
                <CommentForm
                    profile={{ wpId: profile.wpId, name: profile.name }}
                    onClose={() => setShowComment(false)}
                />
            )}
        </div>
    );
}
