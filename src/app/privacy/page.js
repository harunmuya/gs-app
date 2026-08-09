import Link from 'next/link';

export const metadata = {
    title: 'Privacy Policy | Genuine Sugar Mummies',
};

export default function PrivacyPage() {
    return (
        <main className="min-h-dvh px-5 py-8 app-shell">
            <section className="mx-auto max-w-2xl space-y-5 rounded-2xl p-5" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                <Link href="/auth/login" className="text-xs font-semibold text-primary">← Back to login</Link>
                <h1 className="text-2xl font-black text-text-primary">Privacy Policy</h1>
                <p className="text-xs text-text-muted">Last updated: July 2025</p>

                <div className="space-y-4 text-sm leading-relaxed text-text-secondary">
                    <p>At Genuine Sugar Mummies, we take your privacy seriously. This policy explains what information we collect, how we use it, who can see it, and how we keep it safe. By using our Platform, you agree to the practices described here.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">1. Information We Collect</h2>
                    <p><b>Account Information:</b> When you register, we collect your email address, password, display name, age, phone number, and location. This information is necessary to create your account and connect you with other members.</p>
                    <p><b>Profile Information:</b> You may add a bio, photos, your preferences (what you&apos;re looking for, needed qualities, preferred age range), and a profile category. This information is displayed on your public profile to help others find compatible matches.</p>
                    <p><b>Verification Documents:</b> If you choose to verify your identity, we collect a selfie photo and a copy of your government-issued ID or passport. These documents are reviewed by our admin team and are stored securely.</p>
                    <p><b>Activity Data:</b> We collect information about how you use the Platform, including likes, messages sent, profiles viewed, follows, and interactions. This helps us improve your experience and provide better recommendations.</p>
                    <p><b>Device and Technical Data:</b> We may collect your device type, browser, IP address, and approximate location (if you grant permission) to improve service performance and security.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">2. How We Use Your Information</h2>
                    <p>We use the information we collect to:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Create and manage your account</li>
                        <li>Display your profile to other members</li>
                        <li>Match you with compatible members based on your preferences and location</li>
                        <li>Process messages, likes, and other interactions between members</li>
                        <li>Review and process verification requests</li>
                        <li>Process and activate subscription packages</li>
                        <li>Send you important notifications about your account and activity</li>
                        <li>Prevent fraud, scams, and abuse on the Platform</li>
                        <li>Respond to support requests and resolve issues</li>
                        <li>Improve our services and develop new features</li>
                    </ul>

                    <h2 className="text-base font-black text-text-primary pt-2">3. What Other Members Can See</h2>
                    <p>Your display name, photos, bio, age, location, profile category, and what you&apos;re looking for are visible to other members on the Platform. Your email address is never shown to other members.</p>
                    <p>Your phone number is only visible to members who have an active Silver, Gold, or Diamond subscription package. Free and Basic members cannot see phone numbers.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">4. Data Security</h2>
                    <p>We use industry-standard security measures to protect your data, including encrypted connections (HTTPS), secure password hashing, and access controls on our servers. Verification documents are stored securely and access is restricted to authorized admin personnel only.</p>
                    <p>While we work hard to protect your information, no system is 100% secure. We encourage you to use a strong, unique password and to be cautious about sharing sensitive personal details with other members.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">5. Data Sharing</h2>
                    <p>We do not sell, rent, or trade your personal information to third parties. We may share limited data with:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Service providers who help us operate the Platform (hosting, email delivery, payment processing)</li>
                        <li>Law enforcement or government authorities if required by law or to protect the safety of our members</li>
                    </ul>

                    <h2 className="text-base font-black text-text-primary pt-2">6. Cookies and Local Storage</h2>
                    <p>We use cookies and browser local storage to keep you logged in, remember your preferences, and improve your experience on the Platform. You can clear this data at any time through your browser settings, though doing so may require you to log in again.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">7. Your Rights</h2>
                    <p>You have the right to:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>View and edit your profile information at any time</li>
                        <li>Delete your account permanently, which removes all your data from our systems</li>
                        <li>Request a copy of the personal data we hold about you</li>
                        <li>Withdraw consent for location tracking by revoking browser permissions</li>
                    </ul>
                    <p>To exercise any of these rights, use the relevant settings in your profile or contact our support team.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">8. Data Retention</h2>
                    <p>We retain your account data for as long as your account is active. If you delete your account, your data is permanently removed from our systems within 30 days. Some anonymized usage data may be retained for analytical purposes.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">9. Children&apos;s Privacy</h2>
                    <p>This Platform is strictly for adults aged 18 and older. We do not knowingly collect information from anyone under 18. If we become aware that a minor has created an account, we will delete it immediately.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">10. Changes to This Policy</h2>
                    <p>We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated date. Continued use of the Platform after changes means you accept the updated policy.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">11. Contact Us</h2>
                    <p>For privacy questions or concerns, contact us through the Support section in your profile or email <span className="text-primary font-bold">support@genuinesugarmummies.com</span>.</p>
                </div>
            </section>
        </main>
    );
}
