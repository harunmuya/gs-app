'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function CommentForm({ profile, onClose }) {
    const { user, profile: userProfile } = useAuth();
    const [content, setContent] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

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
                    authorName: userProfile?.display_name || user?.email?.split('@')[0] || 'Anonymous',
                    authorEmail: user?.email || 'user@app.com',
                    content: content.trim(),
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to send');
            }

            setSent(true);
            setTimeout(() => onClose?.(), 2000);
        } catch (err) {
            setError(err.message || 'Failed to send message');
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
                    className="w-full max-w-md bg-bg-card rounded-t-3xl p-6 pb-8"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Handle bar */}
                    <div className="w-10 h-1 bg-text-muted/30 rounded-full mx-auto mb-5" />

                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-text-primary">
                            Message {profile?.name || 'Profile'}
                        </h3>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-surface-light transition-colors"
                        >
                            <X size={20} className="text-text-muted" />
                        </button>
                    </div>

                    {sent ? (
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-center py-8"
                        >
                            <div className="text-4xl mb-3">✅</div>
                            <p className="text-success font-semibold">Message sent!</p>
                            <p className="text-text-secondary text-sm mt-1">
                                It will appear after approval
                            </p>
                        </motion.div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="Write a thoughtful message..."
                                maxLength={1000}
                                rows={4}
                                className="w-full bg-bg-input rounded-2xl p-4 text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                            />
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-text-muted">
                                    {content.length}/1000
                                </span>
                                {error && (
                                    <span className="text-xs text-danger">{error}</span>
                                )}
                            </div>
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
                                        Send Message
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
