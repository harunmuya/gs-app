'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Star, MapPin, ChevronRight, Zap, Users, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import UserAvatar from '@/components/UserAvatar';
import TelegramIcon from '@/components/TelegramIcon';
import Link from 'next/link';



export default function MatchesPage() {
    const { user, guest, matches, activity, requestConnection } = useAuth();

    const recentActivity = useMemo(() =>
        (activity || [])
            .filter(a => ['like', 'match', 'view', 'connection_request', 'meetup_ready', 'request_hookup'].includes(a.type))
            .slice(0, 12),
        [activity]
    );

    if (guest && !user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-surface flex items-center justify-center">
                    <Heart size={40} className="text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-text-primary">Matches</h2>
                <p className="text-text-secondary">Sign in to see your matches.</p>
                <Link href="/auth/login" className="w-full max-w-xs py-3.5 rounded-2xl font-semibold text-white gradient-primary shadow-lg shadow-primary/20 block text-center">
                    Sign In
                </Link>
            </div>
        );
    }

    return (
        <div className="px-4 pt-4 pb-24">
            {/* Header */}
            <div className="flex items-center gap-2 mb-5">
                <Users size={22} className="text-primary" />
                <h1 className="text-xl font-bold text-text-primary">Matches</h1>
                {matches.length > 0 && (
                    <span className="text-[10px] font-bold text-white bg-primary rounded-full w-5 h-5 flex items-center justify-center">
                        {matches.length}
                    </span>
                )}
            </div>

            {/* Matches Grid */}
            {matches.length === 0 ? (
                <div className="text-center py-10 space-y-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mx-auto">
                        <Heart size={32} className="text-text-muted" />
                    </div>
                    <h2 className="text-lg font-bold text-text-primary">No matches yet</h2>
                    <p className="text-sm text-text-secondary">Keep swiping on Discover to find your matches!</p>
                </div>
            ) : (
                <div className="space-y-2 mb-6">
                    {matches.map((match, idx) => {
                        const telegramMsg = encodeURIComponent(`Hi, need a match connection with ${match.name || 'a sugar mum'}`);
                        const telegramLink = `https://t.me/GSADMINMARYGAGENCY?text=${telegramMsg}`;

                        return (
                            <motion.div key={match.wpId || idx}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: Math.min(idx * 0.05, 0.3) }}
                                className="rounded-2xl overflow-hidden"
                                style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>

                                <Link href={`/discover/${match.wpId}`} className="flex items-center gap-3 p-3">
                                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-surface shrink-0">
                                        {match.imageUrl ? (
                                            <img src={match.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        ) : (
                                            <UserAvatar name={match.name} size={56} />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <h3 className="text-sm font-bold text-text-primary truncate">{match.name || 'Sugar Mum'}</h3>
                                        </div>
                                        {match.location && (
                                            <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                                                <MapPin size={10} /> {match.location}
                                            </p>
                                        )}
                                        <p className="text-[10px] text-gold font-semibold mt-0.5 flex items-center gap-1">
                                            <Star size={10} className="text-gold" fill="currentColor" /> {match.score || 85}% Match
                                        </p>
                                    </div>
                                    <ChevronRight size={18} className="text-text-muted shrink-0" />
                                </Link>

                                {/* Quick actions */}
                                <div className="flex items-center gap-2 px-3 pb-3">
                                    <a
                                        href={telegramLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => requestConnection?.(match.name, match.wpId)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold text-white transition-all active:scale-95"
                                        style={{ background: '#26A5E4' }}
                                    >
                                        <TelegramIcon size={12} /> Request Connection
                                    </a>
                                    <Link href={`/discover/${match.wpId}`}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold text-text-secondary transition-all"
                                        style={{ background: 'var(--color-surface)' }}>
                                        <MessageCircle size={12} /> Comment
                                    </Link>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Recent Activity Feed */}
            {recentActivity.length > 0 && (
                <>
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles size={16} className="text-gold" />
                        <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">Recent Activity</h2>
                    </div>
                    <div className="space-y-1.5">
                        {recentActivity.map((item) => {
                            const hasProfile = !!item.profileId;
                            const content = (
                                <div key={item.id} className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors ${hasProfile ? 'hover:bg-surface/50' : ''}`}>
                                    <div className="w-9 h-9 rounded-full overflow-hidden bg-surface shrink-0 flex items-center justify-center">
                                        {item.image ? (
                                            <img src={item.image} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <Heart size={14} className="text-text-muted" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-text-primary truncate">{item.title}</p>
                                        <p className="text-[10px] text-text-muted">{formatTime(item.timestamp)}</p>
                                    </div>
                                </div>
                            );

                            if (hasProfile) {
                                return <Link key={item.id} href={`/discover/${item.profileId}`}>{content}</Link>;
                            }
                            return <div key={item.id}>{content}</div>;
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

function formatTime(iso) {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}
