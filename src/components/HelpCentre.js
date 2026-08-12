'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    ArrowLeft, ArrowRight, Check, ChevronRight, Headphones, Loader2, Send, X,
} from '@/components/icons';
import { useAuth } from '@/contexts/AuthContext';
import { HELP_SHORTCUTS, HELP_TOPICS } from '@/lib/helpTopics';
import { SUPPORT } from '@/lib/support';

/**
 * Help, wherever the member is standing.
 *
 * The floating button used to open a list of four contact channels. That hands
 * every question to Admin Mary G, including the ones with a fixed answer, and
 * makes the member wait for a reply to something they could have settled in ten
 * seconds. It also buries the two things they most often want, which are the
 * package list and the wallet.
 *
 * It works the way a live chat does now. Pick what is wrong, read the answer,
 * and only if that does not settle it does it become a ticket or a Telegram
 * message. The ticket goes through the same endpoint as the profile menu, so it
 * is routed to the right team and auto answered exactly as it was before.
 *
 * Three views, one sheet:
 *
 *   menu      shortcuts, then the topics
 *   topic     the answer, then "that solved it" or "I still need help"
 *   escalate  the ticket form, with Telegram beside it for anyone in a hurry
 */

/*
  Screens this stays off. A call and a live room are full screen and already
  carry their own controls near the thumb; a floating button there would sit
  over the video and compete with End Call.
*/
const IMMERSIVE = [/^\/calls\//, /^\/live\/[^/]+$/];

function Header({ title, onBack, onClose }) {
    return (
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: 'var(--card-border)' }}>
            {onBack ? (
                <button type="button" onClick={onBack} aria-label="Back" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-secondary">
                    <ArrowLeft size={18} />
                </button>
            ) : (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full tint-primary">
                    <Headphones size={18} className="text-primary" />
                </span>
            )}
            <h2 className="min-w-0 flex-1 truncate type-title text-text-primary">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close help" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-secondary">
                <X size={18} />
            </button>
        </div>
    );
}

