'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MapPin, MessageCircle, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import CommentForm from '@/components/CommentForm';
import ContactButtons from '@/components/ContactButtons';
import VerifiedBadge from '@/components/VerifiedBadge';
import Logo from '@/components/Logo';
import Link from 'next/link';

export default function MatchesPage() {
    const { user, guest, matches } = useAuth();
    const [commentProfile, setCommentProfile] = useState(null);

    // Guest view
    if (guest && !user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-surface flex items-center justify-center mb-2">
                    <Heart size={40} className="text-primary" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">Matches</h2>
                    <p className="text-text-secondary">
                        Sign in to save your matches and chat with sugar mummies.
                    </p>
                </div>
                <Link
                    href="/auth/login"
                    className="w-full max-w-xs py-3.5 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 text-center block"
                >
                    Sign In / Create Account
                </Link>
            </div>
        );
    }

    return (
        <div className="px-5 pt-4">
            {/* Header */}
            <div className="flex items-center gap-2 mb-6">
                <Heart size={24} className="text-primary" fill="currentColor" />
                <h1 className="text-xl font-bold text-text-primary">Your Matches</h1>
                <span className="ml-auto text-sm text-text-muted bg-surface rounded-full px-2.5 py-0.5">
                    {matches.length}
                </span>
            </div>

            {matches.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-16 space-y-4"
                >
                    <div className="text-5xl">💝</div>
                    <h2 className="text-lg font-bold text-text-primary">No matches yet</h2>
                    <p className="text-text-secondary text-sm max-w-xs mx-auto">
                        Keep swiping right on profiles you like! Matches will appear here.
                    </p>
                </motion.div>
            ) : (
                <div className="space-y-5 pb-4">
                    <AnimatePresence>
                        {matches.map((match, index) => (
                            <motion.div
                                key={match.wpId}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="rounded-2xl overflow-hidden card-shadow bg-bg-card"
                                style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                            >
                                {/* Profile image + info */}
                                <div className="relative" style={{ aspectRatio: '4/3' }}>
                                    {match.imageUrl ? (
                                        <img
                                            src={match.imageUrl}
                                            alt={match.name}
                                            className="absolute inset-0 w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 bg-surface flex items-center justify-center">
                                            <Logo size={40} className="opacity-30" />
                                        </div>
                                    )}

                                    {/* Gradient */}
                                    <div className="absolute inset-0 gradient-overlay" />

                                    {/* Score badge */}
                                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold glass">
                                        <span className="text-gold">{match.score || 85}% Match</span>
                                    </div>

                                    {/* View count badge */}
                                    <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full text-[11px] glass">
                                        <Eye size={12} className="text-text-secondary" />
                                        <span className="text-text-secondary font-medium">
                                            {match.views ? match.views.toLocaleString() : '—'} views
                                        </span>
                                    </div>

                                    {/* Info overlay */}
                                    <div className="absolute bottom-0 left-0 right-0 p-4 space-y-1">
                                        <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                                            {match.name || 'Unknown'}
                                            <VerifiedBadge size={16} />
                                        </h3>
                                        {match.location && (
                                            <div className="flex items-center gap-1 text-white/70">
                                                <MapPin size={12} />
                                                <span className="text-xs">{match.location}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Actions row */}
                                <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    <button
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
                                    >
                                        <Heart size={13} fill="currentColor" />
                                        Liked
                                    </button>
                                    <button
                                        onClick={() => setCommentProfile({
                                            wpId: match.wpId,
                                            name: match.name,
                                        })}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-text-secondary bg-surface hover:bg-surface-light transition-colors"
                                    >
                                        <MessageCircle size={13} />
                                        Message
                                    </button>
                                </div>

                                {/* Contact buttons */}
                                <div className="p-3 pt-0">
                                    <ContactButtons profileName={match.name} />
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* Comment form */}
            {commentProfile && (
                <CommentForm
                    profile={commentProfile}
                    onClose={() => setCommentProfile(null)}
                />
            )}
        </div>
    );
}
