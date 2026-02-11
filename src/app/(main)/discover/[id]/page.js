'use client';

import { useState, useEffect, use } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Heart, Bookmark, MapPin, MessageCircle, Share2, Star, Clock, TrendingUp, Award, Activity, Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ContactButtons from '@/components/ContactButtons';
import CommentForm from '@/components/CommentForm';
import VerifiedBadge from '@/components/VerifiedBadge';
import UserAvatar from '@/components/UserAvatar';

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
        if (isProfileSaved(profile.wpId)) unsaveProfile(profile.wpId);
        else saveProfile(profile);
    };

    const handleShare = async () => {
        if (!profile) return;
        try { await navigator.share({ title: profile.name, text: `Check out ${profile.name} on Genuine Sugar Mummies`, url: window.location.href }); } catch { }
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
                <h2 className="text-lg font-bold text-text-primary">Profile not found</h2>
                <button onClick={() => router.back()} className="px-6 py-3 rounded-2xl gradient-primary text-white font-semibold">Go Back</button>
            </div>
        );
    }

    const isSaved = isProfileSaved(profile.wpId);

    // ---- Computed Labels ----
    const demandLevel = profile.commentCount >= 10 ? 'High' : profile.commentCount >= 3 ? 'Medium' : 'Low';
    const demandColor = demandLevel === 'High' ? 'text-primary' : demandLevel === 'Medium' ? 'text-gold' : 'text-text-muted';
    const availabilityStatus = profile.daysSincePost < 7 ? 'Available Now' : profile.daysSincePost < 30 ? 'Recently Active' : 'Occasional';
    const availabilityColor = profile.daysSincePost < 7 ? 'text-success' : profile.daysSincePost < 30 ? 'text-gold' : 'text-text-muted';
    const rankingScore = Math.min(99, 50 + profile.commentCount * 3 + (profile.daysSincePost < 30 ? 20 : 0) + (profile.imageUrl ? 10 : 0) + (profile.age ? 5 : 0));

    return (
        <div className="min-h-dvh bg-bg-dark pb-8">
            {/* Hero */}
            <div className="relative" style={{ height: '55vh', minHeight: '350px' }}>
                {profile.imageUrl ? (
                    <img src={profile.imageUrl} alt={profile.name} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                    <div className="absolute inset-0 bg-surface flex items-center justify-center">
                        <UserAvatar name={profile.name} size={120} />
                    </div>
                )}
                <div className="absolute inset-0 gradient-overlay" />

                <button onClick={() => router.back()} className="absolute top-4 left-4 w-10 h-10 rounded-full glass flex items-center justify-center z-10">
                    <ArrowLeft size={20} className="text-white" />
                </button>

                <div className="absolute top-4 right-4 flex gap-2 z-10">
                    <button onClick={handleShare} className="w-10 h-10 rounded-full glass flex items-center justify-center">
                        <Share2 size={18} className="text-white" />
                    </button>
                    <button onClick={handleSave} className="w-10 h-10 rounded-full glass flex items-center justify-center">
                        <Bookmark size={18} className={isSaved ? 'text-gold fill-gold' : 'text-white'} />
                    </button>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-5 profile-overlay-text">
                    <div className="flex items-end justify-between">
                        <div>
                            <h1 className="text-3xl font-extrabold text-white flex items-center gap-2 mb-1">
                                {profile.name || 'Sugar Mummy'}
                                {profile.age && <span className="text-white/70 font-normal text-xl">{profile.age}</span>}
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
                            <MessageCircle size={14} className="text-white/70" />
                            <span className="text-sm text-white/80 font-medium">{profile.commentCount}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-5 space-y-5">
                {/* Quick Actions */}
                <div className="flex items-center gap-3 -mt-5 relative z-10">
                    <motion.button whileTap={{ scale: 0.9 }} onClick={handleLike} disabled={liked}
                        className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white shadow-lg transition-all ${liked ? 'bg-primary/30 cursor-default' : 'gradient-primary shadow-primary/30 hover:shadow-primary/50'}`}>
                        <Heart size={20} fill={liked ? 'currentColor' : 'none'} />
                        {liked ? 'Liked ✓' : 'Like'}
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowComment(true)}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-text-primary bg-surface-light border transition-all"
                        style={{ borderColor: 'var(--color-border)' }}>
                        <MessageCircle size={20} />
                        Message
                    </motion.button>
                </div>

                {/* Profile About */}
                <div className="bg-bg-card rounded-3xl p-5" style={{ border: '1px solid var(--color-border)' }}>
                    <h2 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                        <Star size={18} className="text-gold" />
                        Profile About
                    </h2>
                    {profile.excerpt ? (
                        <p className="text-text-secondary leading-relaxed text-sm">{profile.excerpt}</p>
                    ) : (
                        <p className="text-text-muted text-sm italic">No description available.</p>
                    )}
                    {profile.content && (
                        <div className="mt-3 text-text-secondary text-sm leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: profile.content }}
                        />
                    )}
                </div>

                {/* Details Grid */}
                <div className="bg-bg-card rounded-3xl p-5 space-y-3" style={{ border: '1px solid var(--color-border)' }}>
                    <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Details</h3>
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
                            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Comments</p>
                            <p className="text-sm font-semibold text-text-primary">{profile.commentCount}</p>
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

                {/* Contact buttons after main content */}
                <ContactButtons profileName={profile.name} />

                {/* ---- Profile Labels: Availability, Demand, Ranking, Region ---- */}
                <div className="bg-bg-card rounded-3xl p-5 space-y-3" style={{ border: '1px solid var(--color-border)' }}>
                    <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                        <Award size={15} className="text-gold" /> Profile Insights
                    </h3>
                    <div className="space-y-2.5">
                        <LabelRow icon={Activity} label="Availability" value={availabilityStatus} valueColor={availabilityColor} />
                        <LabelRow icon={TrendingUp} label="Demand" value={`${demandLevel} Demand`} valueColor={demandColor} />
                        <LabelRow icon={Award} label="Ranking" value={`${rankingScore}/100`} valueColor={rankingScore >= 70 ? 'text-gold' : 'text-text-secondary'} />
                        <LabelRow icon={Globe} label="Region" value={profile.location || 'Kenya'} valueColor="text-text-primary" />
                        {profile.commentCount > 0 && (
                            <LabelRow icon={MessageCircle} label="Engagement" value={`${profile.commentCount} real comments`} valueColor="text-success" />
                        )}
                    </div>
                </div>

                {/* Leave Comment */}
                <button onClick={() => setShowComment(true)}
                    className="w-full py-3.5 rounded-2xl text-sm font-semibold text-text-secondary bg-bg-card transition-colors flex items-center justify-center gap-2"
                    style={{ border: '1px solid var(--color-border)' }}>
                    💬 Leave a Comment on this Profile
                </button>

                {/* Version */}
                <p className="text-center text-[10px] text-text-muted pt-2 pb-4">
                    Genuine Sugar Mummies App · v2.1.0
                </p>
            </div>

            {showComment && (
                <CommentForm profile={{ wpId: profile.wpId, name: profile.name, imageUrl: profile.imageUrl }} onClose={() => setShowComment(false)} />
            )}
        </div>
    );
}

function LabelRow({ icon: Icon, label, value, valueColor }) {
    return (
        <div className="flex items-center justify-between py-2 border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-2">
                <Icon size={15} className="text-text-muted" />
                <span className="text-xs text-text-muted uppercase tracking-wider">{label}</span>
            </div>
            <span className={`text-sm font-semibold ${valueColor}`}>{value}</span>
        </div>
    );
}
