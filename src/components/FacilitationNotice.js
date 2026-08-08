'use client';

import Link from 'next/link';
import { Ban, Headphones, MessageCircle, ShieldCheck } from '@/components/icons';

/**
 * The red block shown on profiles that have no account behind them.
 *
 * Seeded and WordPress-imported profiles are listings, not members: nobody is
 * signed in to receive a message, so a sent message would go nowhere. The app
 * already refused to deliver, but it refused *after* the tap, with a grey icon
 * and a sentence at the bottom of the page — so the member found out by trying.
 *
 * This states it before the attempt, in red, near the actions. The message icon
 * stays where it is: removing it would make these profiles look broken rather
 * than different, and the icon is what tells you the action exists at all.
 *
 * Being explicit here is also the honest thing. A member paying for Silver
 * partly to message people is entitled to know which profiles that buys access
 * to before they spend.
 *
 * Colours come from the tint utilities rather than inline rgba, so the panel
 * keeps its background in the dark theme — see globals.css.
 */
export default function FacilitationNotice({ member, className = '', compact = false }) {
    const label = member?.facilitationLabel || 'Facilitation Required';

    if (compact) {
        return (
            <div className={`tint-danger border-danger-soft flex items-start gap-2 rounded-xl px-3 py-2 ${className}`} role="note">
                <Ban size={14} className="mt-0.5 shrink-0 text-danger" />
                <p className="type-caption font-semibold text-danger">
                    Direct messages are off for this listing — only verified members can be texted.
                </p>
            </div>
        );
    }

    return (
        <section
            className={`border-danger-soft tint-danger overflow-hidden rounded-2xl ${className}`}
            role="note"
            aria-label="Direct messaging unavailable"
        >
            <div className="tint-danger-strong flex items-center gap-2 px-4 py-2.5">
                <Ban size={15} className="shrink-0 text-danger" />
                <h2 className="type-body-strong text-danger">You cannot text this profile</h2>
            </div>

            <div className="space-y-3 p-4">
                <p className="type-body text-text-secondary">
                    This is a <strong className="text-text-primary">{label.toLowerCase()}</strong> listing, not a member
                    account. Nobody is signed in behind it, so a message, call or gift sent here would not reach anyone.
                </p>

                <div className="space-y-2">
                    <p className="flex items-start gap-2 type-caption text-text-secondary">
                        <MessageCircle size={14} className="mt-0.5 shrink-0 text-danger" />
                        <span>Messaging, voice and video are available on <strong className="text-text-primary">verified member profiles only</strong>.</span>
                    </p>
                    <p className="flex items-start gap-2 type-caption text-text-secondary">
                        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-success" />
                        <span>Member profiles carry a verified badge and show a real last-seen time.</span>
                    </p>
                </div>

                <Link
                    href="/contact"
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl type-body-strong text-white gradient-primary"
                >
                    <Headphones size={16} /> Ask us to arrange an introduction
                </Link>

                <p className="type-micro text-text-muted">
                    Our team contacts the person on your behalf. We never charge to pass on a first message.
                </p>
            </div>
        </section>
    );
}
