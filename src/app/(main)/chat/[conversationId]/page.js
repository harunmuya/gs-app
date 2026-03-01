'use client';

import { useState, useEffect, useRef, use } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, Check, CheckCheck, Image, Smile, MoreVertical, Phone, Video } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import UserAvatar from '@/components/UserAvatar';

export default function ChatConversationPage({ params }) {
    const resolvedParams = use(params);
    const conversationId = decodeURIComponent(resolvedParams.conversationId);
    const router = useRouter();
    const { user, conversations, getChatMessages, sendChatMessage, markChatSeen } = useAuth();

    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const conversation = conversations?.find(c => c.id === conversationId);

    // Load messages
    useEffect(() => {
        async function load() {
            try {
                const msgs = await getChatMessages(conversationId);
                setMessages(msgs || []);
                await markChatSeen(conversationId);
            } catch (err) {
                console.error('Failed to load messages:', err);
            } finally {
                setLoading(false);
            }
        }
        if (conversationId) load();
    }, [conversationId, getChatMessages, markChatSeen]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Simulate typing/reply from match
    useEffect(() => {
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg.senderId === user?.email) {
                // Simulate "delivered" after 1s
                const t1 = setTimeout(() => {
                    setMessages(prev => prev.map(m =>
                        m.id === lastMsg.id ? { ...m, status: 'delivered' } : m
                    ));
                }, 1000);

                // Simulate "seen" after 3s
                const t2 = setTimeout(() => {
                    setMessages(prev => prev.map(m =>
                        m.id === lastMsg.id ? { ...m, status: 'seen' } : m
                    ));
                }, 3000);

                // Simulate reply after 5-12s
                const t3 = setTimeout(async () => {
                    const replies = getAutoReplies(user?.display_name, conversation?.matchName);
                    const reply = replies[Math.floor(Math.random() * replies.length)];
                    const replyMsg = await sendChatMessage(conversationId, reply);
                    if (replyMsg) {
                        // Override senderId to be the match
                        replyMsg.senderId = 'match';
                        replyMsg.senderName = conversation?.matchName || 'Match';
                        replyMsg.status = 'seen';
                        setMessages(prev => [...prev, replyMsg]);
                    }
                }, 5000 + Math.random() * 7000);

                return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
            }
        }
    }, [messages.length]);

    const handleSend = async () => {
        if (!inputText.trim() || sending) return;
        const text = inputText.trim();
        setInputText('');
        setSending(true);

        try {
            const msg = await sendChatMessage(conversationId, text);
            if (msg) {
                setMessages(prev => [...prev, msg]);
            }
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

    if (!conversation) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-4">
                <p className="text-text-muted">Conversation not found</p>
                <button onClick={() => router.back()} className="px-6 py-3 rounded-2xl gradient-primary text-white font-semibold text-sm">Go Back</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[100dvh] bg-white" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
                <button onClick={() => router.back()} className="p-1">
                    <ArrowLeft size={22} className="text-text-primary" />
                </button>
                <div className="w-10 h-10 rounded-full overflow-hidden bg-surface shrink-0">
                    {conversation.matchImage ? (
                        <img src={conversation.matchImage} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                    ) : (
                        <UserAvatar name={conversation.matchName} size={40} />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold text-text-primary truncate">{conversation.matchName}</h2>
                    <p className="text-[10px] text-success font-medium">Online now</p>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: 'var(--color-bg-dark)' }}>
                {loading ? (
                    <div className="flex items-center justify-center py-10">
                        <div className="w-8 h-8 rounded-full border-3 border-primary/20 border-t-primary animate-spin" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-10 space-y-3">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                            <Send size={24} className="text-primary" />
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
                                transition={{ duration: 0.2 }}
                                className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2`}
                            >
                                {!isMe && showAvatar && (
                                    <div className="w-7 h-7 rounded-full overflow-hidden bg-surface shrink-0 mt-auto">
                                        {conversation.matchImage ? (
                                            <img src={conversation.matchImage} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <UserAvatar name={conversation.matchName} size={28} />
                                        )}
                                    </div>
                                )}
                                {!isMe && !showAvatar && <div className="w-7 shrink-0" />}
                                <div className={`max-w-[75%] ${isMe ? 'order-1' : ''}`}>
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
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-2 border-t flex items-end gap-2" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
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
                    disabled={!inputText.trim() || sending}
                    className="w-10 h-10 rounded-full flex items-center justify-center gradient-primary text-white shrink-0 transition-all disabled:opacity-40 active:scale-90"
                >
                    <Send size={18} />
                </button>
            </div>
        </div>
    );
}

function getAutoReplies(userName, matchName) {
    const name = userName || 'dear';
    return [
        `Hi ${name}! Thanks for messaging me 😊`,
        `Hello! Nice to hear from you. How are you doing?`,
        `Hey ${name}, glad you reached out! Tell me more about yourself.`,
        `Hi there! I saw your profile and you seem interesting 😊`,
        `Thanks for the message! What are you looking for?`,
        `Hey! I'm ${matchName}, nice to connect with you.`,
        `Hello ${name}! What brings you to this app?`,
        `Hi! I'd love to chat more. What do you do?`,
    ];
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
