'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Plus, Search, MapPin, Zap, Crown, MessageCircle, Phone, Video,
    Heart, Eye, X, ChevronRight, Send, Clock, ExternalLink, Flame,
    Smile, ThumbsUp, Sparkles, AlertCircle, Lock, Image as ImageIcon, Camera,
    Calendar, User, Target, Maximize2, UserPlus, UserCheck, Globe, Shield
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import UserAvatar from '@/components/UserAvatar';
import VerifiedBadge from '@/components/VerifiedBadge';
import ImageLightbox from '@/components/ImageLightbox';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const STATUS_COLORS = [
    'linear-gradient(135deg, #FF5A5F, #FF2A6D)',
    'linear-gradient(135deg, #6366F1, #8B5CF6)',
    'linear-gradient(135deg, #06B6D4, #10B981)',
    'linear-gradient(135deg, #F59E0B, #EF4444)',
    'linear-gradient(135deg, #EC4899, #8B5CF6)',
    'linear-gradient(135deg, #14B8A6, #3B82F6)',
];

const REACTIONS = [
    { emoji: '❤️', key: 'love' },
    { emoji: '🔥', key: 'fire' },
    { emoji: '😂', key: 'laugh' },
    { emoji: '😢', key: 'sad' },
    { emoji: '👍', key: 'like' },
];

