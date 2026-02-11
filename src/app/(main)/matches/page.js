'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MapPin, MessageCircle, Eye, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import CommentForm from '@/components/CommentForm';
import VerifiedBadge from '@/components/VerifiedBadge';
import Logo from '@/components/Logo';
import Link from 'next/link';

export default function MatchesPage() {
    const { user, guest, matches, logMessageSent } = useAuth();
    const [commentProfile, setCommentProfile] = useState(null);

    if (guest && !user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-surface flex items-center justify-center mb-2">
                    <Heart size={40} className="text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-white">Matches</h2>
                <p className="text-text-secondary">Sign in to save your matches and chat.</p>
                <Link href="/auth/login" className="w-full max-w-xs py-3.5 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 text-center block">
                    Sign In
                </Link>
            </div>
        );
    }

    const handleSendMessage = (match) => {
        setCommentProfile({ wpId: match.wpId, name: match.name });
    };

    const handleCommentClose = (sentSuccessfully) => {
        if (sentSuccessfully && commentProfile) {
            logMessageSent(commentProfile.name, commentProfile.imageUrl);
        }
        setCommentProfile(null);
    };

    return (
        <div className="px-4 pt-4 pb-24">
            <div className="flex items-center gap-2 mb-5">
                <Heart size={22} className="text-primary" fill="currentColor" />
                <h1 className="text-xl font-bold text-text-primary">Your Matches</h1>
                <span className="ml-auto text-xs text-text-muted bg-surface rounded-full px-2.5 py-0.5">{matches.length}</span>
            </div>

            {matches.length === 0 ? (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16 space-y-4">
                    <div className="text-5xl">💝</div>
                    <h2 className="text-lg font-bold text-text-primary">No matches yet</h2>
                    <p className="text-text-secondary text-sm max-w-xs mx-auto">Keep swiping right on profiles you like!</p>
                </motion.div>
            ) : (
                <div className="space-y-4">
                    <AnimatePresence>
                        {matches.map((match, index) => (
                            <motion.div key={match.wpId} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
                                className="rounded-2xl overflow-hidden card-shadow bg-bg-card" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>

                                {/* Clickable profile area - opens single profile */}
                                <Link href={`/discover/${match.wpId}`} className="block">
                                    <div className="flex gap-3.5 p-3.5">
                                        {/* Avatar */}
                                        <div className="w-20 h-20 rounded-2xl overflow-hidden bg-surface shrink-0 ring-2 ring-primary/20">
                                            {match.imageUrl ? (
                                                <img src={match.imageUrl} alt={match.name} className="w-full h-full object-cover" loading="lazy" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Logo size={30} className="opacity-30" />
                                                </div>
                                            )}
                                        </div>
                                        {/* Info */}
                                        <div className="flex-1 min-w-0 py-0.5">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <h3 className="text-sm font-bold text-white truncate">{match.name || 'Unknown'}</h3>
                                                <VerifiedBadge size={14} />
                                            </div>
                                            {match.location && (
                                                <div className="flex items-center gap-1 text-text-muted mb-1.5">
                                                    <MapPin size={11} />
                                                    <span className="text-xs">{match.location}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-full">
                                                    {match.score || 85}% Match
                                                </span>
                                                <span className="flex items-center gap-1 text-[10px] text-text-muted">
                                                    <Eye size={10} /> {match.views?.toLocaleString() || '—'}
                                                </span>
                                            </div>
                                        </div>
                                        <ExternalLink size={16} className="text-text-muted shrink-0 mt-1" />
                                    </div>
                                </Link>

                                {/* Action buttons */}
                                <div className="flex items-center gap-2 px-3.5 pb-3">
                                    <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition-colors">
                                        <Heart size={13} fill="currentColor" />
                                        Liked ✓
                                    </button>
                                    <button onClick={() => handleSendMessage(match)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-white bg-surface-light hover:bg-surface transition-colors border border-white/5">
                                        <MessageCircle size={13} />
                                        Send Message
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {commentProfile && (
                <CommentForm profile={commentProfile} onClose={() => handleCommentClose(true)} />
            )}
        </div>
    );
}
