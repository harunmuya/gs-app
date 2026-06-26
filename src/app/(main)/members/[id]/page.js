'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    ArrowLeft, MessageCircle, Phone, Video, MapPin, Calendar, Heart,
    Clock, Shield, Crown, Star, Sparkles, Eye, Lock, ChevronRight, User,
    Maximize2, Target, Globe
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import UserAvatar from '@/components/UserAvatar';
import VerifiedBadge from '@/components/VerifiedBadge';
import ImageLightbox from '@/components/ImageLightbox';

export default function MemberProfilePage() {
    const params = useParams();
    const router = useRouter();
    const memberId = params.id;
    const { user, getOrCreateDM, canUseFeature, subscription } = useAuth();

    const [member, setMember] = useState(null);
    const [loading, setLoading] = useState(true);
    const [startingChat, setStartingChat] = useState(false);
    const [revealedPhone, setRevealedPhone] = useState('');
    const [revealingPhone, setRevealingPhone] = useState(false);

    // ═══ IMAGE LIGHTBOX ═══
    const [lightboxImage, setLightboxImage] = useState(null);
    const [lightboxAlt, setLightboxAlt] = useState('');

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch(`/api/members?userId=${user?.id || ''}`);
                const json = await res.json();
                const found = (json.members || []).find(m => m.id === memberId);
                setMember(found || null);
            } catch { }
            setLoading(false);
        };
        load();
    }, [memberId, user?.id]);

    const handleMessage = async () => {
        if (!member) return;
        setStartingChat(true);
        const conv = await getOrCreateDM(member.id);
        if (conv) {
            router.push(`/members/chat/${conv.id}?name=${encodeURIComponent(member.display_name || 'User')}&avatar=${encodeURIComponent(member.avatar_url || '')}&otherId=${member.id}`);
        }
        setStartingChat(false);
    };

    const handleRevealPhone = async () => {
        if (!member?.id || !user?.id) return;
        if (!canUseFeature('revealPhone')) {
            router.push('/subscribe');
            return;
        }
        if (revealedPhone) return;
        setRevealingPhone(true);
        try {
            const res = await fetch(`/api/members/reveal?userId=${encodeURIComponent(user.id)}&memberId=${encodeURIComponent(member.id)}`);
            const data = await res.json();
            if (data.upgradeRequired) {
                router.push('/subscribe');
                return;
            }
            if (!res.ok) throw new Error(data.error || 'Could not reveal phone');
            setRevealedPhone(data.phone);
        } catch (err) {
            alert(err.message || 'Phone number is not available');
        } finally {
            setRevealingPhone(false);
        }
    };

    const timeAgo = (date) => {
        if (!date) return 'Recently';
        const diff = (Date.now() - new Date(date).getTime()) / 1000;
        if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)} days ago`;
    };

    const openLightbox = (src, alt = '') => {
        setLightboxImage(src);
        setLightboxAlt(alt);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
                <img src="/gs.png" alt="Loading" className="w-16 h-16 object-contain animate-pulse-zoom" />
            </div>
        );
    }

    if (!member) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4 px-6 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'var(--color-surface)' }}>
                    <User size={28} className="text-text-muted" />
                </div>
                <h2 className="text-lg font-bold text-text-primary">Member not found</h2>
                <button onClick={() => router.back()} className="flex items-center gap-2 px-6 py-3 rounded-2xl gradient-primary text-white font-semibold">
                    <ArrowLeft size={16} /> Go Back
                </button>
            </div>
        );
    }

    const hobbies = Array.isArray(member.hobbies) ? member.hobbies : [];
    const interests = Array.isArray(member.interests) ? member.interests : [];
    const allTags = [...new Set([...hobbies, ...interests])];
    const plan = subscription?.plan || 'free';
    const memberImages = Array.isArray(member.images) ? member.images.filter(Boolean) : [];

    return (
        <div className="pb-6">
            {/* ═══ IMAGE LIGHTBOX ═══ */}
            <ImageLightbox
                src={lightboxImage}
                alt={lightboxAlt}
                isOpen={!!lightboxImage}
                onClose={() => { setLightboxImage(null); setLightboxAlt(''); }}
            />

            {/* Hero Image — CLICKABLE for full-screen */}
            <div className="relative h-[55vh] min-h-[340px]">
                {member.avatar_url ? (
                    <img
                        src={member.avatar_url}
                        alt=""
                        className="w-full h-full object-cover cursor-pointer"
                        referrerPolicy="no-referrer"
                        style={{ imageRendering: 'auto' }}
                        onClick={() => openLightbox(member.avatar_url, member.display_name)}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--color-surface), var(--color-bg))' }}>
                        <UserAvatar name={member.display_name} size={120} />
                    </div>
                )}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 40%, transparent 70%)' }} />

                {/* Back button */}
                <button onClick={() => router.back()}
                    className="absolute top-[max(env(safe-area-inset-top,12px),12px)] left-4 p-2.5 rounded-full"
                    style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)' }}>
                    <ArrowLeft size={20} className="text-white" />
                </button>

                {/* View full image button */}
                {member.avatar_url && (
                    <button
                        onClick={() => openLightbox(member.avatar_url, member.display_name)}
                        className="absolute top-[max(env(safe-area-inset-top,12px),12px)] right-4 p-2.5 rounded-full"
                        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)' }}>
                        <Maximize2 size={18} className="text-white" />
                    </button>
                )}

                {/* Info overlay */}
                <div className="absolute bottom-6 left-5 right-5">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h1 className="text-2xl font-extrabold text-white">{member.display_name || 'Member'}</h1>
                        {member.verification_status === 'verified' && <VerifiedBadge size={20} verified={true} />}
                        {member.subscription_plan && member.subscription_plan !== 'free' && (
                            <VerifiedBadge size={20} badgeText={member.subscription_plan} />
                        )}
                        {member.age && <span className="text-lg text-white/70">{member.age}</span>}
                        {member.is_online && (
                            <span className="w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-black/30" />
                        )}
                    </div>
                    {member.location && (
                        <div className="flex items-center gap-1.5 mt-1">
                            <MapPin size={14} className="text-white/60" />
                            <span className="text-sm text-white/70">{member.location}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                        <Clock size={12} className="text-white/50" />
                        <span className="text-xs text-white/50">Joined {new Date(member.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 px-4 -mt-5 relative z-10">
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleMessage}
                    disabled={startingChat}
                    className="flex-1 flex items-center justify-center gap-2.5 py-4 rounded-2xl font-bold text-white text-sm shadow-xl disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #06B6D4, #10B981)', boxShadow: '0 8px 25px rgba(6,182,212,0.35)' }}
                >
                    <MessageCircle size={20} />
                    {startingChat ? 'Opening...' : 'Message'}
                </motion.button>
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                        if (!canUseFeature('voiceCall')) { router.push('/subscribe'); return; }
                        alert('Voice call coming soon');
                    }}
                    className="w-[60px] h-[56px] rounded-2xl flex items-center justify-center shadow-xl relative"
                    style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', boxShadow: '0 8px 25px rgba(99,102,241,0.35)' }}
                >
                    <Phone size={22} className="text-white" />
                    {!canUseFeature('voiceCall') && <Lock size={10} className="absolute top-2 right-2 text-white/60" />}
                </motion.button>
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                        if (!canUseFeature('videoCall')) { router.push('/subscribe'); return; }
                        alert('Video call coming soon');
                    }}
                    className="w-[60px] h-[56px] rounded-2xl flex items-center justify-center shadow-xl relative"
                    style={{ background: 'linear-gradient(135deg, #EC4899, #F43F5E)', boxShadow: '0 8px 25px rgba(236,72,153,0.35)' }}
                >
                    <Video size={22} className="text-white" />
                    {!canUseFeature('videoCall') && <Lock size={10} className="absolute top-2 right-2 text-white/60" />}
                </motion.button>
            </div>

            {member.phone_masked && (
                <div className="px-4 mt-4">
                    <div className="rounded-2xl p-3 flex items-center justify-between gap-3" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <Phone size={14} className="text-amber-500" />
                                <span className="text-xs font-bold text-text-primary">Phone Number</span>
                            </div>
                            <p className="font-mono text-sm text-text-secondary tracking-wider truncate">{revealedPhone || member.phone_masked}</p>
                        </div>
                        <button
                            onClick={handleRevealPhone}
                            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-[10px] font-bold"
                            style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)' }}
                        >
                            {revealedPhone ? <Phone size={11} /> : <Lock size={11} />}
                            {revealedPhone ? 'Unlocked' : revealingPhone ? 'Revealing...' : 'View Number'}
                        </button>
                    </div>
                </div>
            )}

            <div className="px-4 mt-5 space-y-4">
                {/* ═══ PHOTO GALLERY ═══ */}
                {memberImages.length > 0 && (
                    <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                        <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Photos</h3>
                        <div className="grid grid-cols-3 gap-2">
                            {memberImages.map((img, i) => (
                                <button key={i} onClick={() => openLightbox(img, `${member.display_name} photo ${i + 1}`)}
                                    className="aspect-square rounded-xl overflow-hidden relative group">
                                    <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        style={{ background: 'rgba(0,0,0,0.3)' }}>
                                        <Maximize2 size={18} className="text-white" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Bio */}
                {member.bio && (
                    <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                        <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">About</h3>
                        <p className="text-sm text-text-secondary leading-relaxed">{member.bio}</p>
                    </div>
                )}

                {/* Hobbies & Interests */}
                {allTags.length > 0 && (
                    <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                        <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Hobbies & Interests</h3>
                        <div className="flex flex-wrap gap-2">
                            {allTags.map((tag, i) => (
                                <span key={i} className="px-3 py-1.5 rounded-full text-xs font-semibold"
                                    style={{
                                        background: `linear-gradient(135deg, ${['rgba(255,90,95,0.12)', 'rgba(99,102,241,0.12)', 'rgba(6,182,212,0.12)', 'rgba(236,72,153,0.12)', 'rgba(245,158,11,0.12)'][i % 5]}, ${['rgba(255,42,109,0.12)', 'rgba(139,92,246,0.12)', 'rgba(16,185,129,0.12)', 'rgba(244,63,94,0.12)', 'rgba(239,68,68,0.12)'][i % 5]})`,
                                        color: ['#FF5A5F', '#6366F1', '#06B6D4', '#EC4899', '#F59E0B'][i % 5],
                                    }}>
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* ═══ ENHANCED DETAILS ═══ */}
                <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                    <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider px-4 pt-4 pb-2">Details</h3>
                    {member.gender && (
                        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <User size={16} className="text-primary" />
                            <span className="text-sm text-text-secondary flex-1">Gender</span>
                            <span className="text-sm font-semibold text-text-primary capitalize">{member.gender}</span>
                        </div>
                    )}
                    {member.age && (
                        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <Calendar size={16} className="text-primary" />
                            <span className="text-sm text-text-secondary flex-1">Age</span>
                            <span className="text-sm font-semibold text-text-primary">{member.age} years</span>
                        </div>
                    )}
                    {member.looking_for && (
                        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <Heart size={16} className="text-primary" />
                            <span className="text-sm text-text-secondary flex-1">Looking for</span>
                            <span className="text-sm font-semibold text-text-primary capitalize">{member.looking_for.replace(/_/g, ' ')}</span>
                        </div>
                    )}
                    {member.location && (
                        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <MapPin size={16} className="text-primary" />
                            <span className="text-sm text-text-secondary flex-1">Location</span>
                            <span className="text-sm font-semibold text-text-primary">{member.location}</span>
                        </div>
                    )}
                    {member.country && member.country !== 'Kenya' && (
                        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <Globe size={16} className="text-primary" />
                            <span className="text-sm text-text-secondary flex-1">Country</span>
                            <span className="text-sm font-semibold text-text-primary">{member.country}</span>
                        </div>
                    )}
                    {member.created_at && (
                        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <Clock size={16} className="text-primary" />
                            <span className="text-sm text-text-secondary flex-1">Joined</span>
                            <span className="text-sm font-semibold text-text-primary">{new Date(member.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                    )}
                    {member.last_seen_at && !member.is_online && (
                        <div className="flex items-center gap-3 px-4 py-3">
                            <Eye size={16} className="text-primary" />
                            <span className="text-sm text-text-secondary flex-1">Last active</span>
                            <span className="text-sm font-semibold text-text-primary">{timeAgo(member.last_seen_at)}</span>
                        </div>
                    )}
                    {member.is_online && (
                        <div className="flex items-center gap-3 px-4 py-3">
                            <div className="w-4 h-4 flex items-center justify-center">
                                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                            </div>
                            <span className="text-sm text-text-secondary flex-1">Status</span>
                            <span className="text-sm font-semibold text-emerald-500">Online Now</span>
                        </div>
                    )}
                </div>

                {/* Upgrade CTA for free users */}
                {(!subscription || subscription.plan === 'free') && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl p-4 text-center"
                        style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(236,72,153,0.08))', border: '1px solid rgba(99,102,241,0.2)' }}
                    >
                        <Crown size={24} className="text-amber-500 mx-auto mb-2" />
                        <p className="text-sm font-bold text-text-primary mb-1">Upgrade for unlimited access</p>
                        <p className="text-xs text-text-muted mb-3">Voice calls, video calls, unlimited messages</p>
                        <button onClick={() => router.push('/subscribe')}
                            className="px-6 py-2.5 rounded-2xl font-bold text-white text-sm"
                            style={{ background: 'linear-gradient(135deg, #6366F1, #EC4899)' }}>
                            <Crown size={14} className="inline mr-1.5" /> View Plans
                        </button>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
