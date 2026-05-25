'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Search, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import UserAvatar from '@/components/UserAvatar';
import Link from 'next/link';

function formatTime(iso) {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
    return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
}

export default function ChatPage() {
    const { user, conversations } = useAuth();
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

    const totalUnread = filteredConvs.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

    return (
        <div className="min-h-dvh bg-bg pb-24">
            {/* Header */}
            <div className="sticky top-0 z-10 px-4 pt-4 pb-3 border-b border-border"
                style={{ background: 'var(--color-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-md shadow-primary/20">
                            <MessageCircle size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-text-primary leading-tight">Messages</h1>
                            {totalUnread > 0 && (
                                <p className="text-[10px] text-primary font-semibold">{totalUnread} unread</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {filteredConvs.length > 0 && (
                            <span className="text-xs font-bold text-white px-2.5 py-1 rounded-full gradient-primary shadow-sm shadow-primary/20">
                                {filteredConvs.length}
                            </span>
                        )}
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                        type="text"
                        placeholder="Search conversations..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full py-2.5 pl-10 pr-4 rounded-xl text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30 border border-border"
                        style={{ background: 'var(--color-bg-input)' }}
                    />
                </div>
            </div>

            {/* Conversation List */}
            <div className="px-4 pt-3">
                {filteredConvs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center pt-24 space-y-5 text-center px-6">
                        <div className="relative">
                            <div className="w-20 h-20 rounded-3xl gradient-primary flex items-center justify-center shadow-xl shadow-primary/25">
                                <MessageCircle size={36} className="text-white" />
                            </div>
                            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gold flex items-center justify-center shadow-md">
                                <Sparkles size={12} className="text-white" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-text-primary mb-2">No conversations yet</h2>
                            <p className="text-sm text-text-secondary leading-relaxed">
                                {searchQuery
                                    ? `No chats found for "${searchQuery}"`
                                    : 'Match with someone on Discover to start chatting!'}
                            </p>
                        </div>
                        {!searchQuery && (
                            <Link
                                href="/discover"
                                className="px-8 py-3.5 rounded-2xl gradient-primary text-white font-bold text-sm shadow-lg shadow-primary/25 active:scale-[0.97] transition-all"
                            >
                                Discover Profiles
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredConvs.map((conv, idx) => (
                            <motion.div
                                key={conv.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: Math.min(idx * 0.04, 0.3) }}
                            >
                                <Link
                                    href={`/chat/${encodeURIComponent(conv.id)}`}
                                    className="flex items-center gap-3 p-3.5 rounded-2xl transition-all active:scale-[0.98] border"
                                    style={{
                                        background: conv.unreadCount > 0
                                            ? 'var(--color-bg-card)'
                                            : 'var(--color-bg-card)',
                                        borderColor: conv.unreadCount > 0
                                            ? 'var(--color-primary)'
                                            : 'var(--color-border)',
                                        boxShadow: conv.unreadCount > 0
                                            ? '0 2px 12px rgba(255,90,95,0.08)'
                                            : '0 1px 4px rgba(0,0,0,0.04)',
                                    }}
                                >
                                    {/* Avatar */}
                                    <div className="relative shrink-0">
                                        <div className="w-12 h-12 rounded-2xl overflow-hidden bg-surface">
                                            {conv.matchImage ? (
                                                <img
                                                    src={conv.matchImage}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                    onError={e => { e.target.style.display = 'none'; }}
                                                />
                                            ) : (
                                                <UserAvatar name={conv.matchName} size={48} />
                                            )}
                                        </div>
                                        {conv.unreadCount > 0 && (
                                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary border-2 border-bg" />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <h3 className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-black text-text-primary' : 'font-bold text-text-primary'}`}>
                                                {conv.matchName || 'Unknown'}
                                            </h3>
                                            <span className="text-[10px] text-text-muted shrink-0 ml-2">
                                                {formatTime(conv.lastMessageAt)}
                                            </span>
                                        </div>
                                        <p className={`text-xs truncate ${conv.unreadCount > 0 ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
                                            {conv.lastMessage || 'Start a conversation…'}
                                        </p>
                                    </div>

                                    {/* Unread badge */}
                                    {conv.unreadCount > 0 && (
                                        <span className="text-[9px] font-black text-white rounded-full w-5 h-5 flex items-center justify-center shrink-0 shadow-sm shadow-primary/30"
                                            style={{ background: 'var(--color-primary)' }}>
                                            {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                                        </span>
                                    )}
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
