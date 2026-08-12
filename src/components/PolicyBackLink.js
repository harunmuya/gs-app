'use client';

import Link from 'next/link';
import { ArrowLeft } from '@/components/icons';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Back, to wherever the reader actually came from.
 *
 * These pages are reachable from two places: the legal row under the sign in
 * form, and the menu inside a member's own account. They were written for the
 * first and said "Back to login" regardless, so a signed in member who opened
 * Safety Centre from their profile menu was offered a link out of their own
 * account. Tapping it landed them on the sign in screen, which then bounced
 * them to Discover, so they lost their place and had no idea why.
 *
 * The destination follows the reader. Signed in goes back to the account;
 * signed out goes back to sign in.
 *
 * `loading` is treated as signed out on purpose. The auth check resolves in a
 * moment and the label settles; guessing "account" first would flash a link
 * that a signed out reader cannot use.
 */
export default function PolicyBackLink() {
    const { user, loading } = useAuth();
    const signedIn = Boolean(user?.id) && !loading;

    return (
        <Link
            href={signedIn ? '/profile' : '/auth/login'}
            className="inline-flex min-h-11 items-center gap-1.5 type-caption font-semibold text-primary"
        >
            <ArrowLeft size={14} />
            {signedIn ? 'Back to my account' : 'Back to sign in'}
        </Link>
    );
}
