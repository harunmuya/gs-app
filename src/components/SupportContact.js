'use client';

import Link from 'next/link';
import { Headphones, Mail, MessageCircle, Send } from '@/components/icons';
import { SUPPORT } from '@/lib/support';

/**
 * One place that knows how to reach Admin Mary G.
 *
 * The Telegram handle was written into six files by hand, so changing it meant
 * finding all six, and any page that forgot to include it left the member with
 * a policy they disagreed with and no way to ask about it. Support that is hard
 * to find reads as support that does not exist.
 *
 * Every channel lives here. Change it once and every page follows.
 */

// The channels themselves live in lib so the server can use them too.
export { SUPPORT } from '@/lib/support';

const ICONS = { telegram: Send, whatsapp: MessageCircle, email: Mail, sms: MessageCircle };

/**
 * The support block that closes every policy page.
 *
 * `compact` renders a single line for a footer; the full version lists the
 * channels with what each is best for, because "contact us" without saying
 * which channel is fastest just moves the decision onto the member.
 */
export default function SupportContact({ compact = false, title = 'Still need help', className = '' }) {
    if (compact) {
        return (
            <p className={`type-caption text-text-muted ${className}`}>
                Questions about this page?{' '}
                <a href={SUPPORT.telegram.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary">
                    Message Admin Mary G on Telegram
                </a>{' '}
                or <Link href="/contact" className="font-semibold text-primary">open a support ticket</Link>.
            </p>
        );
    }

    return (
        <section className={`rounded-2xl p-5 ${className}`} style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
            <h2 className="flex items-center gap-2 type-title text-text-primary">
                <Headphones size={18} className="text-primary" /> {title}
            </h2>
            <p className="mt-1.5 type-caption text-text-secondary">
                Admin Mary G handles verification, payments and reports personally. Pick whichever suits you.
            </p>

            <div className="mt-4 space-y-2">
                {Object.entries(SUPPORT).map(([key, channel]) => {
                    const Icon = ICONS[key] || Headphones;
                    return (
                        <a
                            key={key}
                            href={channel.url}
                            target={channel.url.startsWith('http') ? '_blank' : undefined}
                            rel={channel.url.startsWith('http') ? 'noopener noreferrer' : undefined}
                            className="flex min-h-[56px] items-center gap-3 rounded-xl p-3"
                            style={{ background: 'var(--color-surface)' }}
                        >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl tint-primary">
                                <Icon size={16} className="text-primary" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block type-body-strong text-text-primary">{channel.label}</span>
                                <span className="block type-caption text-text-muted">{channel.detail}</span>
                            </span>
                            <span className="shrink-0 type-caption font-semibold text-primary">
                                {channel.handle ? `@${channel.handle}` : channel.number || 'Open'}
                            </span>
                        </a>
                    );
                })}
            </div>

            <p className="mt-3 type-micro text-text-muted">
                We never ask for your PIN, your password, or a payment to a personal number that did not come from
                this app. Anyone who does is not from Genuine Sugar Mummies.
            </p>
        </section>
    );
}
