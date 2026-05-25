'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, LifeBuoy, Send, ChevronDown, CheckCircle, MessageSquare, RefreshCw } from 'lucide-react';

const CATEGORIES = [
    { value: 'payment', label: 'Payment Issue' },
    { value: 'account', label: 'Account Problem' },
    { value: 'verification', label: 'Verification Help' },
    { value: 'technical', label: 'Technical Issue' },
    { value: 'other', label: 'Other' },
];

const STATUS_CONFIG = {
    open: { label: 'Open', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    in_progress: { label: 'In Progress', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
    resolved: { label: 'Resolved', color: '#37B24D', bg: 'rgba(55,178,77,0.12)' },
    closed: { label: 'Closed', color: '#6C757D', bg: 'rgba(108,117,125,0.12)' },
};

function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function SupportPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [category, setCategory] = useState('payment');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [tickets, setTickets] = useState([]);
    const [loadingTickets, setLoadingTickets] = useState(true);
    const [activeTab, setActiveTab] = useState('new');

    const fetchTickets = async () => {
        if (!user?.id) return;
        setLoadingTickets(true);
        try {
            const res = await fetch(`/api/support?userId=${user.id}`);
            const data = await res.json();
            setTickets(data.tickets || []);
        } catch {}
        setLoadingTickets(false);
    };

    useEffect(() => { fetchTickets(); }, [user?.id]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!subject.trim()) { setError('Please enter a subject'); return; }
        if (message.trim().length < 20) { setError('Please describe your issue in at least 20 characters'); return; }
        setSubmitting(true);
        try {
            const res = await fetch('/api/support', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user?.id, category, subject: subject.trim(), message: message.trim() }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Failed to submit. Please try again.'); return; }
            setSubmitted(true);
            setSubject('');
            setMessage('');
            await fetchTickets();
            setTimeout(() => setActiveTab('history'), 1500);
        } catch { setError('Network error. Please try again.'); }
        finally { setSubmitting(false); }
    };

    return (
        <div className="min-h-dvh bg-bg pb-24">
            <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-border" style={{ background: 'var(--color-bg)', backdropFilter: 'blur(20px)' }}>
                <button onClick={() => router.back()} className="p-2 rounded-xl bg-bg-secondary border border-border active:scale-95 transition-transform">
                    <ArrowLeft size={18} className="text-text-primary" />
                </button>
                <div className="flex items-center gap-2">
                    <LifeBuoy size={20} className="text-primary" />
                    <h1 className="text-lg font-black text-text-primary">Support</h1>
                </div>
            </div>

            <div className="px-4 pt-4 space-y-4">
                <div className="flex rounded-2xl p-1 bg-surface">
                    <button onClick={() => { setActiveTab('new'); setSubmitted(false); }} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'new' ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-muted'}`}>
                        New Ticket
                    </button>
                    <button onClick={() => setActiveTab('history')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'history' ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-muted'}`}>
                        My Tickets {tickets.length > 0 && <span className="text-[10px] font-black text-white bg-primary rounded-full w-4 h-4 flex items-center justify-center">{tickets.length}</span>}
                    </button>
                </div>

                <AnimatePresence mode="wait">
                    {activeTab === 'new' && (
                        <motion.div key="new" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                            {submitted ? (
                                <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
                                    <div className="w-16 h-16 rounded-full bg-success/15 border border-success/30 flex items-center justify-center">
                                        <CheckCircle size={32} className="text-success" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-text-primary mb-1">Ticket Submitted!</h3>
                                        <p className="text-sm text-text-secondary">Our team will respond within 24 hours. Check your notifications for updates.</p>
                                    </div>
                                    <button onClick={() => setSubmitted(false)} className="px-6 py-3 rounded-2xl gradient-primary text-white font-bold text-sm">Submit Another</button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-text-primary pl-1">Category</label>
                                        <div className="relative">
                                            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full py-3.5 px-4 rounded-2xl bg-bg-input text-text-primary border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm appearance-none">
                                                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                            </select>
                                            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-text-primary pl-1">Subject</label>
                                        <input type="text" placeholder="Brief description of your issue" value={subject} onChange={e => setSubject(e.target.value)} maxLength={120} className="w-full py-3.5 px-4 rounded-2xl bg-bg-input text-text-primary placeholder:text-text-secondary border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-text-primary pl-1">Describe Your Issue</label>
                                        <textarea placeholder="Please provide as much detail as possible..." value={message} onChange={e => setMessage(e.target.value)} rows={5} maxLength={1000} className="w-full py-3.5 px-4 rounded-2xl bg-bg-input text-text-primary placeholder:text-text-secondary border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm resize-none" />
                                        <p className="text-[10px] text-text-muted text-right">{message.length}/1000</p>
                                    </div>
                                    {error && <p className="text-xs text-center text-white bg-danger/90 rounded-xl py-2.5 px-4">{error}</p>}
                                    <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white gradient-primary shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-60 text-sm">
                                        {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={16} />}
                                        {submitting ? 'Submitting...' : 'Submit Ticket'}
                                    </button>
                                    <p className="text-center text-[10px] text-text-muted">
                                        For urgent payment issues, contact Admin Mary on{' '}
                                        <a href="https://t.me/GSADMINMARYGAGENCY" className="text-primary font-semibold">Telegram</a>
                                    </p>
                                </form>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'history' && (
                        <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-text-muted">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</p>
                                <button onClick={fetchTickets} disabled={loadingTickets} className="p-1.5 rounded-lg bg-surface">
                                    <RefreshCw size={14} className={`text-text-muted ${loadingTickets ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                            {loadingTickets ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : tickets.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center">
                                    <MessageSquare size={40} className="text-text-muted" />
                                    <p className="text-sm text-text-secondary">No tickets yet. Submit one if you need help!</p>
                                </div>
                            ) : (
                                tickets.map((ticket, idx) => {
                                    const st = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                                    return (
                                        <motion.div key={ticket.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                                            className="p-4 rounded-2xl border border-border bg-bg-card space-y-2.5">
                                            <div className="flex items-start justify-between gap-2">
                                                <h4 className="text-sm font-bold text-text-primary flex-1">{ticket.subject}</h4>
                                                <span className="text-[10px] font-bold px-2 py-1 rounded-full shrink-0" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                                            </div>
                                            <p className="text-xs text-text-secondary line-clamp-2">{ticket.message}</p>
                                            {ticket.admin_reply && (
                                                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                                                    <p className="text-[10px] font-bold text-primary mb-1">GS Support replied:</p>
                                                    <p className="text-xs text-text-primary">{ticket.admin_reply}</p>
                                                </div>
                                            )}
                                            <p className="text-[10px] text-text-muted">{formatDate(ticket.created_at)}</p>
                                        </motion.div>
                                    );
                                })
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
