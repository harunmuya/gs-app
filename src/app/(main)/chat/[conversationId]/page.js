'use client';

import { useState, useEffect, useRef, use, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Send, Check, CheckCheck, Phone, Video, Lock, Shield,
    AlertTriangle, MessageCircle, Crown, Mic
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import UserAvatar from '@/components/UserAvatar';
import VerifiedBadge from '@/components/VerifiedBadge';
import {
    detectIntent, filterContent, getBlockWarning, generateResponse,
    calculateTypingDelay, shouldAddLongDelay, getLongDelay,
    getOnlineStatus, getReplyCount, incrementReplyCount, setReplyCount,
    isChatLocked, MAX_FREE_REPLIES, getApprovalUrl
} from '@/lib/chatEngine';

export default function ChatConversationPage({ params }) {
    const resolvedParams = use(params);
    const conversationId = decodeURIComponent(resolvedParams.conversationId);
    const router = useRouter();
    const { user, conversations, getChatMessages, sendChatMessage, markChatSeen } = useAuth();

    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [chatLocked, setChatLocked] = useState(false);
    const [onlineStatus, setOnlineStatus] = useState({ status: 'online', text: 'Online now' });
    const [showWarning, setShowWarning] = useState(null);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const replyTimerRef = useRef(null);

    const conversation = conversations?.find(c => c.id === conversationId);

    // Load messages + reply count
    useEffect(() => {
        async function load() {
            try {
                const msgs = await getChatMessages(conversationId);
                setMessages(msgs || []);
                await markChatSeen(conversationId);

                // Count existing AI replies to restore state
                const aiReplies = (msgs || []).filter(m => m.senderId !== user?.email).length;
                setReplyCount(conversationId, aiReplies);
                if (aiReplies >= MAX_FREE_REPLIES) setChatLocked(true);
            } catch (err) {
                console.error('Failed to load messages:', err);
            } finally {
                setLoading(false);
            }
        }
        if (conversationId) load();
    }, [conversationId]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    // Rotate online status
    useEffect(() => {
        const iv = setInterval(() => {
            setOnlineStatus(getOnlineStatus());
        }, 15000 + Math.random() * 30000);
        return () => clearInterval(iv);
    }, []);

    // Cleanup timers
    useEffect(() => {
        return () => {
            if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
        };
    }, []);

    // ---- AI Reply Logic ----
    const triggerAIReply = useCallback(async (userMessageText) => {
        if (isChatLocked(conversationId)) return;

        const replyNumber = getReplyCount(conversationId) + 1;
        const response = generateResponse(
            userMessageText,
            conversation?.matchName,
            user?.display_name || user?.email?.split('@')[0],
            replyNumber
        );

        // Calculate delays
        const typingDelay = calculateTypingDelay(response.text);
        const preDelay = shouldAddLongDelay() ? getLongDelay() : (1500 + Math.random() * 2000);

        // Show "delivered" after 1s
        await new Promise(r => setTimeout(r, 1000));
        setMessages(prev => prev.map(m =>
            m.senderId === user?.email && m.status === 'sent'
                ? { ...m, status: 'delivered' } : m
        ));

        // Show "seen" after 2-4s
        await new Promise(r => setTimeout(r, 1500 + Math.random() * 2000));
        setMessages(prev => prev.map(m =>
            m.senderId === user?.email && m.status === 'delivered'
                ? { ...m, status: 'seen' } : m
        ));

        // Pre-delay (simulate human thinking)
        await new Promise(r => setTimeout(r, preDelay));

        // Change status to "online" when about to type
        setOnlineStatus({ status: 'online', text: 'Online now' });

        // Show typing indicator
        setIsTyping(true);

        // Wait typing duration
        await new Promise(r => setTimeout(r, typingDelay));

        // Send the AI response
        setIsTyping(false);
        const replyMsg = await sendChatMessage(conversationId, response.text);
        if (replyMsg) {
            replyMsg.senderId = 'match';
            replyMsg.senderName = conversation?.matchName || 'Match';
            replyMsg.status = 'seen';
            setMessages(prev => [...prev, replyMsg]);
        }

        // Track reply count
        const newCount = incrementReplyCount(conversationId);

        // Lock chat after max replies
        if (newCount >= MAX_FREE_REPLIES) {
            setChatLocked(true);
        }
    }, [conversationId, conversation, user, sendChatMessage]);

    // ---- Send Message ----
    const handleSend = async () => {
        if (!inputText.trim() || sending || chatLocked) return;
        const rawText = inputText.trim();
        setInputText('');
        setSending(true);

        // Content filter
        const { filtered, wasBlocked, blockType } = filterContent(rawText);

        if (wasBlocked) {
            // Show warning
            setShowWarning(getBlockWarning(blockType));
            setTimeout(() => setShowWarning(null), 6000);

            // Send the filtered version (with [Contact hidden])
            const msg = await sendChatMessage(conversationId, filtered);
            if (msg) {
                setMessages(prev => [...prev, msg]);
            }
            setSending(false);
            inputRef.current?.focus();

            // AI responds to blocked content with contact_request response
            triggerAIReply(rawText);
            return;
        }

        try {
            const msg = await sendChatMessage(conversationId, rawText);
            if (msg) {
                setMessages(prev => [...prev, msg]);
            }

            // Trigger AI reply
            triggerAIReply(rawText);
        } catch { } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // ---- Remaining replies indicator ----
    const repliesUsed = getReplyCount(conversationId);
    const repliesLeft = Math.max(0, MAX_FREE_REPLIES - repliesUsed);

    if (!conversation) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-4">
                <p className="text-text-muted">Conversation not found</p>
                <button onClick={() => router.back()} className="px-6 py-3 rounded-2xl gradient-primary text-white font-semibold text-sm">Go Back</button>
            </div>
        );
    }

    const approvalUrl = getApprovalUrl(user?.display_name || user?.email?.split('@')[0] || '');

    return (
        <div className="flex flex-col h-[100dvh]" style={{ background: 'var(--color-bg-dark)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
                <button onClick={() => router.back()} className="p-1">
                    <ArrowLeft size={22} className="text-text-primary" />
                </button>
                <div className="relative w-10 h-10 rounded-full overflow-hidden bg-surface shrink-0">
                    {conversation.matchImage ? (
                        <img src={conversation.matchImage} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer"
                            onError={(e) => { e.target.style.display = 'none'; }} />
                    ) : (
                        <UserAvatar name={conversation.matchName} size={40} />
                    )}
                    {/* Online dot */}
                    {onlineStatus.status === 'online' && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-success border-2 border-white" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <h2 className="text-sm font-bold text-text-primary truncate">{conversation.matchName}</h2>
                        <VerifiedBadge size={14} verified={true} />
                    </div>
                    <p className={`text-[10px] font-medium ${isTyping ? 'text-primary' : onlineStatus.status === 'online' ? 'text-success' : 'text-text-muted'}`}>
                        {isTyping ? 'Typing…' : onlineStatus.text}
                    </p>
                </div>
                {/* Call icons (premium locked) */}
                <div className="flex items-center gap-2">
                    <button className="relative p-2 rounded-full" style={{ background: 'var(--color-surface)' }} title="Premium feature">
                        <Phone size={16} className="text-text-muted" />
                        <Lock size={8} className="absolute -top-0.5 -right-0.5 text-gold" />
                    </button>
                    <button className="relative p-2 rounded-full" style={{ background: 'var(--color-surface)' }} title="Premium feature">
                        <Video size={16} className="text-text-muted" />
                        <Lock size={8} className="absolute -top-0.5 -right-0.5 text-gold" />
                    </button>
                </div>
            </div>

            {/* Content Warning Banner */}
            <AnimatePresence>
                {showWarning && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="flex items-start gap-2 px-4 py-3" style={{ background: 'rgba(234,88,12,0.1)' }}>
                            <AlertTriangle size={16} className="text-primary shrink-0 mt-0.5" />
                            <p className="text-xs text-primary leading-relaxed">{showWarning}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {loading ? (
                    <div className="flex items-center justify-center py-10">
                        <div className="w-8 h-8 rounded-full border-3 border-primary/20 border-t-primary animate-spin" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-10 space-y-3">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                            <MessageCircle size={24} className="text-primary" />
                        </div>
                        <p className="text-sm text-text-muted">Say hi to {conversation.matchName}!</p>
                        <p className="text-xs text-text-muted">Start the conversation with a friendly message.</p>
                    </div>
                ) : (
                    messages.map((msg, idx) => {
                        const isMe = msg.senderId === user?.email;
                        const showAvatar = !isMe && (idx === 0 || messages[idx - 1]?.senderId === user?.email);
                        return (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ duration: 0.25 }}
                                className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2`}
                            >
                                {!isMe && showAvatar && (
                                    <div className="w-7 h-7 rounded-full overflow-hidden bg-surface shrink-0 mt-auto">
                                        {conversation.matchImage ? (
                                            <img src={conversation.matchImage} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        ) : (
                                            <UserAvatar name={conversation.matchName} size={28} />
                                        )}
                                    </div>
                                )}
                                {!isMe && !showAvatar && <div className="w-7 shrink-0" />}
                                <div className={`max-w-[78%] ${isMe ? 'order-1' : ''}`}>
                                    <div
                                        className={`px-4 py-2.5 text-sm leading-relaxed ${isMe
                                            ? 'rounded-2xl rounded-br-md text-white gradient-primary'
                                            : 'rounded-2xl rounded-bl-md text-text-primary'
                                            }`}
                                        style={!isMe ? { background: 'var(--color-bg-card)', border: 'var(--card-border)' } : {}}
                                    >
                                        {msg.text}
                                    </div>
                                    <div className={`flex items-center gap-1 mt-0.5 ${isMe ? 'justify-end' : ''}`}>
                                        <span className="text-[9px] text-text-muted">
                                            {formatMsgTime(msg.timestamp)}
                                        </span>
                                        {isMe && (
                                            <span className="text-[9px]">
                                                {msg.status === 'seen' ? (
                                                    <CheckCheck size={12} className="text-primary" />
                                                ) : msg.status === 'delivered' ? (
                                                    <CheckCheck size={12} className="text-text-muted" />
                                                ) : (
                                                    <Check size={12} className="text-text-muted" />
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })
                )}

                {/* Typing Indicator */}
                <AnimatePresence>
                    {isTyping && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="flex justify-start gap-2"
                        >
                            <div className="w-7 h-7 rounded-full overflow-hidden bg-surface shrink-0 mt-auto">
                                {conversation.matchImage ? (
                                    <img src={conversation.matchImage} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                    <UserAvatar name={conversation.matchName} size={28} />
                                )}
                            </div>
                            <div className="px-4 py-3 rounded-2xl rounded-bl-md" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                                <div className="flex items-center gap-1">
                                    {[0, 1, 2].map(i => (
                                        <div
                                            key={i}
                                            className="w-2 h-2 rounded-full bg-text-muted animate-bounce"
                                            style={{ animationDelay: `${i * 0.2}s`, animationDuration: '0.8s' }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div ref={messagesEndRef} />
            </div>

            {/* Chat Locked Banner */}
            {chatLocked && (
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="px-4 py-4 space-y-3 border-t"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}
                >
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center">
                            <Lock size={16} className="text-gold" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs font-bold text-text-primary">Chat limit reached</p>
                            <p className="text-[10px] text-text-muted">Choose an option below to continue chatting</p>
                        </div>
                    </div>

                    {/* Option 1: Admin Approval */}
                    <a
                        href={approvalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-white gradient-primary text-sm active:scale-95 transition-transform"
                    >
                        <Shield size={16} /> Request Connection Approval
                    </a>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-black/10" />
                        <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">or</span>
                        <div className="flex-1 h-px bg-black/10" />
                    </div>

                    {/* Option 2: Membership Upgrade */}
                    <a
                        href="/subscribe"
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm border-2 border-gold text-gold hover:bg-gold/5 active:scale-95 transition-all"
                    >
                        <Crown size={16} /> Upgrade Membership
                    </a>
                    <p className="text-[10px] text-text-muted text-center">
                        🌟 Premium members get <strong>unlimited chat</strong>, voice notes, priority matches & more
                    </p>
                </motion.div>
            )}

            {/* Input Area (hidden when locked) */}
            {!chatLocked && (
                <div className="px-3 py-2 border-t flex items-end gap-2" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
                    {/* Voice note button (premium locked) */}
                    <button className="relative w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--color-surface)' }} title="Premium feature">
                        <Mic size={16} className="text-text-muted" />
                        <Lock size={7} className="absolute -top-0.5 -right-0.5 text-gold" />
                    </button>
                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a message..."
                            rows={1}
                            className="w-full py-2.5 px-4 rounded-2xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none max-h-24"
                            style={{ background: 'var(--color-surface)' }}
                        />
                    </div>
                    <button
                        onClick={handleSend}
                        disabled={!inputText.trim() || sending || isTyping}
                        className="w-10 h-10 rounded-full flex items-center justify-center gradient-primary text-white shrink-0 transition-all disabled:opacity-40 active:scale-90"
                    >
                        <Send size={18} />
                    </button>
                </div>
            )}

            {/* Remaining replies indicator */}
            {!chatLocked && repliesUsed > 0 && (
                <div className="px-4 pb-1 text-center" style={{ background: 'var(--color-bg-card)' }}>
                    <p className="text-[9px] text-text-muted">
                        {repliesLeft > 0
                            ? `${repliesLeft} free ${repliesLeft === 1 ? 'reply' : 'replies'} remaining`
                            : 'Last free reply used'
                        }
                        {' · '}
                        <a href="/subscribe" className="text-primary font-medium">Upgrade for unlimited</a>
                    </p>
                </div>
            )}
        </div>
    );
}

function formatMsgTime(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now - date;

    if (diffMs < 60000) return 'now';
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m`;

    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
        return date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    }

    return date.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
}
