'use client';

import Link from 'next/link';
import { ArrowRight, Check, HeartHandshake, ShieldCheck } from '@/components/icons';

/**
 * How you reach a profile our team introduced.
 *
 * This used to be a red panel with a Ban icon and the heading "You cannot text
 * this profile", followed by the line "nobody is signed in behind it". Every
 * word of that was true and the whole thing was wrong. Red with a strike
 * through symbol is the language a bank uses for a blocked card and a browser
 * uses for a bad certificate, so a member reading it did not learn "this one
 * works differently", they learned "something here is not right". On a dating
 * product where people are already scanning for scams, that is expensive: it
 * makes the app look like it is warning you about its own listings.
 *
 * The same fact told the other way round is a service, which is what it
 * actually is. Our team arranged this introduction and our team passes the
 * first message on. That is a real thing we do, so it is described as a real
 * thing we do, in the app's own colours, leading with what happens next rather
 * than with what is forbidden.
 *
 * What it must never do is overclaim. It does not say the person is online, it
 * does not invent a reason they prefer introductions, and it does not promise a
 * reply. Reassurance built on something untrue collapses the first time a
 * member notices, and takes the rest of the app's credibility with it.
 */
export default function FacilitationNotice({ member, className = '' }) {
    const name = String(member?.name || '').trim().split(/\s+/)[0];
    const who = name || 'This member';

    return (
        <section
            className={`overflow-hidden rounded-2xl ${className}`}
            style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}
            aria-label="How to reach this profile"
        >
            <div className="flex items-center gap-2.5 px-4 py-3 tint-primary">
                <HeartHandshake size={17} className="shrink-0 text-primary" />
                <h2 className="type-body-strong text-text-primary">Introduced by our team</h2>
            </div>

            <div className="space-y-3.5 p-4">
                <p className="type-body text-text-secondary">
                    {who} is listed with us rather than chatting in the app, so the first message goes through our
                    team instead of straight to an inbox. Tell us you are interested and we pass it on.
                </p>

                {/*
                  Three lines, each one a commitment we can actually keep. The
                  middle one matters most: an introduction with no reply is the
                  outcome people quietly fear, and saying we come back either
                  way is the difference between waiting and being left hanging.
                */}
                <ul className="space-y-2">
                    {[
                        'Passing on a first message is free. You are never charged for an introduction.',
                        'We come back to you either way, including when the answer is no.',
                        'Your number and email stay with us until you decide to share them.',
                    ].map((line) => (
                        <li key={line} className="flex items-start gap-2.5">
                            <Check size={15} className="mt-0.5 shrink-0 text-success" />
                            <span className="min-w-0 type-caption text-text-secondary">{line}</span>
                        </li>
                    ))}
                </ul>

                <Link
                    href="/contact"
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl type-body-strong text-white gradient-primary"
                >
                    Ask for an introduction <ArrowRight size={16} />
                </Link>

                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href="/facilitation" className="inline-flex min-h-11 items-center type-caption font-semibold text-primary">
                        How introductions work
                    </Link>
                    <span className="inline-flex items-center gap-1.5 type-micro text-text-muted">
                        <ShieldCheck size={13} className="text-success" /> Handled by Admin Mary G
                    </span>
                </div>
            </div>
        </section>
    );
}
