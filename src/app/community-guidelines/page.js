import Link from 'next/link';

export const metadata = {
    title: 'Community Guidelines - Genuine Sugar Mummies',
};

export default function CommunityGuidelinesPage() {
    return (
        <main className="min-h-dvh px-5 py-8 app-shell">
            <section className="mx-auto max-w-2xl space-y-5 rounded-2xl p-5" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                <Link href="/auth/login" className="text-xs font-semibold text-primary">← Back to login</Link>
                <h1 className="text-2xl font-black text-text-primary">Community Guidelines</h1>
                <p className="text-xs text-text-muted">Last updated: July 2025</p>

                <div className="space-y-4 text-sm leading-relaxed text-text-secondary">
                    <p>Genuine Sugar Mummies is a community built on respect, honesty, and genuine connections. These guidelines help keep the platform safe and enjoyable for everyone. All members are expected to follow these rules. Violations may result in warnings, account suspension, or permanent bans.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">Be Honest About Who You Are</h2>
                    <p>Use your real name (or a name you go by), your own photos, and accurate information on your profile. Fake identities, stolen photos, catfishing, and impersonation are not tolerated. If you&apos;re caught using someone else&apos;s photos or pretending to be someone you&apos;re not, your account will be removed.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">Treat Everyone With Respect</h2>
                    <p>Everyone on this platform is here looking for connections. Treat others the way you&apos;d want to be treated. This means:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>No insults, name-calling, or demeaning language</li>
                        <li>No harassment or repeated unwanted contact after someone has declined</li>
                        <li>No threats of any kind, whether physical, financial, or emotional</li>
                        <li>No discrimination based on ethnicity, religion, gender, body type, or background</li>
                        <li>Accept rejection gracefully — not everyone will be interested, and that&apos;s okay</li>
                    </ul>

                    <h2 className="text-base font-black text-text-primary pt-2">Keep It Legal and Safe</h2>
                    <p>This platform is strictly for adults aged 18 and above. The following are absolutely not allowed:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Any content or activity involving minors</li>
                        <li>Sharing sexually explicit images or videos without consent</li>
                        <li>Promoting or facilitating prostitution, human trafficking, or any illegal activity</li>
                        <li>Posting violent, graphic, or disturbing content</li>
                        <li>Blackmail or threatening to share someone&apos;s private information or photos</li>
                    </ul>

                    <h2 className="text-base font-black text-text-primary pt-2">No Scams or Financial Manipulation</h2>
                    <p>This is a dating and social platform, not a marketplace. The following financial behaviors are prohibited:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Asking members for money, M-Pesa, airtime, or &quot;transport fare&quot;</li>
                        <li>Promising jobs, sponsorship, or financial support in exchange for upfront payments</li>
                        <li>Pretending to be wealthy or offering fake financial incentives to manipulate others</li>
                        <li>Submitting fake payment references for subscription packages</li>
                        <li>Running advance-fee schemes or romance scams of any kind</li>
                    </ul>

                    <h2 className="text-base font-black text-text-primary pt-2">Profile Photos and Content</h2>
                    <p>Your profile represents you to the community. Follow these guidelines for photos and content:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Use clear, recent photos of yourself — group photos where it&apos;s unclear who you are should not be your main photo</li>
                        <li>No nudity or explicitly sexual photos in your profile</li>
                        <li>No photos of other people without their consent</li>
                        <li>No images promoting violence, drugs, or illegal activities</li>
                        <li>Write a genuine bio that describes who you are and what you&apos;re looking for</li>
                    </ul>

                    <h2 className="text-base font-black text-text-primary pt-2">Messaging Etiquette</h2>
                    <p>Keep your messages respectful and genuine. Here are some guidelines:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Start conversations politely — a simple greeting goes a long way</li>
                        <li>Don&apos;t send unsolicited explicit messages or images</li>
                        <li>Don&apos;t spam members with repeated messages if they haven&apos;t responded</li>
                        <li>Don&apos;t use messaging to advertise products, services, or other platforms</li>
                        <li>If someone asks you to stop messaging them, respect their wish</li>
                    </ul>

                    <h2 className="text-base font-black text-text-primary pt-2">Reporting and Enforcement</h2>
                    <p>If you see something that breaks these guidelines, report it. You can report a member through the Support section in your profile. Our admin team reviews all reports and takes action as needed.</p>
                    <p>Depending on the severity of the violation, consequences may include:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>A warning message to the offending member</li>
                        <li>Temporary profile hiding or suspension</li>
                        <li>Revocation of verification badge</li>
                        <li>Permanent account ban</li>
                    </ul>
                    <p>We don&apos;t take moderation lightly. Every report is reviewed by a real person on our team, and we always try to be fair. But the safety of our community comes first.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">One Account Per Person</h2>
                    <p>Each person is allowed one account. Creating multiple accounts to evade bans, manipulate the system, or deceive other members will result in all associated accounts being permanently removed.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">Be Part of the Solution</h2>
                    <p>A good community is built by its members. By being honest, respectful, and looking out for each other, you help make Genuine Sugar Mummies a better place for everyone. If you have suggestions for improving the platform or community, reach out through our Support section — we&apos;re always listening.</p>
                </div>
            </section>
        </main>
    );
}
