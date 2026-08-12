import Link from 'next/link';
import SupportContact from '@/components/SupportContact';
import PolicyBackLink from '@/components/PolicyBackLink';

export const metadata = {
    title: 'Contact Support | Genuine Sugar Mummies',
    description: 'Reach Admin Mary G about verification, packages, payments, or a profile you want reported.',
};

/**
 * The page a locked out member lands on.
 *
 * It used to say that support details are "shown inside the app" and offer a
 * button back to the login screen. Anyone who cannot sign in is exactly the
 * person reading this page, so it sent them in a circle. The channels are on
 * the page now, and the note about what to include is above them, because the
 * commonest reason a support message goes slowly is that it arrives without
 * the account email on it.
 */

const BEFORE_YOU_WRITE = [
    'The email address on your GS account, exactly as you typed it when you signed up.',
    'For a payment or package question, the M-Pesa reference and the package you chose.',
    'For a verification question, the date you submitted your photo.',
    'For a report, the profile name or the link to the profile, and what happened.',
];

export default function ContactPage() {
    return (
        <main className="min-h-dvh app-shell px-5 py-8">
            <div className="mx-auto max-w-2xl space-y-5">
                <PolicyBackLink />

                <header>
                    <h1 className="type-display text-text-primary">Contact support</h1>
                    <p className="mt-2 type-body text-text-secondary">
                        Admin Mary G handles verification, packages, payments and reports in person. You do not need
                        to be signed in to get a reply.
                    </p>
                </header>

                <section
                    className="rounded-2xl p-5"
                    style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}
                >
                    <h2 className="type-title text-text-primary">What to include</h2>
                    <ul className="mt-3 space-y-2">
                        {BEFORE_YOU_WRITE.map((item) => (
                            <li key={item} className="flex gap-2.5 type-body text-text-secondary">
                                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </section>

                <SupportContact title="Ways to reach us" />

                <section
                    className="rounded-2xl p-5"
                    style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}
                >
                    <h2 className="type-title text-text-primary">If you are already signed in</h2>
                    <p className="mt-2 type-body text-text-secondary">
                        Open Profile, then Support. A ticket raised there is attached to your account, so whoever
                        picks it up can already see your package, your verification status and your payment history
                        without asking you for any of it.
                    </p>
                    <Link
                        href="/auth/login"
                        className="mt-4 inline-flex min-h-12 items-center rounded-2xl px-5 type-body-strong text-white gradient-primary"
                    >
                        Sign in
                    </Link>
                </section>
            </div>
        </main>
    );
}
