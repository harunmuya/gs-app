'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MapPin, MessageCircle, ExternalLink, Zap, Flame, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import CommentForm from '@/components/CommentForm';
import VerifiedBadge from '@/components/VerifiedBadge';
import UserAvatar from '@/components/UserAvatar';
import Link from 'next/link';

export default function MatchesPage() {
    const { user, guest, matches, activity, addLike, addSuperLike, logMessageSent } = useAuth();
    const [commentProfile, setCommentProfile] = useState(null);
    const [activityProfiles, setActivityProfiles] = useState([]);

    // Build activity feed from recent activity items that have a profileId
    useEffect(() => {
        const seen = new Set();
        const feed = activity
            .filter(a => a.profileId && !seen.has(a.profileId) && (seen.add(a.profileId), true))
            .slice(0, 15)
            .map(a => ({
                wpId: a.profileId,
                name: (a.title || '').replace(/^(You (super )?liked |Matched with |Viewed |Saved )/, '').replace(/ [⚡💖✓].*$/, '').trim() || 'Someone',
                image: a.image || '',
                type: a.type,
            }));
        setActivityProfiles(feed);
    }, [activity]);

    if (guest && !user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-surface flex items-center justify-center mb-2">
                    <Heart size={40} className="text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-text-primary">Matches</h2>
                <p className="text-text-secondary">Sign in to save your matches and chat.</p>
                <Link href="/auth/login" className="w-full max-w-xs py-3.5 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 text-center block">Sign In</Link>
            </div>
        );
    }

    const handleSendMessage = (match) => {
        setCommentProfile({ wpId: match.wpId, name: match.name, imageUrl: match.imageUrl || match.image });
    };

    return (
        <div className="px-4 pt-4 pb-24">
            <div className="flex items-center gap-2 mb-5">
                <Heart size={22} className="text-primary" fill="currentColor" />
                <h1 className="text-xl font-bold text-text-primary">Your Matches</h1>
                <span className="ml-auto text-xs text-text-muted bg-surface rounded-full px-2.5 py-0.5">{matches.length}</span>
            </div>

            {/* Activity Feed */}
            {activityProfiles.length > 0 && (
                <div className="mb-6">
                    <div className="flex items-center gap-1.5 mb-3">
                        <Flame size={16} className="text-primary" />
                        <h2 className="text-sm font-bold text-text-primary">Activity Feed</h2>
                        <span className="text-[10px] text-text-muted ml-auto">{activityProfiles.length} recent</span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        {activityProfiles.map((prof) => (
                            <div key={`feed-${prof.wpId}-${prof.type}`} className="shrink-0 w-[90px]">
                                <Link href={`/discover/${prof.wpId}`} className="block">
                                    <div className="w-[90px] h-[90px] rounded-2xl overflow-hidden bg-surface ring-1 ring-black/5 mb-1.5 relative">
                                        {prof.image ? (
                                            <img src={prof.image} alt={prof.name} className="w-full h-full object-cover" loading="lazy" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                                                <UserAvatar name={prof.name} size={40} />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                                        <span className="absolute bottom-1 left-1 right-1 text-[9px] text-white font-medium truncate text-center">
                                            {prof.name}
                                        </span>
                                    </div>
                                </Link>
                                {/* Quick Actions */}
                                <div className="flex items-center justify-center gap-1">
                                    <button
                                        onClick={() => addSuperLike?.({ wpId: prof.wpId, name: prof.name, imageUrl: prof.image })}
                                        className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center hover:bg-blue-100 transition-colors"
                                        title="Super Like"
                                    >
                                        <Zap size={12} className="text-blue-500" fill="currentColor" />
                                    </button>
                                    <button
                                        onClick={() => addLike?.({ wpId: prof.wpId, name: prof.name, imageUrl: prof.image })}
                                        className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                                        title="Like"
                                    >
                                        <Heart size={12} className="text-primary" fill="currentColor" />
                                    </button>
                                    <button
                                        onClick={() => handleSendMessage(prof)}
                                        className="w-7 h-7 rounded-full bg-surface flex items-center justify-center hover:bg-surface-light transition-colors"
                                        title="Comment"
                                    >
                                        <MessageCircle size={12} className="text-text-muted" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {matches.length === 0 ? (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16 space-y-4">
                    <div className="text-5xl">💝</div>
                    <h2 className="text-lg font-bold text-text-primary">No matches yet</h2>
                    <p className="text-text-secondary text-sm max-w-xs mx-auto">Keep swiping right on profiles you like!</p>
                </motion.div>
            ) : (
                <div className="space-y-4">
                    <AnimatePresence>
                        {matches.map((match, index) => {
                            const availability = match.daysSincePost < 7 ? 'Available' : match.daysSincePost < 30 ? 'Active' : 'Occasional';
                            const availabilityColor = match.daysSincePost < 7 ? 'bg-success' : match.daysSincePost < 30 ? 'bg-gold' : 'bg-text-muted';

                            return (
                                <motion.div key={match.wpId} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
                                    className="rounded-2xl overflow-hidden card-shadow bg-bg-card" style={{ border: '1px solid var(--color-border)' }}>

                                    <Link href={`/discover/${match.wpId}`} className="block">
                                        <div className="flex gap-3.5 p-3.5">
                                            <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-surface shrink-0 ring-2 ring-primary/20">
                                                {match.imageUrl ? (
                                                    <img src={match.imageUrl} alt={match.name} className="w-full h-full object-cover" loading="lazy" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <UserAvatar name={match.name} size={50} />
                                                    </div>
                                                )}
                                                {/* Availability dot */}
                                                <div className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-bg-card ${availabilityColor}`} />
                                            </div>
                                            <div className="flex-1 min-w-0 py-0.5">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <h3 className="text-sm font-bold text-text-primary truncate">{match.name || 'Unknown'}</h3>
                                                    <VerifiedBadge size={14} />
                                                </div>
                                                {match.location && (
                                                    <div className="flex items-center gap-1 text-text-muted mb-1.5">
                                                        <MapPin size={11} />
                                                        <span className="text-xs">{match.location}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-full">
                                                        {match.score || 85}% Match
                                                    </span>
                                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${match.daysSincePost < 7 ? 'bg-success/10 text-success' : match.daysSincePost < 30 ? 'bg-gold/10 text-gold' : 'bg-surface text-text-muted'}`}>
                                                        {availability}
                                                    </span>
                                                    {match.commentCount > 0 && (
                                                        <span className="flex items-center gap-0.5 text-[10px] text-text-muted">
                                                            <MessageCircle size={9} /> {match.commentCount}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <ExternalLink size={16} className="text-text-muted shrink-0 mt-1" />
                                        </div>
                                    </Link>

                                    <div className="flex items-center gap-2 px-3.5 pb-3">
                                        <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition-colors">
                                            <Heart size={13} fill="currentColor" />
                                            Liked ✓
                                        </button>
                                        <button onClick={() => handleSendMessage(match)}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-text-primary bg-surface-light hover:bg-surface transition-colors"
                                            style={{ border: '1px solid var(--color-border)' }}>
                                            <MessageCircle size={13} />
                                            Send Message
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            {commentProfile && (
                <CommentForm profile={commentProfile} onClose={() => { logMessageSent(commentProfile.name, commentProfile.imageUrl || commentProfile.image); setCommentProfile(null); }} />
            )}
        </div>
    );
}