export default function MembersPage() {
    const router = useRouter();
    const {
        user, subscription, fetchMembers, fetchStatuses, postStatus, deleteStatus,
        viewStatus, reactToStatus, getOrCreateDM, canUseFeature, memberStatuses
    } = useAuth();

    const [members, setMembers] = useState([]);
    const [statuses, setStatuses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showStatusComposer, setShowStatusComposer] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [statusColor, setStatusColor] = useState(STATUS_COLORS[0]);
    const [statusImage, setStatusImage] = useState(null);
    const [statusImagePreview, setStatusImagePreview] = useState(null);
    const [statusMode, setStatusMode] = useState('text'); // 'text' or 'image'
    const [selectedMember, setSelectedMember] = useState(null);
    const [viewingStatus, setViewingStatus] = useState(null);
    const [statusIndex, setStatusIndex] = useState(0);
    const [statusProgress, setStatusProgress] = useState(0);
    const statusTimerRef = useRef(null);
    const imageInputRef = useRef(null);
    const [postingStatus, setPostingStatus] = useState(false);
    const [startingChat, setStartingChat] = useState(null);
    const [followingSet, setFollowingSet] = useState(new Set());
    const [followLoading, setFollowLoading] = useState(null);
    const [revealedPhones, setRevealedPhones] = useState({});
    const [revealingPhone, setRevealingPhone] = useState(null);

    // ═══ IMAGE LIGHTBOX STATE ═══
    const [lightboxImage, setLightboxImage] = useState(null);
    const [lightboxAlt, setLightboxAlt] = useState('');

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            const [m, s] = await Promise.all([fetchMembers(), fetchStatuses()]);
            if (mounted) {
                setMembers(m);
                setStatuses(s);
                // Build initial following set from API data
                const fSet = new Set(m.filter(x => x.is_followed_by_user).map(x => x.id));
                setFollowingSet(fSet);
                setLoading(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, [fetchMembers, fetchStatuses]);

    // Status auto-advance
    useEffect(() => {
        if (!viewingStatus) return;
        setStatusProgress(0);
        const start = Date.now();
        const duration = 5000;
        const tick = () => {
            const elapsed = Date.now() - start;
            setStatusProgress(Math.min(100, (elapsed / duration) * 100));
            if (elapsed < duration) {
                statusTimerRef.current = requestAnimationFrame(tick);
            } else {
                handleNextStatus();
            }
        };
        statusTimerRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(statusTimerRef.current);
    }, [viewingStatus, statusIndex]);

    const statusesByUser = statuses.reduce((acc, s) => {
        if (!acc[s.user_id]) acc[s.user_id] = [];
        acc[s.user_id].push(s);
        return acc;
    }, {});

    const statusUsers = Object.keys(statusesByUser).map(userId => ({
        userId,
        statuses: statusesByUser[userId],
        user: statusesByUser[userId][0]?.users || {},
    }));

    const myStatuses = statuses.filter(s => s.user_id === user?.id);

    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            setStatusImagePreview(ev.target.result);
            setStatusImage(file);
            setStatusMode('image');
        };
        reader.readAsDataURL(file);
    };

    const handlePostStatus = async () => {
        if ((!statusText.trim() && !statusImage) || postingStatus) return;
        setPostingStatus(true);

        let mediaUrl = null;
        if (statusImage && statusImagePreview) {
            // Use base64 as URL for now (small images)
            mediaUrl = statusImagePreview;
        }

        await postStatus(
            statusText.trim() || '',
            mediaUrl,
            statusImage ? 'image' : 'text',
            statusColor
        );
        setStatusText('');
        setStatusImage(null);
        setStatusImagePreview(null);
        setStatusMode('text');
        setShowStatusComposer(false);
        setPostingStatus(false);
        const s = await fetchStatuses();
        setStatuses(s);
    };

    const openStatusViewer = (userStatuses, index = 0) => {
        setViewingStatus(userStatuses);
        setStatusIndex(index);
        if (userStatuses[index]) viewStatus(userStatuses[index].id);
    };

    const handleNextStatus = () => {
        if (!viewingStatus) return;
        if (statusIndex < viewingStatus.length - 1) {
            const next = statusIndex + 1;
            setStatusIndex(next);
            viewStatus(viewingStatus[next].id);
        } else {
            setViewingStatus(null);
            setStatusIndex(0);
        }
    };

    const handlePrevStatus = () => {
        if (statusIndex > 0) {
            const prev = statusIndex - 1;
            setStatusIndex(prev);
            viewStatus(viewingStatus[prev].id);
        }
    };

    const handleMessageMember = async (member) => {
        setStartingChat(member.id);
        const conv = await getOrCreateDM(member.id);
        if (conv) {
            router.push(`/members/chat/${conv.id}?name=${encodeURIComponent(member.display_name || 'User')}&avatar=${encodeURIComponent(member.avatar_url || '')}&otherId=${member.id}`);
        }
        setStartingChat(null);
        setSelectedMember(null);
    };

    const handleRevealPhone = async (member) => {
        if (!member?.id || !user?.id) return;
        if (!canUseFeature('revealPhone')) {
            router.push('/subscribe');
            return;
        }
        if (revealedPhones[member.id]) return;
        setRevealingPhone(member.id);
        try {
            const res = await fetch(`/api/members/reveal?userId=${encodeURIComponent(user.id)}&memberId=${encodeURIComponent(member.id)}`);
            const data = await res.json();
            if (data.upgradeRequired) {
                router.push('/subscribe');
                return;
            }
            if (!res.ok) throw new Error(data.error || 'Could not reveal phone');
            setRevealedPhones(prev => ({ ...prev, [member.id]: data.phone }));
        } catch (err) {
            alert(err.message || 'Phone number is not available');
        } finally {
            setRevealingPhone(null);
        }
    };

    const filteredMembers = members.filter(m => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (m.display_name || '').toLowerCase().includes(q) || (m.location || '').toLowerCase().includes(q);
    });

    const getAvatar = (m) => m?.avatar_url || null;

    const getProfileTypeLabel = (m) => {
        // Only show auto-labels on SEED profiles
        // Manual users must choose their own label (stored as profile_type)
        if (m.is_seed) {
            if (m.profile_type && m.profile_type !== 'member') {
                const labels = { sugar_mummy: 'Sugar Mummy', sugar_daddy: 'Sugar Daddy', toyboy: 'Toyboy', sugar_guy: 'Sugar Guy', young_lady: 'Young Lady', mistress: 'Mistress', cougar: 'Cougar' };
                return labels[m.profile_type] || (m.gender === 'female' ? 'Sugar Mummy' : 'Sugar Daddy');
            }
            if (m.gender === 'female') return 'Sugar Mummy';
            if (m.gender === 'male') return 'Sugar Daddy';
        }
        // For manual users, only show if they explicitly chose a label
        if (m.profile_type && m.profile_type !== 'member') {
            const labels = { sugar_mummy: 'Sugar Mummy', sugar_daddy: 'Sugar Daddy', toyboy: 'Toyboy', sugar_guy: 'Sugar Guy', young_lady: 'Young Lady', mistress: 'Mistress', cougar: 'Cougar' };
            return labels[m.profile_type] || null;
        }
        return null;
    };

    // Full identity text: "I am a Toyboy looking for a Sugar Mummy"
    const getLookingForText = (m) => {
        const label = getProfileTypeLabel(m);
        if (!label) return null;
        const lookingMap = {
            'Sugar Mummy': 'Toyboy / Sugar Guy',
            'Sugar Daddy': 'Young Lady / Mistress',
            'Toyboy': 'Sugar Mummy',
            'Sugar Guy': 'Sugar Mummy',
            'Young Lady': 'Sugar Daddy',
            'Mistress': 'Sugar Daddy',
            'Cougar': 'Toyboy / Sugar Guy',
        };
        return lookingMap[label] ? `${label} looking for ${lookingMap[label]}` : label;
    };

    const getProfileTypeColor = (m) => {
        const t = getProfileTypeLabel(m);
        if (t === 'Sugar Mummy') return 'linear-gradient(135deg, #EC4899, #F43F5E)';
        if (t === 'Sugar Daddy') return 'linear-gradient(135deg, #3B82F6, #6366F1)';
        if (t === 'Toyboy') return 'linear-gradient(135deg, #F59E0B, #EF4444)';
        if (t === 'Sugar Guy') return 'linear-gradient(135deg, #10B981, #14B8A6)';
        if (t === 'Sugar Girl') return 'linear-gradient(135deg, #A855F7, #EC4899)';
        if (t === 'Young Lady') return 'linear-gradient(135deg, #A855F7, #EC4899)';
        if (t === 'Mistress') return 'linear-gradient(135deg, #D946EF, #9333EA)';
        if (t === 'Cougar') return 'linear-gradient(135deg, #EF4444, #DC2626)';
        return 'var(--color-surface)';
    };

    // Real flag images from flagcdn.com (works on all devices incl Windows)
    const COUNTRY_FLAGS = {
        Kenya: 'https://flagcdn.com/24x18/ke.png',
        Uganda: 'https://flagcdn.com/24x18/ug.png',
        Tanzania: 'https://flagcdn.com/24x18/tz.png',
        Zimbabwe: 'https://flagcdn.com/24x18/zw.png',
        Malawi: 'https://flagcdn.com/24x18/mw.png',
        Rwanda: 'https://flagcdn.com/24x18/rw.png',
        Burundi: 'https://flagcdn.com/24x18/bi.png',
        'South Sudan': 'https://flagcdn.com/24x18/ss.png',
        Ethiopia: 'https://flagcdn.com/24x18/et.png',
    };

    const handleFollow = async (e, memberId) => {
        e.stopPropagation();
        if (!user?.id || followLoading) return;
        setFollowLoading(memberId);
        const isFollowing = followingSet.has(memberId);
        try {
            if (isFollowing) {
                await fetch(`/api/follows?followerId=${user.id}&followingId=${memberId}`, { method: 'DELETE' });
                setFollowingSet(prev => { const n = new Set(prev); n.delete(memberId); return n; });
                setMembers(prev => prev.map(m => m.id === memberId ? { ...m, followers_count: Math.max(0, (m.followers_count || 0) - 1) } : m));
            } else {
                await fetch('/api/follows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ followerId: user.id, followingId: memberId }) });
                setFollowingSet(prev => new Set(prev).add(memberId));
                setMembers(prev => prev.map(m => m.id === memberId ? { ...m, followers_count: (m.followers_count || 0) + 1 } : m));
            }
        } catch { }
        setFollowLoading(null);
    };

    const timeAgo = (date) => {
        if (!date) return '';
        const diff = (Date.now() - new Date(date).getTime()) / 1000;
        if (diff < 60) return 'now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
        return `${Math.floor(diff / 86400)}d`;
    };

    const joinDate = (date) => {
        if (!date) return '';
        const d = new Date(date);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays < 1) return 'Joined today';
        if (diffDays < 7) return `Joined ${diffDays}d ago`;
        if (diffDays < 30) return `Joined ${Math.floor(diffDays / 7)}w ago`;
        if (diffDays < 365) return `Joined ${d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
        return `Joined ${d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    };

    // Open image in full-screen lightbox
    const openLightbox = (src, alt = '') => {
        setLightboxImage(src);
        setLightboxAlt(alt);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
                <img src="/gs.png" alt="Loading" className="w-16 h-16 object-contain animate-pulse-zoom" />
                <p className="text-sm text-text-muted">Loading members...</p>
            </div>
        );
    }

    return (
        <div className="px-3 pt-1 pb-4 space-y-4">
            {/* ═══ IMAGE LIGHTBOX ═══ */}
            <ImageLightbox
                src={lightboxImage}
                alt={lightboxAlt}
                isOpen={!!lightboxImage}
                onClose={() => { setLightboxImage(null); setLightboxAlt(''); }}
            />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Users size={20} className="text-primary" />
                    <h1 className="text-lg font-bold text-text-primary">Members</h1>
                    <span className="text-[10px] text-white font-bold px-2 py-0.5 rounded-full" style={{ background: 'linear-gradient(135deg, #10B981, #06B6D4)' }}>
                        {members.length}
                    </span>
                </div>
            </div>

            {/* ═══════════ STATUS BAR ═══════════ */}
            <div className="overflow-x-auto scrollbar-none -mx-3 px-3">
                <div className="flex items-center gap-3 pb-1" style={{ minWidth: 'max-content' }}>
                    {/* Add Status */}
                    <button onClick={() => setShowStatusComposer(true)} className="flex flex-col items-center gap-1 shrink-0">
                        <div className="relative">
                            <div className="w-[68px] h-[68px] rounded-full overflow-hidden ring-2 ring-border" style={{ background: 'var(--color-surface)' }}>
                                {getAvatar(user) ? (
                                    <img src={getAvatar(user)} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                    <UserAvatar name={user?.display_name} size={68} />
                                )}
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full flex items-center justify-center ring-2 ring-bg"
                                style={{ background: 'linear-gradient(135deg, #FF5A5F, #FF2A6D)' }}>
                                <Plus size={14} className="text-white" />
                            </div>
                        </div>
                        <span className="text-[10px] text-text-muted font-medium">Your story</span>
                    </button>

                    {/* Other users' statuses */}
                    {statusUsers.filter(su => su.userId !== user?.id).map(su => (
                        <button key={su.userId} onClick={() => openStatusViewer(su.statuses)} className="flex flex-col items-center gap-1 shrink-0">
                            <div className="w-[68px] h-[68px] rounded-full overflow-hidden p-[3px]" style={{ background: 'linear-gradient(135deg, #FF5A5F, #8B5CF6, #06B6D4)' }}>
                                <div className="w-full h-full rounded-full overflow-hidden ring-2 ring-bg">
                                    {getAvatar(su.user) ? (
                                        <img src={getAvatar(su.user)} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                        <UserAvatar name={su.user?.display_name} size={62} />
                                    )}
                                </div>
                            </div>
                            <span className="text-[10px] text-text-muted font-medium truncate max-w-[64px]">
                                {su.user?.display_name?.split(' ')[0] || 'User'}
                            </span>
                        </button>
                    ))}

                    {myStatuses.length > 0 && (
                        <button onClick={() => openStatusViewer(myStatuses)} className="flex flex-col items-center gap-1 shrink-0">
                            <div className="w-[68px] h-[68px] rounded-full overflow-hidden p-[3px]" style={{ background: 'linear-gradient(135deg, #10B981, #06B6D4)' }}>
                                <div className="w-full h-full rounded-full overflow-hidden ring-2 ring-bg flex items-center justify-center" style={{ background: 'var(--color-surface)' }}>
                                    <Eye size={22} className="text-text-muted" />
                                </div>
                            </div>
                            <span className="text-[10px] text-text-muted font-medium">My status</span>
                        </button>
                    )}
                </div>
            </div>

            {/* ═══════════ GS AI MINI CARD ═══════════ */}
            <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                    const url = `https://gs-ai-ten.vercel.app/${user ? `?email=${encodeURIComponent(user.email)}&name=${encodeURIComponent(user.display_name)}` : ''}`;
                    if (window.median?.browser) {
                        window.median.browser.open({ url });
                    } else {
                        window.open(url, '_blank');
                    }
                }}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl transition-all"
                style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08))', border: '1px solid rgba(99,102,241,0.15)' }}
            >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                    <Zap size={22} className="text-white" />
                </div>
                <div className="flex-1 text-left">
                    <p className="text-sm font-bold text-text-primary">GS AI Assistant</p>
                    <p className="text-[10px] text-text-muted">Ask questions, get dating advice</p>
                </div>
                <div className="p-2 rounded-xl" style={{ background: 'rgba(99,102,241,0.1)' }}>
                    <ExternalLink size={16} style={{ color: '#6366F1' }} />
                </div>
            </motion.button>

            {/* ═══════════ SEARCH ═══════════ */}
            <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                    type="text"
                    placeholder="Search members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full py-3 pl-10 pr-4 rounded-2xl text-sm text-text-primary placeholder:text-text-muted outline-none transition-all focus:ring-2 focus:ring-primary/30"
                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                />
            </div>

            {/* ═══════════ MEMBERS GRID ═══════════ */}
            {filteredMembers.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ background: 'var(--color-surface)' }}>
                        <Users size={28} className="text-text-muted" />
                    </div>
                    <p className="text-sm text-text-muted">No members found</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    {filteredMembers.map(member => {
                        const memberHobbies = Array.isArray(member.hobbies) ? member.hobbies.slice(0, 2) : [];
                        return (
                            <motion.button
                                key={member.id}
                                whileTap={{ scale: 0.96 }}
                                onClick={() => setSelectedMember(member)}
                                className="relative rounded-2xl overflow-hidden text-left shadow-lg"
                                style={{ aspectRatio: '3/4', border: 'var(--card-border)' }}
                            >
                                {/* Photo with high quality — clickable for lightbox */}
                                <div className="absolute inset-0">
                                    {getAvatar(member) ? (
                                        <img
                                            src={getAvatar(member)}
                                            alt=""
                                            className="w-full h-full object-cover"
                                            referrerPolicy="no-referrer"
                                            loading="lazy"
                                            style={{ imageRendering: 'auto' }}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--color-surface), var(--color-bg))' }}>
                                            <UserAvatar name={member.display_name} size={64} />
                                        </div>
                                    )}
                                </div>

                                {/* Expand icon for photos */}
                                {getAvatar(member) && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); openLightbox(getAvatar(member), member.display_name); }}
                                        className="absolute top-2.5 left-2.5 p-1.5 rounded-full z-10"
                                        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
                                    >
                                        <Maximize2 size={12} className="text-white" />
                                    </button>
                                )}

                                {/* Gradient overlay — deeper for more text contrast */}
                                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.45) 35%, rgba(0,0,0,0.08) 65%, transparent 100%)' }} />

                                {/* Online indicator */}
                                {member.is_online && (
                                    <div className="absolute top-3 right-3 z-10">
                                        <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 ring-2 ring-black/50 animate-pulse" />
                                    </div>
                                )}

                                {/* Profile Type Badge — prominent */}
                                {getProfileTypeLabel(member) && (
                                    <div className="absolute z-10" style={{ top: '8px', right: member.is_online ? '28px' : '8px' }}>
                                        <span className="text-[9px] font-extrabold px-2.5 py-1 rounded-full text-white shadow-xl tracking-wide"
                                            style={{ background: getProfileTypeColor(member), boxShadow: '0 4px 15px rgba(0,0,0,0.4)' }}>
                                            {getProfileTypeLabel(member)}
                                        </span>
                                    </div>
                                )}

                                {/* Follow Button — colorful */}
                                {user?.id && user.id !== member.id && (
                                    <button
                                        onClick={(e) => handleFollow(e, member.id)}
                                        className="absolute top-2.5 left-10 z-10 p-1.5 rounded-full transition-all shadow-lg"
                                        style={{
                                            background: followingSet.has(member.id)
                                                ? 'linear-gradient(135deg, #10B981, #059669)'
                                                : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                                            boxShadow: followingSet.has(member.id) ? '0 3px 12px rgba(16,185,129,0.5)' : '0 3px 12px rgba(99,102,241,0.5)'
                                        }}
                                    >
                                        {followingSet.has(member.id) ? <UserCheck size={12} className="text-white" /> : <UserPlus size={12} className="text-white" />}
                                    </button>
                                )}

                                {/* ═══ CARD INFO ═══ */}
                                <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1">
                                    {/* Name + Badges */}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <h3 className="text-sm font-extrabold text-white truncate">{member.display_name?.split(' ')[0] || 'User'}</h3>
                                        {member.verification_status === 'verified' && <VerifiedBadge size={14} verified={true} />}
                                        {member.subscription_plan && member.subscription_plan !== 'free' && (
                                            <VerifiedBadge size={14} badgeText={member.subscription_plan} />
                                        )}
                                        {member.age && <span className="text-xs text-white/80 font-bold">{member.age}</span>}
                                    </div>

                                    {/* Country Flag + Location */}
                                    <div className="flex items-center gap-1.5">
                                        {member.country && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md text-white flex items-center gap-1"
                                                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.1))' }}>
                                                {COUNTRY_FLAGS[member.country] && (
                                                    <img src={COUNTRY_FLAGS[member.country]} alt="" className="inline-block" style={{ width: '16px', height: '12px', borderRadius: '2px', objectFit: 'cover' }} />
                                                )}
                                                {member.country}
                                            </span>
                                        )}
                                        {member.location && (
                                            <span className="text-[9px] text-white/70 truncate flex items-center gap-0.5">
                                                <MapPin size={8} className="text-white/50 shrink-0" />
                                                {member.location}
                                            </span>
                                        )}
                                    </div>

                                    {/* 📞 BLURRED PHONE NUMBER — prominent */}
                                    {member.phone_masked && (
                                        <div className="flex items-center gap-1.5 py-1 px-2 rounded-lg mt-0.5"
                                            style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(239,68,68,0.15))', border: '1px solid rgba(245,158,11,0.3)' }}>
                                            <Phone size={10} style={{ color: '#FBBF24' }} />
                                            <span className="text-[10px] text-amber-300 font-mono font-bold tracking-wider">{member.phone_masked}</span>
                                            <Lock size={9} style={{ color: '#F59E0B' }} />
                                        </div>
                                    )}

                                    {/* Followers + Joined — compact row */}
                                    <div className="flex items-center gap-2 pt-0.5">
                                        {(member.followers_count > 0) && (
                                            <span className="text-[8px] text-white/50 flex items-center gap-0.5">
                                                <Heart size={7} className="text-pink-400/60" /> {member.followers_count}
                                            </span>
                                        )}
                                        {member.created_at && (
                                            <span className="text-[8px] text-white/40 flex items-center gap-0.5">
                                                <Clock size={7} /> {joinDate(member.created_at)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </motion.button>
                        );
                    })}
                </div>
            )}

            {/* ═══════════ STATUS COMPOSER MODAL ═══════════ */}
            <AnimatePresence>
                {showStatusComposer && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                        style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
                            style={{ background: 'var(--color-bg-card)' }}
                        >
                            {/* Mode toggle */}
                            <div className="flex items-center gap-1 p-3">
                                <button onClick={() => { setStatusMode('text'); setStatusImage(null); setStatusImagePreview(null); }}
                                    className={`flex-1 py-2 rounded-xl text-xs font-bold text-center transition-all ${statusMode === 'text' ? 'text-white' : 'text-text-muted'}`}
                                    style={statusMode === 'text' ? { background: 'linear-gradient(135deg, #FF5A5F, #FF2A6D)' } : { background: 'var(--color-surface)' }}>
                                    Text Status
                                </button>
                                <button onClick={() => { setStatusMode('image'); imageInputRef.current?.click(); }}
                                    className={`flex-1 py-2 rounded-xl text-xs font-bold text-center transition-all ${statusMode === 'image' ? 'text-white' : 'text-text-muted'}`}
                                    style={statusMode === 'image' ? { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' } : { background: 'var(--color-surface)' }}>
                                    <Camera size={12} className="inline mr-1" /> Photo Status
                                </button>
                                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                            </div>

                            {/* Preview */}
                            {statusMode === 'image' && statusImagePreview ? (
                                <div className="relative aspect-[9/12] overflow-hidden">
                                    <img src={statusImagePreview} alt="" className="w-full h-full object-cover" />
                                    <div className="absolute bottom-0 left-0 right-0 p-4" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }}>
                                        <input type="text" value={statusText} onChange={(e) => setStatusText(e.target.value)}
                                            placeholder="Add a caption..."
                                            className="w-full py-2 px-3 rounded-xl text-sm text-white bg-white/10 backdrop-blur-sm placeholder:text-white/50 outline-none border border-white/20" />
                                    </div>
                                    <button onClick={() => { setStatusImage(null); setStatusImagePreview(null); setStatusMode('text'); }}
                                        className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40">
                                        <X size={16} className="text-white" />
                                    </button>
                                </div>
                            ) : (
                                <div className="aspect-[9/12] flex items-center justify-center p-8" style={{ background: statusColor }}>
                                    <textarea
                                        value={statusText}
                                        onChange={(e) => setStatusText(e.target.value)}
                                        placeholder="What's on your mind?"
                                        maxLength={200}
                                        className="w-full text-center text-xl font-bold text-white bg-transparent outline-none resize-none placeholder:text-white/40"
                                        rows={4}
                                        autoFocus
                                    />
                                </div>
                            )}

                            {/* Color picker (text mode only) */}
                            {statusMode === 'text' && (
                                <div className="flex items-center gap-2 p-3 overflow-x-auto">
                                    {STATUS_COLORS.map((c, i) => (
                                        <button key={i} onClick={() => setStatusColor(c)}
                                            className={`w-9 h-9 rounded-full shrink-0 transition-all ${statusColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-bg-card scale-110' : 'ring-1 ring-white/10'}`}
                                            style={{ background: c }} />
                                    ))}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 p-3 pt-1">
                                <button onClick={() => { setShowStatusComposer(false); setStatusImage(null); setStatusImagePreview(null); setStatusMode('text'); }}
                                    className="flex-1 py-3 rounded-2xl font-semibold text-text-secondary text-sm transition-all active:scale-95"
                                    style={{ background: 'var(--color-surface)' }}>
                                    Cancel
                                </button>
                                <button onClick={handlePostStatus} disabled={(!statusText.trim() && !statusImage) || postingStatus}
                                    className="flex-1 py-3 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-all active:scale-95 shadow-lg"
                                    style={{ background: 'linear-gradient(135deg, #FF5A5F, #FF2A6D)', boxShadow: '0 6px 20px rgba(255,90,95,0.3)' }}>
                                    <Send size={14} />
                                    {postingStatus ? 'Posting...' : 'Share'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══════════ STATUS VIEWER ═══════════ */}
            <AnimatePresence>
                {viewingStatus && viewingStatus[statusIndex] && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex flex-col"
                        style={{ background: '#000' }}
                    >
                        {/* Progress bars */}
                        <div className="flex gap-1 p-3 pt-[max(env(safe-area-inset-top,12px),12px)]">
                            {viewingStatus.map((_, i) => (
                                <div key={i} className="flex-1 h-0.5 rounded-full bg-white/20 overflow-hidden">
                                    <div className="h-full rounded-full bg-white transition-all"
                                        style={{ width: i < statusIndex ? '100%' : i === statusIndex ? `${statusProgress}%` : '0%' }} />
                                </div>
                            ))}
                        </div>

                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-2">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-white/20">
                                    {getAvatar(viewingStatus[statusIndex]?.users) ? (
                                        <img src={getAvatar(viewingStatus[statusIndex]?.users)} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                        <UserAvatar name={viewingStatus[statusIndex]?.users?.display_name} size={36} />
                                    )}
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-white">{viewingStatus[statusIndex]?.users?.display_name || 'User'}</p>
                                    <p className="text-[9px] text-white/50">{timeAgo(viewingStatus[statusIndex]?.created_at)}</p>
                                </div>
                            </div>
                            <button onClick={() => { setViewingStatus(null); setStatusIndex(0); }} className="p-2 rounded-full bg-white/10">
                                <X size={20} className="text-white" />
                            </button>
                        </div>

                        {/* Status content */}
                        <div className="flex-1 flex items-center justify-center"
                            style={{ background: viewingStatus[statusIndex]?.media_type !== 'image' ? (viewingStatus[statusIndex]?.background_color || STATUS_COLORS[0]) : '#000' }}
                            onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                if (e.clientX < rect.width / 3) handlePrevStatus();
                                else if (e.clientX > rect.width * 2 / 3) handleNextStatus();
                            }}
                        >
                            {viewingStatus[statusIndex]?.media_type === 'image' && viewingStatus[statusIndex]?.media_url ? (
                                <div className="relative w-full h-full flex items-center justify-center">
                                    <img src={viewingStatus[statusIndex].media_url} alt="" className="max-w-full max-h-full object-contain" />
                                    {viewingStatus[statusIndex]?.content && (
                                        <div className="absolute bottom-16 left-4 right-4">
                                            <p className="text-base font-semibold text-white text-center px-4 py-2 rounded-xl" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
                                                {viewingStatus[statusIndex].content}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-2xl font-bold text-white text-center leading-relaxed px-10">
                                    {viewingStatus[statusIndex]?.content}
                                </p>
                            )}
                        </div>

                        {/* Bottom reactions */}
                        <div className="flex items-center justify-center gap-5 py-4 px-4">
                            {REACTIONS.map(r => (
                                <button key={r.key}
                                    onClick={() => reactToStatus(viewingStatus[statusIndex]?.id, r.key)}
                                    className="text-2xl hover:scale-125 transition-transform active:scale-90">
                                    {r.emoji}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center justify-center gap-2 pb-[max(env(safe-area-inset-bottom,8px),8px)]">
                            <Eye size={12} className="text-white/40" />
                            <span className="text-[10px] text-white/40">{viewingStatus[statusIndex]?.view_count || 0} views</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══════════ MEMBER PROFILE SHEET ═══════════ */}
            <AnimatePresence>
                {selectedMember && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[150] flex items-end justify-center"
                        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
                        onClick={() => setSelectedMember(null)}
                    >
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="w-full max-w-[450px] rounded-t-3xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
                            style={{ background: 'var(--color-bg-card)' }}
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Drag handle */}
                            <div className="flex justify-center pt-3 pb-1">
                                <div className="w-10 h-1 rounded-full bg-text-muted/30" />
                            </div>

                            {/* Member header — clickable photo */}
                            <div className="relative h-52 overflow-hidden mx-3 rounded-2xl">
                                {getAvatar(selectedMember) ? (
                                    <img src={getAvatar(selectedMember)} alt="" className="w-full h-full object-cover cursor-pointer" referrerPolicy="no-referrer"
                                        style={{ imageRendering: 'auto' }}
                                        onClick={() => openLightbox(getAvatar(selectedMember), selectedMember.display_name)} />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--color-surface), var(--color-bg))' }}>
                                        <UserAvatar name={selectedMember.display_name} size={80} />
                                    </div>
                                )}
                                <div className="absolute inset-0 rounded-2xl" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent 60%)' }} />

                                {/* View full image button */}
                                {getAvatar(selectedMember) && (
                                    <button
                                        onClick={() => openLightbox(getAvatar(selectedMember), selectedMember.display_name)}
                                        className="absolute top-3 right-3 p-2 rounded-full"
                                        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
                                    >
                                        <Maximize2 size={14} className="text-white" />
                                    </button>
                                )}

                                <div className="absolute bottom-4 left-4 right-4">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h2 className="text-xl font-extrabold text-white">{selectedMember.display_name}</h2>
                                        {selectedMember.verification_status === 'verified' && <VerifiedBadge size={18} verified={true} />}
                                        {selectedMember.subscription_plan && selectedMember.subscription_plan !== 'free' && (
                                            <VerifiedBadge size={18} badgeText={selectedMember.subscription_plan} />
                                        )}
                                        {selectedMember.age && <span className="text-sm font-medium text-white/70">{selectedMember.age}</span>}
                                        {selectedMember.is_online && <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />}
                                    </div>
                                    {/* Profile Type */}
                                    {getProfileTypeLabel(selectedMember) && (
                                        <span className="inline-block text-[10px] font-bold px-2.5 py-1 rounded-full text-white mt-1.5"
                                            style={{ background: getProfileTypeColor(selectedMember) }}>
                                            {getProfileTypeLabel(selectedMember)}
                                        </span>
                                    )}
                                    {/* Location with real flag */}
                                    {(selectedMember.location || selectedMember.country) && (
                                        <div className="flex items-center gap-1.5 mt-1">
                                            {COUNTRY_FLAGS[selectedMember.country] && (
                                                <img src={COUNTRY_FLAGS[selectedMember.country]} alt="" style={{ width: '18px', height: '14px', borderRadius: '2px' }} />
                                            )}
                                            {selectedMember.country && <span className="text-xs text-white/70 font-semibold">{selectedMember.country}</span>}
                                            {selectedMember.location && (
                                                <>
                                                    <span className="text-white/30">•</span>
                                                    <MapPin size={11} className="text-white/50" />
                                                    <span className="text-xs text-white/60">{selectedMember.location}</span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ═══ DETAILS SECTION ═══ */}
                            <div className="px-4 pt-3 space-y-2">
                                {/* Quick details row */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    {selectedMember.gender && (
                                        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1"
                                            style={{ background: 'rgba(99,102,241,0.1)', color: '#6366F1' }}>
                                            <User size={10} /> {selectedMember.gender === 'male' ? 'Male' : 'Female'}
                                        </span>
                                    )}
                                    {/* Looking for — based on profile type */}
                                    {(() => {
                                        const label = getProfileTypeLabel(selectedMember);
                                        const lookingMap = {
                                            'Sugar Mummy': 'Looking for Toyboy / Sugar Guy',
                                            'Sugar Daddy': 'Looking for Young Lady / Mistress',
                                            'Toyboy': 'Looking for Sugar Mummy',
                                            'Sugar Guy': 'Looking for Sugar Mummy',
                                            'Young Lady': 'Looking for Sugar Daddy',
                                            'Mistress': 'Looking for Sugar Daddy',
                                            'Cougar': 'Looking for Toyboy / Sugar Guy',
                                        };
                                        const text = label ? lookingMap[label] : (selectedMember.looking_for ? `Looking for ${selectedMember.looking_for.replace(/_/g, ' ')}` : null);
                                        return text ? (
                                            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1"
                                                style={{ background: 'rgba(236,72,153,0.1)', color: '#EC4899' }}>
                                                <Heart size={10} /> {text}
                                            </span>
                                        ) : null;
                                    })()}
                                    {selectedMember.created_at && (
                                        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1"
                                            style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>
                                            <Calendar size={10} /> {joinDate(selectedMember.created_at)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Hobbies */}
                            {Array.isArray(selectedMember.hobbies) && selectedMember.hobbies.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 px-4 pt-2">
                                    {selectedMember.hobbies.slice(0, 5).map((h, i) => (
                                        <span key={i} className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                                            style={{
                                                background: ['rgba(255,90,95,0.1)', 'rgba(99,102,241,0.1)', 'rgba(6,182,212,0.1)', 'rgba(236,72,153,0.1)', 'rgba(245,158,11,0.1)'][i % 5],
                                                color: ['#FF5A5F', '#6366F1', '#06B6D4', '#EC4899', '#F59E0B'][i % 5],
                                            }}>
                                            {h}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Interests */}
                            {Array.isArray(selectedMember.interests) && selectedMember.interests.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 px-4 pt-1">
                                    {selectedMember.interests.slice(0, 5).map((interest, i) => (
                                        <span key={i} className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                                            style={{
                                                background: ['rgba(20,184,166,0.1)', 'rgba(245,158,11,0.1)', 'rgba(239,68,68,0.1)', 'rgba(59,130,246,0.1)', 'rgba(168,85,247,0.1)'][i % 5],
                                                color: ['#14B8A6', '#F59E0B', '#EF4444', '#3B82F6', '#A855F7'][i % 5],
                                            }}>
                                            {interest}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Bio */}
                            {selectedMember.bio && (
                                <p className="px-4 pt-2 text-xs text-text-secondary line-clamp-3">{selectedMember.bio}</p>
                            )}

                            {/* ═══ PHONE NUMBER SECTION (Seed profiles only) ═══ */}
                            {selectedMember.phone_masked && (
                                <div className="mx-4 mt-3 p-3 rounded-2xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Phone size={14} style={{ color: '#10B981' }} />
                                        <span className="text-xs font-bold text-text-primary">Phone Number</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-mono text-text-muted tracking-wider">{revealedPhones[selectedMember.id] || selectedMember.phone_masked}</span>
                                        <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => handleRevealPhone(selectedMember)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-[10px] font-bold"
                                            style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)' }}
                                        >
                                            {revealedPhones[selectedMember.id] ? <Phone size={10} /> : <Lock size={10} />}
                                            {revealedPhones[selectedMember.id] ? 'Unlocked' : revealingPhone === selectedMember.id ? 'Revealing...' : 'View Number'}
                                        </motion.button>
                                    </div>
                                </div>
                            )}

                            {/* ═══ FOLLOW SECTION ═══ */}
                            {user?.id && user.id !== selectedMember.id && (
                                <div className="mx-4 mt-2 flex items-center gap-3">
                                    <motion.button
                                        whileTap={{ scale: 0.95 }}
                                        onClick={(e) => handleFollow(e, selectedMember.id)}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white"
                                        style={{ background: followingSet.has(selectedMember.id) ? 'linear-gradient(135deg, #10B981, #059669)' : 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
                                    >
                                        {followingSet.has(selectedMember.id) ? <><UserCheck size={14} /> Following</> : <><UserPlus size={14} /> Follow</>}
                                    </motion.button>
                                    <span className="text-[10px] text-text-muted">{selectedMember.followers_count || 0} followers</span>
                                </div>
                            )}

                            {/* ═══ SEED PROFILE DISCLAIMER ═══ */}
                            {selectedMember.is_seed && (
                                <div className="mx-4 mt-3 p-2.5 rounded-xl flex items-start gap-2" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                                    <Shield size={13} className="shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
                                    <p className="text-[9px] leading-relaxed" style={{ color: '#B45309' }}>
                                        This profile is managed by the platform. Contact details require a verified subscription. All interactions are moderated for your safety.
                                    </p>
                                </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex gap-2 px-4 py-4">
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => handleMessageMember(selectedMember)}
                                    disabled={startingChat === selectedMember.id}
                                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white text-sm shadow-lg disabled:opacity-50"
                                    style={{ background: 'linear-gradient(135deg, #06B6D4, #10B981)', boxShadow: '0 6px 20px rgba(6,182,212,0.3)' }}
                                >
                                    <MessageCircle size={18} />
                                    {startingChat === selectedMember.id ? 'Opening...' : 'Message'}
                                </motion.button>
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => {
                                        if (!canUseFeature('voiceCall')) { router.push('/subscribe'); return; }
                                        alert('Voice call coming soon');
                                    }}
                                    className="w-14 h-[52px] rounded-2xl flex items-center justify-center shadow-lg relative"
                                    style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', boxShadow: '0 6px 20px rgba(99,102,241,0.3)' }}
                                >
                                    <Phone size={20} className="text-white" />
                                    {!canUseFeature('voiceCall') && <Lock size={8} className="absolute top-1.5 right-1.5 text-white/50" />}
                                </motion.button>
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => {
                                        if (!canUseFeature('videoCall')) { router.push('/subscribe'); return; }
                                        alert('Video call coming soon');
                                    }}
                                    className="w-14 h-[52px] rounded-2xl flex items-center justify-center shadow-lg relative"
                                    style={{ background: 'linear-gradient(135deg, #EC4899, #F43F5E)', boxShadow: '0 6px 20px rgba(236,72,153,0.3)' }}
                                >
                                    <Video size={20} className="text-white" />
                                    {!canUseFeature('videoCall') && <Lock size={8} className="absolute top-1.5 right-1.5 text-white/50" />}
                                </motion.button>
                            </div>

                            {/* View profile link */}
                            <div className="px-4 pb-[max(env(safe-area-inset-bottom,16px),16px)]">
                                <Link href={`/members/${selectedMember.id}`}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm transition-all active:scale-95"
                                    style={{ background: 'var(--color-surface)', color: 'var(--color-text-secondary)' }}>
                                    <Eye size={16} /> View Full Profile
                                    <ChevronRight size={14} />
                                </Link>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
