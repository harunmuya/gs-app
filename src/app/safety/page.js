import PolicyBackLink from '@/components/PolicyBackLink';

export const metadata = {
    title: 'Safety Center | Genuine Sugar Mummies',
};

export default function SafetyPage() {
    return (
        <main className="min-h-dvh px-5 py-8 app-shell">
            <section className="mx-auto max-w-2xl space-y-5 rounded-2xl p-5" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                <PolicyBackLink />
                <h1 className="text-2xl font-black text-text-primary">Safety Center</h1>
                <p className="text-xs text-text-muted">Your safety is our priority. Read these tips before connecting with anyone.</p>

                <div className="space-y-4 text-sm leading-relaxed text-text-secondary">
                    <h2 className="text-base font-black text-text-primary pt-2">Protect Your Money</h2>
                    <p>One of the most common risks on dating platforms is financial scams. Here&apos;s how to protect yourself:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Never send money to someone you haven&apos;t met in person, no matter what reason they give</li>
                        <li>Be suspicious of anyone who asks for M-Pesa, bank transfers, or airtime before meeting you</li>
                        <li>Scammers often create fake emergencies. &quot;I&apos;m stuck&quot;, &quot;I need transport money&quot;, &quot;hospital bill&quot;. To pressure you into sending money quickly</li>
                        <li>No genuine member will ask you to pay for verification, special access, or &quot;connection fees&quot;</li>
                        <li>If someone promises you a job, sponsorship, or large sums of money in exchange for a small upfront payment, it is almost certainly a scam</li>
                    </ul>

                    <h2 className="text-base font-black text-text-primary pt-2">Protect Your Identity</h2>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Never share your password or login details with anyone, including people claiming to be from our team</li>
                        <li>Do not share full copies of your national ID, passport, or bank details in chat messages</li>
                        <li>Be careful about sharing your home address, workplace, or daily routine with people you don&apos;t know well</li>
                        <li>Our admin team will never ask for your password through chat or messages</li>
                    </ul>

                    <h2 className="text-base font-black text-text-primary pt-2">Meeting in Person</h2>
                    <p>If you decide to meet someone from the Platform in person, take these precautions:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Always meet in a public place. A restaurant, coffee shop, or busy area</li>
                        <li>Tell a friend or family member where you&apos;re going, who you&apos;re meeting, and when you expect to be back</li>
                        <li>Arrange your own transport. Don&apos;t get into a stranger&apos;s car on the first meeting</li>
                        <li>Trust your instincts. If something feels off, leave</li>
                        <li>Don&apos;t drink too much or leave your drink unattended</li>
                        <li>Have your phone charged and keep emergency contacts accessible</li>
                    </ul>

                    <h2 className="text-base font-black text-text-primary pt-2">Spotting Fake Profiles</h2>
                    <p>Watch out for these warning signs:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Profiles with model-quality photos that look too perfect or like stock images</li>
                        <li>Members who refuse video calls or always have excuses not to show their face</li>
                        <li>People who declare love or strong feelings unusually fast</li>
                        <li>Profiles with very little information or generic bios</li>
                        <li>Members who immediately try to move the conversation to WhatsApp or other platforms</li>
                    </ul>

                    <h2 className="text-base font-black text-text-primary pt-2">Use Verification</h2>
                    <p>We encourage all members to verify their identity through our verification system. Verified members have submitted a selfie and a government ID that was reviewed by our admin team. While verification doesn&apos;t guarantee someone&apos;s character, it does confirm they are who they say they are.</p>
                    <p>Look for the verified badge when browsing profiles. Unverified members can still be genuine, but always be more cautious.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">Reporting Problems</h2>
                    <p>If you encounter any of the following, report it immediately through the Support section in your profile:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Scam attempts or requests for money</li>
                        <li>Harassment, threats, or abusive messages</li>
                        <li>Fake profiles or impersonation</li>
                        <li>Anyone claiming to be under 18</li>
                        <li>Suspicious behavior or content that makes you uncomfortable</li>
                    </ul>
                    <p>Our team reviews all reports and takes appropriate action, including banning accounts that violate our guidelines.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">Use Official Channels Only</h2>
                    <p>All package purchases, verifications, and support requests should be handled through the Platform. Do not trust anyone who contacts you outside the app claiming to be an admin or offering special deals. Official communications from our team will always come through your in-app inbox or your registered email address.</p>
                </div>
            </section>
        </main>
    );
}
