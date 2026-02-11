'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function CommentForm({ profile, onClose }) {
    const { user, profile: userProfile, logMessageSent } = useAuth();
    const [content, setContent] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    // Auto-fill from login credentials
    const authorName = userProfile?.display_name || user?.email?.split('@')[0] || 'Anonymous';
    const authorEmail = user?.email || 'user@app.com';

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!content.trim() || sending) return;

        setSending(true);
        setError('');

        try {
            const res = await fetch('/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    postId: profile.wpId,
                    authorName,
                    authorEmail,
                    content: content.trim(),
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to send');
            }

            setSent(true);
            logMessageSent(profile.name, profile.imageUrl);
        } catch (err) {
            setError(err.message || 'Failed to send comment. Please try again.');
        } finally {
            setSending(false);
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ y: 300, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 300, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="w-full max-w-md rounded-t-3xl p-6 pb-8"
                    style={{ background: 'var(--color-bg-card)', borderTop: 'var(--card-border)' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Handle bar */}
                    <div className="w-10 h-1 bg-text-muted/30 rounded-full mx-auto mb-5" />

                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-text-primary">
                            Comment on {profile?.name || 'Profile'}
                        </h3>
                        <button onClick={onClose} className="p-2 rounded-full transition-colors" style={{ background: 'var(--color-surface)' }}>
                            <X size={20} className="text-text-muted" />
                        </button>
                    </div>

                    {/* Show who is commenting */}
                    <div className="flex items-center gap-2 mb-4 py-2 px-3 rounded-xl" style={{ background: 'var(--color-surface)', border: 'var(--card-border)' }}>
                        <span className="text-xs text-text-muted">Posting as:</span>
                        <span className="text-xs font-bold text-text-primary">{authorName}</span>
                        <span className="text-xs text-text-muted">({authorEmail})</span>
                    </div>

                    {sent ? (
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-center py-8 space-y-3"
                        >
                            <CheckCircle size={48} className="text-success mx-auto" />
                            <h4 className="text-lg font-bold text-text-primary">Comment Sent for Moderation</h4>
                            <p className="text-text-secondary text-sm leading-relaxed max-w-xs mx-auto">
                                Your comment has been submitted to the website and is <strong>awaiting admin approval</strong>.
                                Once approved, it will appear publicly on the profile page.
                            </p>
                            <button onClick={onClose}
                                className="mt-3 px-6 py-2.5 rounded-xl text-sm font-semibold text-white gradient-primary">
                                Done
                            </button>
                        </motion.div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="Write your comment... This will be posted on the website after admin approval."
                                maxLength={1000}
                                rows={4}
                                className="w-full rounded-2xl p-4 text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                style={{ background: 'var(--color-bg-input)', border: 'var(--card-border)' }}
                            />
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-text-muted">
                                    {content.length}/1000
                                </span>
                                {error && (
                                    <span className="text-xs text-danger font-medium">{error}</span>
                                )}
                            </div>
                            <p className="text-[10px] text-text-muted leading-relaxed">
                                💡 Comments are sent to the website for moderation. An admin will review and approve your comment before it appears publicly.
                            </p>
                            <button
                                type="submit"
                                disabled={!content.trim() || sending}
                                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-white gradient-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-90 active:scale-[0.98]"
                            >
                                {sending ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Send size={18} />
                                        Submit Comment
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
