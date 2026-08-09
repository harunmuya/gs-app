import Link from 'next/link';
import SupportContact from '@/components/SupportContact';

/**
 * The shell every policy and explainer page shares.
 *
 * Each of these pages previously repeated its own container, back link, heading
 * and date stamp, so they drifted: different max widths, different back
 * destinations, and some with no way to reach support at the end. A member who
 * has just read a rule they disagree with is exactly the person who needs the
 * support block, and it was the pages most likely to raise a question that
 * lacked it.
 */
export default function PolicyPage({ title, updated, intro, children, backHref = '/profile', backLabel = 'Back to account' }) {
    return (
        <main className="min-h-dvh px-5 py-8 app-shell">
            <div className="mx-auto max-w-2xl space-y-5">
                <section className="space-y-4 rounded-2xl p-5" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                    <Link href={backHref} className="inline-block type-caption font-semibold text-primary">{backLabel}</Link>
                    <div>
                        <h1 className="type-display text-text-primary">{title}</h1>
                        {updated && <p className="mt-1 type-micro text-text-muted">Last updated {updated}</p>}
                    </div>
                    {intro && <p className="type-body text-text-secondary">{intro}</p>}
                    <div className="space-y-4 type-body text-text-secondary">{children}</div>
                </section>

                <SupportContact />
            </div>
        </main>
    );
}

/** A numbered section heading, so the pages read consistently. */
export function Section({ n, title, children }) {
    return (
        <section className="space-y-2 pt-2">
            <h2 className="type-title text-text-primary">{n ? `${n}. ` : ''}{title}</h2>
            {children}
        </section>
    );
}

/** A short list where each item is a rule rather than a sentence fragment. */
export function Rules({ items }) {
    return (
        <ul className="space-y-2">
            {items.map((item) => (
                <li key={item} className="flex gap-2.5">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--color-primary)' }} />
                    <span className="min-w-0">{item}</span>
                </li>
            ))}
        </ul>
    );
}
