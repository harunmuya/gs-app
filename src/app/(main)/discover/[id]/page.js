'use client';

import { useState, useEffect, use } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Heart, Bookmark, MapPin, MessageCircle, MessageSquare, Share2, Star, Clock, TrendingUp, Award, Activity, Globe, User, Copy, CheckCircle, Eye, Calendar, BarChart3, Zap, Lock, Shield, CheckCheck, Sparkles, Crown, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import CommentForm from '@/components/CommentForm';
import UserAvatar from '@/components/UserAvatar';
import VerifiedBadge from '@/components/VerifiedBadge';


// Deterministic match check (no randomness)
function shouldMatchProfile(profile) {
    const score = Math.min(99, 50 + (profile.commentCount || 0) * 3 + (profile.daysSincePost < 30 ? 20 : 0) + (profile.imageUrl ? 10 : 0) + (profile.age ? 5 : 0));
    if (score >= 80) return { match: true, score };
    if (score >= 70 && (profile.commentCount || 0) >= 3) return { match: true, score };
    if (score >= 65 && (profile.daysSincePost || 999) < 7 && profile.imageUrl) return { match: true, score };
    return { match: false, score };
}

// Format date as "May 23, 2026 at 3:45 PM"
function formatPostedDate(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) +
        ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatCommentDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}



// Star rating component
function StarRating({ rating, max = 5 }) {
    return (
        <div className="flex items-center gap-0.5">
            {Array.from({ length: max }, (_, i) => (
                <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i < rating ? '#F59E0B' : 'none'} stroke={i < rating ? '#F59E0B' : 'rgba(255,255,255,0.2)'} strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
            ))}
        </div>
    );
}

function cleanSentence(s) {
    let clean = s.trim();
    // Strip emojis
    try {
        clean = clean.replace(/\p{Extended_Pictographic}/gu, '');
    } catch (e) {
        clean = clean.replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
    }
    clean = clean.trim();
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    if (!/[.!?]$/.test(clean)) clean += '.';
    clean = clean.replace(/\+?\d{9,13}/g, '[Verified Contact]');
    return clean;
}

