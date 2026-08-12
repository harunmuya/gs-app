import PolicyPage, { Section, Rules } from '@/components/PolicyPage';

export const metadata = {
    title: 'Introductions | Genuine Sugar Mummies',
    description: 'How our team introduces you to a profile, what it costs, and what happens next.',
};

/**
 * How an introduction works.
 *
 * This page was written when the app still put a red notice on these profiles,
 * so it opened by explaining the restriction: "Some profiles carry a red notice
 * saying you cannot message them directly." That sentence is now wrong twice
 * over. There is no red notice, and describing a service by what it forbids was
 * the whole problem.
 *
 * The content below it was already honest, including the part that says we do
 * not promise a reply. Only the framing needed changing.
 */
export default function FacilitationPage() {
    return (
        <PolicyPage
            title="Introductions"
            updated="12 August 2026"
            intro="Some profiles here are introduced by our team rather than messaged directly. This explains what those profiles are, what happens when you ask for an introduction, and what it costs."
        >
            <Section n="1" title="Two kinds of profile">
                <p>
                    Most profiles here are member accounts. Somebody signed up, verified a phone number, and is
                    signed in. You can message, call and send gifts to them, and they get a notification.
                </p>
                <p>
                    A smaller number are listings. These come from our public site and from people who asked to
                    be introduced without keeping an app account. Nobody is signed in behind a listing, so a
                    message sent to one would reach no one.
                </p>
            </Section>

            <Section n="2" title="Why we show them at all">
                <p>
                    Because they are real people who are genuinely looking, and hiding them would make the app
                    emptier without making it more honest. What would be dishonest is letting you spend a
                    message, a call or a gift on one and saying nothing.
                </p>
                <p>
                    So every listing carries the notice, the messaging and calling controls are visibly disabled
                    rather than removed, and no listing shows an online status, because it cannot have one.
                </p>
            </Section>

            <Section n="3" title="How an introduction works">
                <Rules items={[
                    'You ask, through the button on the profile or by messaging Admin Mary G.',
                    'We contact the person and tell them who is asking and what you said.',
                    'If they agree, we put you in touch directly and you continue without us.',
                    'If they decline, or we cannot reach them, we tell you. We do not leave you waiting.',
                ]} />
            </Section>

            <Section n="4" title="What it costs">
                <p>
                    Nothing. Passing on a first message is part of your membership and we do not charge for it,
                    take a fee from either side, or ask for anything before we make contact.
                </p>
                <p>
                    Anyone asking you to pay for an introduction is not from Genuine Sugar Mummies. Report it to
                    Admin Mary G and we will deal with it.
                </p>
            </Section>

            <Section n="5" title="What we will not do">
                <Rules items={[
                    'We do not pass on a phone number without that person agreeing first.',
                    'We do not promise a reply, because we cannot make anyone answer.',
                    'We do not pretend a listing is an active member to keep you interested.',
                ]} />
            </Section>

            <Section n="6" title="Telling the two apart">
{/* This described a red notice that no longer exists. Anything here has to
    match what is actually on screen, or the page teaches people to look for
    the wrong thing and they end up trusting neither. */}
                <p>
                    A member account shows a real last seen time and, if they have verified, a badge. A listing
                    shows neither, and carries a small chip reading By introduction on the photo and again near
                    the top of the profile. If you are unsure, the messaging button is the test: on a member it
                    opens a conversation, on a listing it tells you we will pass the message on.
                </p>
            </Section>
        </PolicyPage>
    );
}
