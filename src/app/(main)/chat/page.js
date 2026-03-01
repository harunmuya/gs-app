'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Search, ChevronRight, ArrowLeft, Send, Check, CheckCheck, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import UserAvatar from '@/components/UserAvatar';
import Link from 'next/link';

export default function ChatPage() {
    const { user, guest, conversations, getChatMessages } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');

    const filteredConvs = useMemo(() => {
        if (!conversations) return [];
        let convs = [...conversations];
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            convs = convs.filter(c => c.matchName?.toLowerCase().includes(q));
        }
        return convs.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
    }, [conversations, searchQuery]);

    if (guest && !user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-surface flex items-center justify-center">
                    <MessageCircle size={40} className="text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-text-primary">Chat</h2>
                <p className="text-text-secondary">Sign in to message your matches.</p>
                <Link href="/auth/login" className="w-full max-w-xs py-3.5 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 block text-center">
                    Sign In
                </Link>
            </div>
        );
    }

    return (
        <div className="px-4 pt-4 pb-24">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <MessageCircle size={22} className="text-primary" />
                <h1 className="text-xl font-bold text-text-primary">Messages</h1>
                {filteredConvs.length > 0 && (
                    <span className="text-[10px] font-bold text-white bg-primary rounded-full w-5 h-5 flex items-center justify-center">
                        {filteredConvs.length}
                    </span>
                )}
            </div>

            {/* Search */}
            <div className="relative mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full py-2.5 pl-9 pr-4 rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
                    style={{ background: 'var(--color-surface)' }}
                />
            </div>

            {/* Conversation List */}
            {filteredConvs.length === 0 ? (
                <div className="text-center py-16 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mx-auto">
                        <MessageCircle size={32} className="text-text-muted" />
                    </div>
                    <h2 className="text-lg font-bold text-text-primary">No conversations yet</h2>
                    <p className="text-sm text-text-secondary">Match with someone on Discover to start chatting!</p>
                    <Link href="/discover" className="inline-block px-6 py-3 rounded-2xl gradient-primary text-white font-semibold text-sm">
                        Go to Discover
                    </Link>
                </div>
            ) : (
                <div className="space-y-1.5">
                    {filteredConvs.map((conv, idx) => (
                        <motion.div key={conv.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                        >
                            <Link
                                href={`/chat/${encodeURIComponent(conv.id)}`}
                                className="flex items-center gap-3 p-3 rounded-2xl transition-colors hover:bg-surface/50"
                                style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}
                            >
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-full overflow-hidden bg-surface shrink-0">
                                        {conv.matchImage ? (
                                            <img src={conv.matchImage} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                                        ) : (
                                            <UserAvatar name={conv.matchName} size={48} />
                                        )}
                                    </div>
                                    {/* Online dot */}
                                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-success border-2 border-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-text-primary truncate">{conv.matchName}</h3>
                                        <span className="text-[10px] text-text-muted shrink-0">{formatTime(conv.lastMessageAt)}</span>
                                    </div>
                                    <p className="text-xs text-text-muted truncate mt-0.5">
                                        {conv.lastMessage || 'Start a conversation...'}
                                    </p>
                                </div>
                                {conv.unreadCount > 0 && (
                                    <span className="text-[10px] font-bold text-white bg-primary rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                                        {conv.unreadCount}
                                    </span>
                                )}
                            </Link>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}

function formatTime(iso) {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
}
