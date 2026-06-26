'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Send, Phone, Video, MoreVertical, Image as ImageIcon,
    Mic, MicOff, Lock, Crown, Check, CheckCheck, Smile, X, Play, Pause
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import UserAvatar from '@/components/UserAvatar';
import supabase from '@/lib/supabaseClient';

export default function DMChatPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const conversationId = params.id;
    const otherName = searchParams.get('name') || 'User';
    const otherAvatar = searchParams.get('avatar') || '';
    const otherId = searchParams.get('otherId') || '';

    const { user, sendDM, fetchDMs, markDMsRead, canUseFeature, subscription } = useAuth();

    const [messages, setMessages] = useState([]);
    const [newMsg, setNewMsg] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const recordingRef = useRef(null);

    // Load messages
    const loadMessages = useCallback(async () => {
        const data = await fetchDMs(conversationId);
        setMessages(data);
        setLoading(false);
        await markDMsRead(conversationId);
    }, [conversationId, fetchDMs, markDMsRead]);

    useEffect(() => {
        loadMessages(); // Initial load

        // Subscribe to real-time changes on direct_messages for this conversation
        const channel = supabase
            .channel(`dm-${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'direct_messages',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => {
                    const newMessage = payload.new;
                    // Only add if not from current user (we already optimistically added it)
                    // Or if it IS from current user, replace the temp message
                    setMessages(prev => {
                        // Check if we already have this message (from optimistic update)
                        const exists = prev.some(m => m.id === newMessage.id);
                        if (exists) return prev;
                        // Remove temp messages from same user and add real one
                        const filtered = prev.filter(m => !m.id?.startsWith('temp-') || m.sender_id !== newMessage.sender_id);
                        return [...filtered, newMessage];
                    });
                    // Mark as read if from other user
                    if (newMessage.sender_id !== user?.id) {
                        markDMsRead(conversationId);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'direct_messages',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => {
                    // Update read receipts
                    setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [conversationId, user?.id]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    const handleSend = async () => {
        if (!newMsg.trim() || sending) return;
        const content = newMsg.trim();
        setNewMsg('');
        setSending(true);

        // Optimistic update
        const tempMsg = {
            id: `temp-${Date.now()}`,
            sender_id: user?.id,
            content,
            message_type: 'text',
            created_at: new Date().toISOString(),
            is_read: false,
        };
        setMessages(prev => [...prev, tempMsg]);

        const result = await sendDM(conversationId, content, 'text');
        setSending(false);

        // If there was an error (e.g. message limit), show it and remove temp message
        if (result?.error) {
            setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
            // Could show a toast here
        }
        // No need to loadMessages() — realtime subscription handles new messages
    };

    const handleVoiceRecord = () => {
        if (!canUseFeature('voiceMsg')) {
            router.push('/subscribe');
            return;
        }
        if (isRecording) {
            setIsRecording(false);
            clearInterval(recordingRef.current);
            setRecordingDuration(0);
        } else {
            setIsRecording(true);
            setRecordingDuration(0);
            recordingRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        }
    };

    const formatTime = (date) => {
        const d = new Date(date);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDuration = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const groupMessagesByDate = (msgs) => {
        const groups = {};
        msgs.forEach(msg => {
            const date = new Date(msg.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            if (!groups[date]) groups[date] = [];
            groups[date].push(msg);
        });
        return groups;
    };

    const grouped = groupMessagesByDate(messages);

    return (
        <div className="flex flex-col h-dvh" style={{ background: 'var(--color-bg)' }}>
            {/* Header */}
            <div className="flex items-center gap-3 px-3 py-3 border-b"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)', paddingTop: 'max(env(safe-area-inset-top, 8px), 8px)' }}>
                <button onClick={() => router.back()} className="p-1">
                    <ArrowLeft size={22} className="text-text-primary" />
                </button>
                <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                    {otherAvatar ? (
                        <img src={decodeURIComponent(otherAvatar)} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                        <UserAvatar name={otherName} size={40} />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h1 className="text-sm font-bold text-text-primary truncate">{decodeURIComponent(otherName)}</h1>
                    <p className="text-[10px] text-text-muted">Direct Message</p>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => {
                            if (!canUseFeature('voiceCall')) { router.push('/subscribe'); return; }
                            alert('Voice call coming soon');
                        }}
                        className="p-2 rounded-xl transition-colors"
                        style={{ background: 'var(--color-surface)' }}
                    >
                        <Phone size={18} className="text-text-muted" />
                    </button>
                    <button
                        onClick={() => {
                            if (!canUseFeature('videoCall')) { router.push('/subscribe'); return; }
                            alert('Video call coming soon');
                        }}
                        className="p-2 rounded-xl transition-colors"
                        style={{ background: 'var(--color-surface)' }}
                    >
                        <Video size={18} className="text-text-muted" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <img src="/gs.png" alt="" className="w-10 h-10 animate-pulse-zoom" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'var(--color-surface)' }}>
                            <Send size={24} className="text-text-muted" />
                        </div>
                        <p className="text-sm text-text-muted">Say hello to start the conversation</p>
                    </div>
                ) : (
                    Object.entries(grouped).map(([date, msgs]) => (
                        <div key={date}>
                            <div className="flex items-center justify-center my-3">
                                <span className="text-[10px] text-text-muted px-3 py-1 rounded-full" style={{ background: 'var(--color-surface)' }}>{date}</span>
                            </div>
                            {msgs.map((msg, idx) => {
                                const isMe = msg.sender_id === user?.id;
                                return (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`flex mb-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[75%] px-3.5 py-2.5 ${isMe ? 'rounded-2xl rounded-br-md' : 'rounded-2xl rounded-bl-md'}`}
                                            style={isMe
                                                ? { background: 'linear-gradient(135deg, #FF5A5F, #FF2A6D)', color: '#fff' }
                                                : { background: 'var(--color-surface)', color: 'var(--color-text-primary)' }
                                            }
                                        >
                                            {msg.message_type === 'voice' ? (
                                                <div className="flex items-center gap-2 min-w-[140px]">
                                                    <button className="w-8 h-8 rounded-full flex items-center justify-center"
                                                        style={{ background: isMe ? 'rgba(255,255,255,0.2)' : 'var(--color-primary)', color: isMe ? '#fff' : '#fff' }}>
                                                        <Play size={14} />
                                                    </button>
                                                    <div className="flex-1 h-1 rounded-full" style={{ background: isMe ? 'rgba(255,255,255,0.3)' : 'var(--color-border)' }}>
                                                        <div className="w-1/3 h-full rounded-full" style={{ background: isMe ? '#fff' : 'var(--color-primary)' }} />
                                                    </div>
                                                    <span className={`text-[10px] ${isMe ? 'text-white/70' : 'text-text-muted'}`}>{formatDuration(msg.media_duration || 0)}</span>
                                                </div>
                                            ) : (
                                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                            )}
                                            <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : ''}`}>
                                                <span className={`text-[9px] ${isMe ? 'text-white/50' : 'text-text-muted'}`}>{formatTime(msg.created_at)}</span>
                                                {isMe && (
                                                    msg.is_read
                                                        ? <CheckCheck size={12} className="text-white/70" />
                                                        : <Check size={12} className="text-white/40" />
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Voice recording bar */}
            <AnimatePresence>
                {isRecording && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="flex items-center gap-3 px-4 py-3 border-t"
                        style={{ borderColor: 'var(--color-border)', background: 'rgba(239,68,68,0.05)' }}
                    >
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-sm font-medium text-red-500">Recording {formatDuration(recordingDuration)}</span>
                        <div className="flex-1" />
                        <button onClick={() => { setIsRecording(false); clearInterval(recordingRef.current); setRecordingDuration(0); }}
                            className="p-2 rounded-full bg-red-500/10">
                            <X size={16} className="text-red-500" />
                        </button>
                        <button onClick={() => {
                            setIsRecording(false);
                            clearInterval(recordingRef.current);
                            sendDM(conversationId, '[Voice message]', 'voice', null, recordingDuration);
                            setRecordingDuration(0);
                            // No need to loadMessages() — realtime subscription handles new messages
                        }}
                            className="p-2 rounded-full" style={{ background: 'linear-gradient(135deg, #FF5A5F, #FF2A6D)' }}>
                            <Send size={16} className="text-white" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Input bar */}
            {!isRecording && (
                <div className="flex items-center gap-2 px-3 py-3 border-t"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)', paddingBottom: 'max(env(safe-area-inset-bottom, 8px), 8px)' }}>
                    <button onClick={handleVoiceRecord}
                        className="p-2.5 rounded-xl shrink-0 transition-colors"
                        style={{ background: 'var(--color-surface)' }}
                        title={canUseFeature('voiceMsg') ? 'Voice message' : 'Upgrade for voice messages'}>
                        {canUseFeature('voiceMsg') ? <Mic size={20} className="text-text-muted" /> : <Lock size={20} className="text-text-muted" />}
                    </button>
                    <div className="flex-1 relative">
                        <input
                            ref={inputRef}
                            type="text"
                            value={newMsg}
                            onChange={(e) => setNewMsg(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder="Type a message..."
                            className="w-full py-2.5 px-4 rounded-2xl text-sm text-text-primary placeholder:text-text-muted outline-none"
                            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                        />
                    </div>
                    <button onClick={handleSend} disabled={!newMsg.trim() || sending}
                        className="p-2.5 rounded-xl shrink-0 disabled:opacity-40 transition-all"
                        style={{ background: newMsg.trim() ? 'linear-gradient(135deg, #FF5A5F, #FF2A6D)' : 'var(--color-surface)' }}>
                        <Send size={20} className={newMsg.trim() ? 'text-white' : 'text-text-muted'} />
                    </button>
                </div>
            )}
        </div>
    );
}