// Clean bio text — returns the real profile content as a single clean paragraph
function getCleanBio(contentHtml, excerptText) {
    let cleanText = (contentHtml || excerptText || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#8217;/g, "'")
        .replace(/&#8211;/g, '–')
        .replace(/&amp;/g, '&')
        .replace(/&hellip;/g, '...')
        .replace(/continue\s+reading.*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();

    cleanText = cleanText.replace(/whatsapp me/i, 'contact me')
        .replace(/join our agency/i, 'join')
        .replace(/genuine sugar mummies/i, 'premium matching')
        .replace(/genuine sugar daddies/i, 'premium matching');

    // Strip emojis
    try {
        cleanText = cleanText.replace(/\p{Extended_Pictographic}/gu, '');
    } catch (e) {
        cleanText = cleanText.replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
    }

    // Remove phone numbers
    cleanText = cleanText.replace(/\+?\d{9,13}/g, '[Verified Contact]');
    cleanText = cleanText.trim();

    // Filter out junk sentences
    const sentences = cleanText.split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 12 && !s.toLowerCase().includes('mary g') && !s.toLowerCase().includes('escrow') && !s.toLowerCase().includes('t.me'));

    return sentences.length > 0 ? sentences.join(' ') : cleanText;
}

export default function SingleProfilePage({ params }) {
    const resolvedParams = use(params);
    const profileId = resolvedParams.id;
    const router = useRouter();

    // Dynamic Canonical Link Update for SEO deduplication
    useEffect(() => {
        if (typeof window !== 'undefined' && profileId) {
            const canonicalUrl = `${window.location.origin}/discover/${profileId}`;
            let canonical = document.querySelector('link[rel="canonical"]');
            if (canonical) {
                canonical.setAttribute('href', canonicalUrl);
            } else {
                canonical = document.createElement('link');
                canonical.setAttribute('rel', 'canonical');
                canonical.setAttribute('href', canonicalUrl);
                document.head.appendChild(canonical);
            }
        }
    }, [profileId]);
    const {
        user, addLike, addMatch, isProfileSwiped,
        saveProfile, unsaveProfile, isProfileSaved, logProfileView, likes, campaigns, subscription,
        getOrCreateConversation
    } = useAuth();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showComment, setShowComment] = useState(false);
    const [liked, setLiked] = useState(false);
    const [comments, setComments] = useState([]);
    const [loadingComments, setLoadingComments] = useState(true);
    const [copied, setCopied] = useState(false);
    const [chatting, setChatting] = useState(false);
    const compatibilityScore = profile ? shouldMatchProfile(profile).score : 0;

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

    // Fetch real WordPress comments
    useEffect(() => {
        async function loadComments() {
            try {
                const res = await fetch(`/api/comments?post=${profileId}`);
                const data = await res.json();
                setComments(data.comments || []);
            } catch (err) {
                console.error('Failed to load comments:', err);
            } finally {
                setLoadingComments(false);
            }
        }
        if (profileId) loadComments();
    }, [profileId]);

    const handleLike = () => {
        if (!profile || liked) return;
        addLike(profile).then(res => {
            if (res?.limitReached) {
                router.push('/subscribe');
            } else {
                setLiked(true);
                const { match, score } = shouldMatchProfile(profile);
                if (match) {
                    addMatch(profile, score);
                }
            }
        });
    };

    const handleChat = async () => {
        if (!profile || chatting) return;
        if (!user) {
            router.push('/login');
            return;
        }
        setChatting(true);
        try {
            const conversation = await getOrCreateConversation(profile.wpId, profile.name, profile.imageUrl);
            if (conversation) {
                router.push(`/chat/${conversation.id}`);
            }
        } catch (err) {
            console.error('Error opening chat:', err);
        } finally {
            setChatting(false);
        }
    };

    const handleSave = () => {
        if (!profile) return;
        if (isProfileSaved(profile.wpId)) unsaveProfile(profile.wpId);
        else saveProfile(profile);
    };

    const handleShare = async () => {
        if (!profile) return;
        const shareData = {
            title: profile.name,
            text: `Check out ${profile.name} on Genuine Sugar Mummies`,
            url: window.location.href,
        };

        // Try Web Share API first
        if (navigator.share) {
            try {
                await navigator.share(shareData);
                return;
            } catch { }
        }

        // Fallback: copy to clipboard
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { }
    };

    const handleCommentClose = () => {
        setShowComment(false);
        fetch(`/api/comments?post=${profileId}`)
            .then(r => r.json())
            .then(d => setComments(d.comments || []))
            .catch(() => { });
    };

    // ── Loading state with GS pulse-zoom ──
    if (loading) {
        return (
            <div className="min-h-dvh flex flex-col items-center justify-center" style={{ background: 'var(--color-bg)' }}>
                <img
                    src="/gs.png"
                    alt="Loading"
                    className="w-16 h-16 object-contain animate-pulse-zoom"
                />
                <p className="text-text-muted text-sm mt-3 animate-pulse">Loading profile…</p>
            </div>
        );
    }

    // ── Not found ──
    if (!profile) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'var(--color-surface)' }}>
                    <User size={32} className="text-text-muted" />
                </div>
                <h2 className="text-lg font-bold text-text-primary">Profile not found</h2>
                <button onClick={() => router.back()} className="px-6 py-3 rounded-2xl gradient-primary text-white font-semibold">Go Back</button>
            </div>
        );
    }

    const isSaved = isProfileSaved(profile.wpId);

    // Computed Labels — all real data
    const demandLevel = profile.commentCount >= 10 ? 'High' : profile.commentCount >= 3 ? 'Medium' : 'Low';
    const demandBarColor = demandLevel === 'High' ? '#EC4899' : demandLevel === 'Medium' ? '#F59E0B' : '#6B7280';
    const availabilityStatus = profile.daysSincePost < 7 ? 'Available Now' : profile.daysSincePost < 30 ? 'Recently Active' : 'Occasional';
    const availabilityDotColor = profile.daysSincePost < 7 ? '#22C55E' : profile.daysSincePost < 30 ? '#F59E0B' : '#6B7280';
    const freshLabel = profile.daysSincePost < 3 ? 'Newly Available' : profile.daysSincePost <= 14 ? 'Featured' : null;
    const responseRate = profile.commentCount >= 10 ? 'High' : profile.commentCount >= 3 ? 'Medium' : 'Low';
    const responseColor = responseRate === 'High' ? '#22C55E' : responseRate === 'Medium' ? '#F59E0B' : '#6B7280';
    const daysActive = profile.daysSincePost || 0;

    // Clean bio text — real content only
    const bioText = getCleanBio(profile.content, profile.excerpt);
    const connectionMsg = encodeURIComponent(`Hi Admin Mary G, I need a match connection with ${profile.name || 'this person'} from GS App.`);

    return (
        <div className="min-h-dvh pb-8" style={{ background: 'var(--color-bg)' }}>
            {/* ═══════════════ Hero Image ═══════════════ */}
            <div className="relative" style={{ height: '55vh', minHeight: '350px' }}>
                {profile.imageUrl ? (
                    <img
                        src={profile.imageUrl}
                        alt={profile.name}
                        loading="eager"
                        referrerPolicy="no-referrer"
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                        }}
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'var(--color-surface)' }}>
                        <UserAvatar name={profile.name} size={120} />
                    </div>
                )}
                <div className="absolute inset-0 gradient-overlay" />

                <button onClick={() => router.back()} className="absolute top-4 left-4 w-10 h-10 rounded-full glass flex items-center justify-center z-10">
                    <ArrowLeft size={20} className="text-white" />
                </button>

                <div className="absolute top-4 right-4 flex gap-2 z-10">
                    {freshLabel && (
                        <motion.span
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-lg ${freshLabel === 'Newly Available' ? 'bg-success' : 'bg-gold'}`}
                        >
                            {freshLabel === 'Newly Available' ? <Clock size={11} /> : <Star size={11} />} {freshLabel}
                        </motion.span>
                    )}
                    <button onClick={handleShare} className="w-10 h-10 rounded-full glass flex items-center justify-center relative">
                        {copied ? <CheckCircle size={18} className="text-success" /> : <Share2 size={18} className="text-white" />}
                    </button>
                    <button onClick={handleSave} className="w-10 h-10 rounded-full glass flex items-center justify-center">
                        <Bookmark size={18} className={isSaved ? 'text-gold fill-gold' : 'text-white'} />
                    </button>
                </div>

                {/* Copied toast */}
                {copied && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute top-16 right-4 z-20 px-3 py-1.5 rounded-full bg-success text-white text-xs font-bold shadow-lg"
                    >
                        Link copied!
                    </motion.div>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-5 profile-overlay-text">
                    <div className="flex items-end justify-between">
                        <div>
                            <h1 className="text-3xl font-extrabold text-white flex items-center gap-2 mb-1 flex-wrap">
                                {profile.name || 'Sugar Mum'}
                                {profile.age && <span className="text-white/70 font-normal text-xl">{profile.age}</span>}
                                <VerifiedBadge size={22} verified={true} />
                                {profile.subscription?.plan && profile.subscription.plan !== 'free' && (
                                    <VerifiedBadge size={22} badgeText={profile.subscription.plan} />
                                )}
                                {(() => {
                                    const badgeVal = (profile.customBadge || profile.custom_badge || '').trim();
                                    if (badgeVal && badgeVal.toLowerCase() !== 'verified' && badgeVal.toLowerCase() !== profile.subscription?.plan?.toLowerCase()) {
                                        return <VerifiedBadge size={22} badgeText={badgeVal} />;
                                    }
                                    return null;
                                })()}
                            </h1>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                {/* Profile type pill with gradient */}
                                {(() => {
                                    const LABELS = { sugar_mummy: 'Sugar Mummy', sugar_daddy: 'Sugar Daddy', toyboy: 'Toyboy', sugar_guy: 'Sugar Guy', young_lady: 'Young Lady', mistress: 'Mistress', cougar: 'Cougar' };
                                    const GRADS = { sugar_mummy: 'linear-gradient(135deg,#EC4899,#F43F5E)', sugar_daddy: 'linear-gradient(135deg,#3B82F6,#6366F1)', toyboy: 'linear-gradient(135deg,#F59E0B,#EF4444)', sugar_guy: 'linear-gradient(135deg,#10B981,#14B8A6)', young_lady: 'linear-gradient(135deg,#A855F7,#EC4899)', mistress: 'linear-gradient(135deg,#D946EF,#9333EA)', cougar: 'linear-gradient(135deg,#EF4444,#DC2626)' };
                                    const LOOKING = { sugar_mummy: 'Toyboy / Sugar Guy', sugar_daddy: 'Young Lady / Mistress', toyboy: 'Sugar Mummy', sugar_guy: 'Sugar Mummy', young_lady: 'Sugar Daddy', mistress: 'Sugar Daddy', cougar: 'Toyboy / Sugar Guy' };
                                    const pt = profile.profileType || 'sugar_mummy';
                                    return (
                                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-lg"
                                            style={{ background: GRADS[pt] || GRADS.sugar_mummy }}>
                                            {LABELS[pt] || 'Sugar Mummy'}
                                        </span>
                                    );
                                })()}
                            </div>
                            {/* Looking for */}
                            {(() => {
                                const LOOKING = { sugar_mummy: 'Toyboy / Sugar Guy', sugar_daddy: 'Young Lady / Mistress', toyboy: 'Sugar Mummy', sugar_guy: 'Sugar Mummy', young_lady: 'Sugar Daddy', mistress: 'Sugar Daddy', cougar: 'Toyboy / Sugar Guy' };
                                const pt = profile.profileType || 'sugar_mummy';
                                return (
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Heart size={11} className="text-pink-400" />
                                        <span className="text-[11px] text-pink-300 font-semibold">Looking for {LOOKING[pt] || 'Partner'}</span>
                                    </div>
                                );
                            })()}
                            {profile.location && (
                                <div className="flex items-center gap-1.5 text-white/80">
                                    <MapPin size={14} />
                                    <img src="https://flagcdn.com/24x18/ke.png" alt="KE" style={{ width: '16px', height: '12px', borderRadius: '2px' }} />
                                    <span className="text-sm">{profile.location}, Kenya</span>
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

            {/* ═══════════════ Content ═══════════════ */}
            <div className="px-5 space-y-5">
                {/* Dynamic Admin Banner Ad */}
                {campaigns?.bannerAds && (!subscription || subscription.plan === 'free') && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-3xl p-4 bg-gradient-to-r from-purple-900/10 via-pink-900/10 to-rose-900/10 border border-purple-500/30 flex items-center gap-3 relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-rose-500/20 rounded-full blur-xl pointer-events-none" />
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500 to-rose-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-purple-500/20">
                            <Crown size={20} className="animate-pulse" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-black text-text-primary uppercase tracking-wide flex items-center gap-1.5">
                                GS Premium VIP Unlock
                            </h4>
                            <p className="text-[10px] text-text-secondary leading-normal">
                                Get direct phone numbers, unlimited texting, verification checks & escrow safeties!
                            </p>
                        </div>
                        <a
                            href="/subscribe"
                            className="px-3.5 py-2 bg-gradient-to-r from-purple-500 to-rose-500 hover:from-purple-650 hover:to-rose-650 text-white text-[10px] font-black rounded-xl shadow-md transition-all whitespace-nowrap active:scale-95 shrink-0"
                        >
                            Unlock VIP
                        </a>
                    </motion.div>
                )}

                {/* Quick Actions */}
                <div className="flex items-center gap-2.5 -mt-5 relative z-10">
                    <motion.button whileTap={{ scale: 0.9 }} onClick={handleLike} disabled={liked}
                        className="flex-1 flex items-center justify-center gap-1.5 py-3.5 rounded-2xl font-bold text-white shadow-lg transition-all"
                        style={liked
                            ? { background: 'rgba(236, 72, 153, 0.2)', cursor: 'default' }
                            : { background: 'linear-gradient(135deg, #EC4899, #F43F5E)', boxShadow: '0 6px 20px rgba(244, 63, 94, 0.35)' }}>
                        <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
                        {liked ? 'Liked' : 'Like'}
                    </motion.button>
                    {/* Phone Number */}
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => router.push('/subscribe')}
                        className="flex-1 flex flex-col items-center justify-center py-2.5 rounded-2xl shadow-lg transition-all"
                        style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
                        <span className="font-mono text-xs text-amber-300">+2547*******</span>
                        <span className="text-[7px] text-amber-400/60 mt-0.5">View number</span>
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowComment(true)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-3.5 rounded-2xl font-bold text-white shadow-lg transition-all"
                        style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', boxShadow: '0 6px 20px rgba(99, 102, 241, 0.3)' }}>
                        <MessageCircle size={18} />
                        Comment
                    </motion.button>
                </div>

                {/* ═══════════════ Trust & Verification ═══════════════ */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="rounded-3xl p-5 space-y-4 shadow-sm"
                    style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}
                >
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                            <Shield size={16} className="text-primary" />
                            Trust & Verification
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20">
                            Verified
                        </span>
                    </div>

                    <div className="space-y-2.5">
                        {/* Identity verified */}
                        <div className="flex items-start gap-3 p-3 rounded-2xl bg-surface/50 border border-border">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
                                <CheckCheck size={16} />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-text-primary">Identity verified</h4>
                                <p className="text-[10px] text-text-secondary mt-0.5 leading-snug">Verified by Admin Mary G through the official website database.</p>
                            </div>
                        </div>

                        {/* Photo confirmed */}
                        <div className="flex items-start gap-3 p-3 rounded-2xl bg-surface/50 border border-border">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-success/10 text-success shrink-0">
                                <User size={16} />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-text-primary">Photo confirmed</h4>
                                <p className="text-[10px] text-text-secondary mt-0.5 leading-snug">Profile photo has been reviewed and confirmed as authentic.</p>
                            </div>
                        </div>

                        {/* Synced from website */}
                        <div className="flex items-start gap-3 p-3 rounded-2xl bg-surface/50 border border-border">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-cyan-500/10 text-cyan-500 shrink-0">
                                <Globe size={16} />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-text-primary">Synced from website</h4>
                                <p className="text-[10px] text-text-secondary mt-0.5 leading-snug">Profile imported directly from genuinesugarmummies.co.ke.</p>
                            </div>
                        </div>
                    </div>

                    {/* Profile visited + Sync Date */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-surface/30">
                            <Eye size={14} className="text-text-muted shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[9px] text-text-muted uppercase leading-none">Status</p>
                                <p className="text-xs font-bold text-text-primary mt-1 flex items-center gap-1.5">
                                    Profile visited
                                    <CheckCircle size={11} className="text-success" />
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-surface/30">
                            <Calendar size={14} className="text-text-muted shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[9px] text-text-muted uppercase leading-none">Sync Date</p>
                                <p className="text-xs font-bold text-text-primary mt-1">
                                    {profile.date ? new Date(profile.date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' }) : 'Today'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Detailed posted stamp */}
                    {profile.date && (
                        <div className="text-[10px] text-text-muted text-center pt-1 flex items-center justify-center gap-1.5 bg-surface/30 py-2 rounded-xl border border-border">
                            <Clock size={11} className="text-primary" />
                            <span>Posted: <strong>{formatPostedDate(profile.date)}</strong></span>
                        </div>
                    )}
                </motion.div>

                {/* ═══════════════ Compatibility ═══════════════ */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="rounded-3xl p-5 space-y-4 shadow-sm"
                    style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}
                >
                    <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                        <Zap size={16} className="text-primary" />
                        Compatibility
                    </h3>

                    {/* Score display */}
                    <div className="p-4 rounded-2xl bg-surface/50 border border-border space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-text-secondary">Match Score</span>
                            <span className="text-2xl font-black text-primary">{compatibilityScore}%</span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-border overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${compatibilityScore}%` }}
                                transition={{ duration: 1.2, ease: 'easeOut' }}
                                className="h-full rounded-full"
                                style={{ background: `linear-gradient(90deg, ${compatibilityScore >= 75 ? '#22C55E' : compatibilityScore >= 50 ? '#F59E0B' : '#6B7280'}, ${compatibilityScore >= 75 ? '#10B981' : compatibilityScore >= 50 ? '#EAB308' : '#9CA3AF'})` }}
                            />
                        </div>
                    </div>

                    {/* Real data factors */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="p-3 rounded-xl bg-surface/30 border border-border text-center">
                            <Activity size={16} className="mx-auto mb-1.5" style={{ color: availabilityDotColor }} />
                            <p className="text-[10px] font-bold text-text-primary leading-tight">{availabilityStatus}</p>
                            <p className="text-[9px] text-text-muted mt-0.5">Activity</p>
                        </div>
                        <div className="p-3 rounded-xl bg-surface/30 border border-border text-center">
                            <MessageCircle size={16} className="mx-auto mb-1.5 text-primary" />
                            <p className="text-[10px] font-bold text-text-primary leading-tight">{profile.commentCount || 0}</p>
                            <p className="text-[9px] text-text-muted mt-0.5">Comments</p>
                        </div>
                        <div className="p-3 rounded-xl bg-surface/30 border border-border text-center">
                            <TrendingUp size={16} className="mx-auto mb-1.5" style={{ color: responseColor }} />
                            <p className="text-[10px] font-bold text-text-primary leading-tight">{responseRate}</p>
                            <p className="text-[9px] text-text-muted mt-0.5">Response</p>
                        </div>
                    </div>
                </motion.div>

                {/* ═══════════════ About — Key Details Only ═══════════════ */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.18 }}
                    className="rounded-3xl p-5 space-y-4"
                    style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}
                >
                    <h2 className="text-sm font-black text-text-primary uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-3">
                        <User size={18} className="text-primary" />
                        About {profile.name || 'Member'}
                    </h2>

                    <div className="space-y-3">
                        {/* Profile Type */}
                        {(() => {
                            const LABELS = { sugar_mummy: 'Sugar Mummy', sugar_daddy: 'Sugar Daddy', toyboy: 'Toyboy', sugar_guy: 'Sugar Guy', young_lady: 'Young Lady', mistress: 'Mistress', cougar: 'Cougar' };
                            const pt = profile.profileType || 'sugar_mummy';
                            return (
                                <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface/50 border border-border">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-pink-500/10 text-pink-500 shrink-0">
                                        <Heart size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-text-muted uppercase font-bold">Identity</p>
                                        <p className="text-xs font-bold text-text-primary">{LABELS[pt] || 'Member'}</p>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Looking For */}
                        {(() => {
                            const LOOKING = { sugar_mummy: 'Toyboy / Sugar Guy', sugar_daddy: 'Young Lady / Mistress', toyboy: 'Sugar Mummy', sugar_guy: 'Sugar Mummy', young_lady: 'Sugar Daddy', mistress: 'Sugar Daddy', cougar: 'Toyboy / Sugar Guy' };
                            const pt = profile.profileType || 'sugar_mummy';
                            const preferredPartner = profile.partnerType || LOOKING[pt] || 'Partner';
                            return (
                                <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface/50 border border-border">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-rose-500/10 text-rose-500 shrink-0">
                                        <User size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-text-muted uppercase font-bold">Preferred Partner</p>
                                        <p className="text-xs font-bold text-text-primary">{preferredPartner}</p>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Preferred Partner Age Range */}
                        {profile.partnerAge && (
                            <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface/50 border border-border">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/10 text-amber-500 shrink-0">
                                    <Clock size={16} />
                                </div>
                                <div>
                                    <p className="text-[10px] text-text-muted uppercase font-bold">Preferred Age</p>
                                    <p className="text-xs font-bold text-text-primary">{profile.partnerAge}</p>
                                </div>
                            </div>
                        )}

                        {/* Relationship Type */}
                        {profile.relationshipType && (
                            <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface/50 border border-border">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/10 text-blue-500 shrink-0">
                                    <Sparkles size={16} />
                                </div>
                                <div>
                                    <p className="text-[10px] text-text-muted uppercase font-bold">Relationship Type</p>
                                    <p className="text-xs font-bold text-text-primary">{profile.relationshipType}</p>
                                </div>
                            </div>
                        )}

                        {/* Age */}
                        {profile.age && (
                            <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface/50 border border-border">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-500/10 text-purple-500 shrink-0">
                                    <Calendar size={16} />
                                </div>
                                <div>
                                    <p className="text-[10px] text-text-muted uppercase font-bold">Age</p>
                                    <p className="text-xs font-bold text-text-primary">{profile.age} years old</p>
                                </div>
                            </div>
                        )}

                        {/* Location */}
                        {profile.location && (
                            <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface/50 border border-border">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-500 shrink-0">
                                    <MapPin size={16} />
                                </div>
                                <div>
                                    <p className="text-[10px] text-text-muted uppercase font-bold">Location</p>
                                    <p className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                                        <img src="https://flagcdn.com/24x18/ke.png" alt="KE" style={{ width: '14px', height: '10px', borderRadius: '1px' }} />
                                        {profile.location}, Kenya
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Valued Qualities */}
                        {profile.qualities && profile.qualities.length > 0 && (
                            <div className="p-3 rounded-2xl bg-surface/50 border border-border">
                                <p className="text-[10px] text-text-muted uppercase font-bold mb-2">Valued Qualities & Traits</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {profile.qualities.map((quality, i) => (
                                        <span key={i} className="text-[10px] font-bold px-2.5 py-1 rounded-full text-text-primary animate-pulseSoft"
                                            style={{ background: ['rgba(16,185,129,0.12)','rgba(245,158,11,0.12)','rgba(168,85,247,0.12)','rgba(99,102,241,0.12)'][i%4], border: '1px solid rgba(255,255,255,0.06)' }}>
                                            ✨ {quality}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Interests */}
                        {profile.interests && profile.interests.length > 0 && (
                            <div className="p-3 rounded-2xl bg-surface/50 border border-border">
                                <p className="text-[10px] text-text-muted uppercase font-bold mb-2">Interests & Hobbies</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {(Array.isArray(profile.interests) ? profile.interests : []).map((tag, i) => (
                                        <span key={i} className="text-[10px] font-bold px-2.5 py-1 rounded-full text-text-primary"
                                            style={{ background: ['rgba(236,72,153,0.12)','rgba(99,102,241,0.12)','rgba(16,185,129,0.12)','rgba(245,158,11,0.12)','rgba(168,85,247,0.12)'][i%5], border: '1px solid rgba(255,255,255,0.06)' }}>
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* ═══════════════ Profile Details ═══════════════ */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.22 }}
                    className="rounded-3xl p-5 space-y-4"
                    style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}
                >
                    <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                        <BarChart3 size={15} className="text-primary" />
                        Profile Details
                    </h3>

                    {/* 2x2 Grid — real data only */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Activity status */}
                        <div className="p-3 rounded-2xl bg-surface/50 border border-border flex flex-col justify-between h-24">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Activity</span>
                                <Activity size={14} style={{ color: availabilityDotColor }} />
                            </div>
                            <div>
                                <p className="text-xs font-black text-text-primary mt-1 leading-tight">{availabilityStatus}</p>
                                <p className="text-[9px] text-text-muted mt-0.5">{daysActive === 0 ? 'Today' : `${daysActive}d ago`}</p>
                            </div>
                        </div>

                        {/* Days active */}
                        <div className="p-3 rounded-2xl bg-surface/50 border border-border flex flex-col justify-between h-24">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Posted</span>
                                <Calendar size={14} className="text-primary" />
                            </div>
                            <div>
                                <p className="text-xs font-black text-text-primary mt-1 leading-tight">{daysActive === 0 ? 'Today' : `${daysActive} days ago`}</p>
                                <p className="text-[9px] text-text-muted mt-0.5">Since listing</p>
                            </div>
                        </div>

                        {/* Comment count */}
                        <div className="p-3 rounded-2xl bg-surface/50 border border-border flex flex-col justify-between h-24">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Comments</span>
                                <MessageCircle size={14} className="text-primary" />
                            </div>
                            <div>
                                <p className="text-xs font-black text-text-primary mt-1 leading-tight">{profile.commentCount || 0}</p>
                                <p className="text-[9px] text-text-muted mt-0.5">Total responses</p>
                            </div>
                        </div>

                        {/* Demand level */}
                        <div className="p-3 rounded-2xl bg-surface/50 border border-border flex flex-col justify-between h-24">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Demand</span>
                                <TrendingUp size={14} style={{ color: demandBarColor }} />
                            </div>
                            <div>
                                <p className="text-xs font-black text-text-primary mt-1 leading-tight">{demandLevel}</p>
                                <p className="text-[9px] text-text-muted mt-0.5">Interest level</p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* ═══════════════ Contact Channels ═══════════════ */}
                {!profile.isTestimonial && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.26 }}
                        className="rounded-3xl overflow-hidden shadow-md border border-border"
                        style={{ background: 'var(--color-bg-card)' }}
                    >
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-border bg-surface/30">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Lock size={12} className="text-success" />
                                <span className="text-xs font-black text-primary uppercase tracking-wider"> Facilitated Connection</span>
                            </div>
                            <p className="text-xs text-text-secondary leading-relaxed">
                                Connect safely with <span className="text-gradient font-bold">{profile.name || 'this member'}</span>. Choose a secure channel to contact our official administrator <span className="text-text-primary font-bold">Mary G</span>:
                            </p>
                        </div>

                        {/* Buttons grid */}
                        <div className="p-4 grid grid-cols-2 gap-3">
                            {/* Telegram - primary */}
                            <motion.a
                                whileHover={{ scale: 1.02, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                href={`https://t.me/GSADMINMARYGAGENCY?text=${connectionMsg}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="col-span-2 relative flex items-center justify-between p-4 rounded-2xl text-white shadow-md overflow-hidden animate-telegram-pulse"
                                style={{ background: 'linear-gradient(135deg, #24A1DE, #1480B3)' }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                                        </svg>
                                    </div>
                                    <div className="text-left">
                                        <span className="block text-sm font-extrabold leading-tight">Telegram Chat</span>
                                        <span className="text-[10px] opacity-85 leading-none">Direct matching agency</span>
                                    </div>
                                </div>
                                <span className="px-2.5 py-1 rounded-full text-[9px] font-bold bg-white/20 border border-white/30 text-white flex items-center gap-1">
                                    <Crown size={11} className="fill-white text-white shrink-0" /> Best Option
                                </span>
                            </motion.a>

                            {/* WhatsApp */}
                            <motion.a
                                whileHover={{ scale: 1.02, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                href={`https://wa.me/254738871048?text=${connectionMsg}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2.5 p-3 rounded-2xl text-white shadow-sm"
                                style={{ background: 'linear-gradient(135deg, #128C7E, #25D366)' }}
                            >
                                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                                    </svg>
                                </div>
                                <div className="text-left">
                                    <span className="block text-xs font-bold leading-tight">WhatsApp</span>
                                    <span className="text-[9px] opacity-80 leading-none">Chat Admin</span>
                                </div>
                            </motion.a>

                            {/* SMS */}
                            <motion.a
                                whileHover={{ scale: 1.02, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                href={`sms:+254738871048?body=${connectionMsg}`}
                                className="flex items-center gap-2.5 p-3 rounded-2xl text-white shadow-sm"
                                style={{ background: 'linear-gradient(135deg, #0284C7, #0EA5E9)' }}
                            >
                                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                                    <MessageSquare size={16} />
                                </div>
                                <div className="text-left">
                                    <span className="block text-xs font-bold leading-tight">SMS Text</span>
                                    <span className="text-[9px] opacity-80 leading-none">Direct text</span>
                                </div>
                            </motion.a>
                        </div>
                    </motion.div>
                )}

                {/* Testimonial disclaimer block */}
                {profile.isTestimonial && (
                    <div className="w-full rounded-2xl p-4 text-center bg-amber-500/5 border border-amber-500/10">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Star size={16} className="text-amber-500 fill-amber-500" />
                            <span className="text-sm font-bold text-text-primary">User Review / Testimonial</span>
                        </div>
                        <p className="text-xs text-text-secondary leading-snug">This post is a user success review, not a direct matchable member profile.</p>
                    </div>
                )}

                {/* ═══════════════ Real WordPress Comments ═══════════════ */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="rounded-3xl p-5 space-y-4"
                    style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}
                >
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                            <MessageCircle size={15} className="text-primary" />
                            Comments ({comments.length})
                        </h3>
                        <button onClick={() => setShowComment(true)} className="text-xs font-semibold text-primary hover:underline">
                            + Add Comment
                        </button>
                    </div>

                    {loadingComments ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex gap-3 animate-pulse">
                                    <div className="w-9 h-9 rounded-full" style={{ background: 'var(--color-surface)' }} />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-3 w-24 rounded" style={{ background: 'var(--color-surface)' }} />
                                        <div className="h-3 w-full rounded" style={{ background: 'var(--color-surface)' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : comments.length === 0 ? (
                        <div className="text-center py-8 px-4 rounded-2xl border border-border bg-surface/30">
                            <MessageCircle size={32} className="text-text-muted mx-auto mb-2" />
                            <p className="text-sm font-bold text-text-primary">No comments yet</p>
                            <p className="text-xs text-text-secondary mt-1">Be the first to comment and start a connection!</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {comments.map(comment => (
                                <div key={comment.id} className="flex gap-3 py-3 border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                                    <UserAvatar name={comment.author} src={comment.avatarUrl} size={36} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold text-text-primary">{comment.author}</span>
                                            <span className="text-[10px] text-text-muted">
                                                {formatCommentDate(comment.date)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-text-secondary leading-relaxed">{comment.content}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>

                {/* Leave Comment CTA */}
                <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowComment(true)}
                    className="w-full py-3.5 rounded-2xl text-sm font-semibold text-text-secondary transition-colors flex items-center justify-center gap-2"
                    style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}
                >
                    <MessageCircle size={16} /> Leave a Comment on this Profile
                </motion.button>

                {/* Version */}
                <p className="text-center text-[10px] text-text-muted pt-2 pb-4">
                    Genuine Sugar Mummies App · v4.1.0
                </p>
            </div>

            {showComment && (
                <CommentForm profile={{ wpId: profile.wpId, name: profile.name, imageUrl: profile.imageUrl }} onClose={handleCommentClose} />
            )}
        </div>
    );
}
