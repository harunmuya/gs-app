import PolicyPage, { Section, Rules } from '@/components/PolicyPage';

export const metadata = {
    title: 'Verification | Genuine Sugar Mummies',
    description: 'What the verified badge means, how to get it, and what we do with the photos you send.',
};

/**
 * What verification is and is not.
 *
 * Written plainly because the badge is the main trust signal in the product and
 * members were being asked to send a selfie and an ID to a page that explained
 * neither what happened to those files nor what the badge actually proves.
 */
export default function VerificationPage() {
    return (
        <PolicyPage
            title="Verification"
            updated="9 August 2026"
            intro="The verified badge tells other members that a real person, matching the photos on the profile, has sent us identification. Here is exactly what that involves."
        >
            <Section n="1" title="What the badge proves">
                <p>
                    A verified badge means one thing: we have seen a selfie and a government identity document
                    for that account, and the face on both matched the profile photos. Nothing more.
                </p>
                <Rules items={[
                    'It does not mean we have checked their income, their marital status, or their intentions.',
                    'It does not mean we recommend them.',
                    'It does not mean a conversation with them is safe. Read the Safety Centre for that.',
                ]} />
                <p>
                    We say this plainly because a badge that seems to promise more than it does is worse than no
                    badge at all.
                </p>
            </Section>

            <Section n="2" title="What we ask for">
                <Rules items={[
                    'A selfie taken now, not an existing photo from your gallery.',
                    'A national ID, passport, or driving licence showing your name and date of birth.',
                    'A phone number we can reach you on.',
                ]} />
                <p>
                    Your date of birth is checked against the age on your profile. If they disagree, we use the
                    document.
                </p>
            </Section>

            <Section n="3" title="What happens to the documents">
                <p>
                    Admin Mary G reviews them personally. They are not shown to other members, never appear on
                    your profile, and are not used for anything except confirming your identity.
                </p>
                <Rules items={[
                    'Documents are deleted once the review is complete, whether or not you are approved.',
                    'If you are rejected we tell you why, so you can send a clearer photo rather than guess.',
                    'You can ask us to delete them at any point before the review, and we will stop the review.',
                ]} />
            </Section>

            <Section n="4" title="How long it takes">
                <p>
                    Most reviews finish the same day. If yours is taking longer than two days, message Admin
                    Mary G rather than sending the documents again, because a second submission puts you at the
                    back of the queue.
                </p>
            </Section>

            <Section n="5" title="If verification is refused">
                <p>
                    The usual reasons are a blurred document, a name that does not match the profile, or a selfie
                    that is clearly an older photo. None of these close your account. Fix the specific thing we
                    named and submit again.
                </p>
                <p>
                    We do refuse permanently where a document appears altered, or where the same document has
                    already verified a different account. That is the one case with no appeal.
                </p>
            </Section>

            <Section n="6" title="Losing the badge">
                <p>
                    Verification is tied to the photos it was granted against. If you replace your main profile
                    photo, the badge is withdrawn and you will be asked to verify again. This stops an account
                    being verified with one person and then used with another.
                </p>
            </Section>
        </PolicyPage>
    );
}