export default function HelpCentre() {
    const pathname = usePathname() || '';
    const { user } = useAuth();

    const [open, setOpen] = useState(false);
    const [view, setView] = useState('menu');
    const [topic, setTopic] = useState(null);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(null);
    const [error, setError] = useState('');

    // Close on route change, so help never follows the member to the next screen.
    useEffect(() => { setOpen(false); }, [pathname]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    // Reset to the menu whenever it is reopened. Landing back inside a half
    // written ticket from twenty minutes ago is disorienting.
    useEffect(() => {
        if (open) return;
        setView('menu');
        setTopic(null);
        setMessage('');
        setSent(null);
        setError('');
    }, [open]);

    if (IMMERSIVE.some((pattern) => pattern.test(pathname))) return null;

    function openTopic(next) {
        setTopic(next);
        setView('topic');
    }

    async function submitTicket(event) {
        event.preventDefault();
        if (message.trim().length < 3 || sending) return;
        setSending(true);
        setError('');
        try {
            const res = await fetch('/api/members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'support_ticket',
                    memberId: user?.id || null,
                    email: user?.email || '',
                    display_name: user?.display_name || '',
                    service: topic?.service || 'general',
                    subject: topic?.subject || 'Support request',
                    message: message.trim(),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { setError(data.error || 'That did not send. Try Telegram below.'); return; }
            setSent(data.autoResponse || { title: 'Support request received', body: 'Somebody will reply in your inbox and by email.' });
        } catch {
            setError('That did not send. Check your connection, or use Telegram below.');
        } finally {
            setSending(false);
        }
    }

    const title = view === 'menu' ? 'How can we help'
        : view === 'topic' ? topic?.label || 'Help'
            : 'Send it to support';

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Get help"
                className="fixed bottom-24 right-4 z-40 flex h-14 items-center gap-2 rounded-full px-4 shadow-lg"
                style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}
            >
                <Headphones size={20} className="text-primary" />
                <span className="type-caption font-semibold text-text-primary">Help</span>
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
                    <button type="button" aria-label="Close help" onClick={() => setOpen(false)} className="absolute inset-0 cursor-default" />

                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Help"
                        className="relative flex w-full max-w-md flex-col overflow-hidden rounded-3xl"
                        style={{ maxHeight: '85dvh', background: 'var(--color-bg-card)' }}
                    >
                        <Header
                            title={title}
                            onBack={view === 'menu' ? null : () => { setView(view === 'escalate' ? 'topic' : 'menu'); setSent(null); setError(''); }}
                            onClose={() => setOpen(false)}
                        />

                        <div className="min-h-0 flex-1 overflow-auto p-4">
                            {view === 'menu' && (
                                <>
                                    {/* The two things people open this for most often, before
                                        they have to read anything. */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {HELP_SHORTCUTS.map((item) => (
                                            <Link
                                                key={item.id}
                                                href={item.href}
                                                onClick={() => setOpen(false)}
                                                className="flex min-h-[64px] flex-col justify-center rounded-2xl px-3 py-2"
                                                style={{ background: 'var(--color-surface)' }}
                                            >
                                                <span className="type-body-strong text-text-primary">{item.label}</span>
                                                <span className="type-caption text-text-muted">{item.hint}</span>
                                            </Link>
                                        ))}
                                    </div>

                                    <p className="mt-5 mb-2 type-caption font-semibold text-text-muted">What do you need help with</p>
                                    <div className="space-y-1.5">
                                        {HELP_TOPICS.map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => openTopic(item)}
                                                className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-3 py-2 text-left"
                                                style={{ background: 'var(--color-surface)' }}
                                            >
                                                <span className="min-w-0 flex-1">
                                                    <span className="block type-body-strong text-text-primary">{item.label}</span>
                                                    <span className="block type-caption text-text-muted">{item.blurb}</span>
                                                </span>
                                                <ChevronRight size={16} className="shrink-0 text-text-muted" />
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}

                            {view === 'topic' && topic && (
                                <>
                                    <ol className="space-y-3">
                                        {topic.steps.map((step, index) => (
                                            <li key={step} className="flex gap-3">
                                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full tint-primary type-micro font-bold text-primary">
                                                    {index + 1}
                                                </span>
                                                <span className="min-w-0 type-body text-text-secondary">{step}</span>
                                            </li>
                                        ))}
                                    </ol>

                                    <div className="mt-5 space-y-2">
                                        {topic.resolveHref && (
                                            <Link
                                                href={topic.resolveHref}
                                                onClick={() => setOpen(false)}
                                                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl type-body-strong text-white gradient-primary"
                                            >
                                                {topic.resolveLabel} <ArrowRight size={16} />
                                            </Link>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setView('escalate')}
                                            className="flex min-h-12 w-full items-center justify-center rounded-2xl type-body-strong text-text-primary"
                                            style={{ background: 'var(--color-surface)' }}
                                        >
                                            This did not solve it
                                        </button>
                                    </div>
                                </>
                            )}

                            {view === 'escalate' && (
                                sent ? (
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3 rounded-2xl p-3 tint-success">
                                            <Check size={18} className="mt-0.5 shrink-0 text-success" />
                                            <div className="min-w-0">
                                                <p className="type-body-strong text-text-primary">{sent.title}</p>
                                                {sent.team && <p className="type-caption text-text-muted">Handled by the {sent.team}</p>}
                                            </div>
                                        </div>
                                        <p className="whitespace-pre-line type-body text-text-secondary">{sent.body}</p>
                                        <button
                                            type="button"
                                            onClick={() => setOpen(false)}
                                            className="min-h-12 w-full rounded-2xl type-body-strong text-white gradient-primary"
                                        >
                                            Done
                                        </button>
                                    </div>
                                ) : (
                                    <form onSubmit={submitTicket} className="space-y-3">
                                        {topic?.escalateHint && (
                                            <p className="type-caption text-text-muted">{topic.escalateHint}</p>
                                        )}
                                        <textarea
                                            value={message}
                                            onChange={(event) => setMessage(event.target.value)}
                                            rows={5}
                                            maxLength={1200}
                                            placeholder="What happened, and what you were trying to do."
                                            className="w-full rounded-2xl p-3 type-body text-text-primary"
                                            style={{ background: 'var(--color-bg-input)', border: '1px solid rgba(20,16,26,0.10)' }}
                                        />
                                        {error && <p className="type-caption text-danger" role="alert">{error}</p>}

                                        <button
                                            type="submit"
                                            disabled={sending || message.trim().length < 3}
                                            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl type-body-strong text-white gradient-primary disabled:opacity-60"
                                        >
                                            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                            {sending ? 'Sending' : 'Send to support'}
                                        </button>

                                        {/* Beside the form, not after it. Somebody who has just been
                                            told to wait for a reply wants the option that does not
                                            involve waiting. */}
                                        <a
                                            href={SUPPORT.telegram.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl type-body-strong text-text-primary"
                                            style={{ background: 'var(--color-surface)' }}
                                        >
                                            Message Admin Mary G now
                                        </a>
                                        <p className="type-micro text-text-muted">
                                            We never ask for your PIN, your password, or a payment to a personal number that did not
                                            come from this app.
                                        </p>
                                    </form>
                                )
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
