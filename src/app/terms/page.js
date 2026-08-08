import Link from 'next/link';

export const metadata = {
    title: 'Terms and Conditions - Genuine Sugar Mummies',
};

export default function TermsPage() {
    return (
        <main className="min-h-dvh px-5 py-8 app-shell">
            <section className="mx-auto max-w-2xl space-y-5 rounded-2xl p-5" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                <Link href="/auth/login" className="text-xs font-semibold text-primary">← Back to login</Link>
                <h1 className="text-2xl font-black text-text-primary">Terms and Conditions</h1>
                <p className="text-xs text-text-muted">Last updated: July 2025</p>

                <div className="space-y-4 text-sm leading-relaxed text-text-secondary">
                    <p>Welcome to Genuine Sugar Mummies. By accessing or using our platform at genuinesugarmummies.com and any associated mobile applications (collectively, the &quot;Platform&quot;), you agree to be bound by these Terms and Conditions. Please read them carefully before creating an account or using any of our services.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">1. Eligibility</h2>
                    <p>You must be at least 18 years old to create an account or use this Platform. By registering, you confirm that you are of legal adult age in your country of residence. We do not knowingly accept registrations from anyone under 18. If we discover that a minor has created an account, that account will be terminated immediately without notice.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">2. Account Registration</h2>
                    <p>When you create an account, you agree to provide accurate, complete, and current information about yourself. Each person is allowed one account only. You are responsible for keeping your login credentials secure and for all activity that occurs under your account. If you suspect unauthorized access to your account, contact our support team immediately.</p>
                    <p>You agree to use your real name (or a name you commonly go by) and your own photos. Fake identities, stock photos, celebrity images, or photos of other people are not permitted. Accounts found using false information may be suspended or permanently removed.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">3. How the Platform Works</h2>
                    <p>Genuine Sugar Mummies is a social dating platform designed to connect people looking for meaningful relationships, companionship, and connections. Members can browse profiles, send messages, like and match with others, verify their identity, and purchase subscription packages for additional features.</p>
                    <p>We do not guarantee that you will find a partner, receive financial support, or enter into any particular type of relationship through this Platform. All interactions between members are at their own discretion and risk.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">4. User Conduct</h2>
                    <p>You agree not to use the Platform for any unlawful purpose or in any way that could harm other members. The following are strictly prohibited:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Scamming, fraud, or requesting money from other members under false pretenses</li>
                        <li>Harassment, bullying, threats, or intimidation of any kind</li>
                        <li>Posting sexually explicit, violent, or illegal content</li>
                        <li>Impersonating another person or misrepresenting your identity</li>
                        <li>Spamming, advertising, or promoting external businesses or services</li>
                        <li>Attempting to collect other members&apos; personal information for unauthorized purposes</li>
                        <li>Creating multiple accounts or using automated tools to interact with the Platform</li>
                        <li>Any activity that targets or involves persons under the age of 18</li>
                    </ul>

                    <h2 className="text-base font-black text-text-primary pt-2">5. Profile Verification</h2>
                    <p>We offer an optional verification process where members can submit a selfie and a government-issued ID for review by our admin team. Verification badges indicate that the admin has reviewed the submitted documents and confirmed the member&apos;s identity to a reasonable degree.</p>
                    <p>A verification badge does not guarantee a member&apos;s intentions, financial status, character, or behavior. It simply means their identity documents were reviewed. You should always exercise your own judgment when interacting with any member, verified or not.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">6. Packages and Payments</h2>
                    <p>We offer subscription packages (Basic, Silver, Gold, Diamond) that unlock additional features such as viewing phone numbers, unlimited messaging, profile boosts, and priority visibility. Package purchases are processed through our payment partners.</p>
                    <p>To activate a package, you submit a payment reference which is manually reviewed and approved by our admin team. Submitting false or fraudulent payment references will result in immediate account suspension. Packages are non-refundable once activated unless required by applicable law.</p>
                    <p>We reserve the right to change package pricing, features, or availability at any time. Existing active packages will honor their original terms until expiration.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">7. Content Ownership</h2>
                    <p>You retain ownership of any photos, text, or other content you upload to your profile. By uploading content, you grant Genuine Sugar Mummies a non-exclusive, worldwide license to display, distribute, and use that content within the Platform for the purpose of operating our services.</p>
                    <p>We do not sell your photos or content to third parties. When you delete your account, your content will be removed from the Platform within a reasonable timeframe.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">8. Account Moderation</h2>
                    <p>Our admin team actively monitors the Platform to maintain a safe environment. We reserve the right to hide, suspend, or permanently ban any account that violates these Terms, our Community Guidelines, or that we believe poses a risk to other members. Moderation decisions are made at our sole discretion.</p>
                    <p>If your account is suspended, you may contact our support team to request a review. We are not obligated to provide a detailed explanation for moderation actions but will make reasonable efforts to communicate the general reason.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">9. Limitation of Liability</h2>
                    <p>Genuine Sugar Mummies provides this Platform on an &quot;as is&quot; and &quot;as available&quot; basis. We make no warranties, express or implied, regarding the Platform&apos;s reliability, accuracy, or availability. We are not responsible for:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Any losses, damages, or harm resulting from your interactions with other members</li>
                        <li>The accuracy or truthfulness of information provided by other members</li>
                        <li>Any financial transactions or arrangements between members</li>
                        <li>Temporary service outages, data loss, or technical issues</li>
                    </ul>
                    <p>You agree to use the Platform at your own risk and to take reasonable precautions when meeting or communicating with other members.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">10. Privacy</h2>
                    <p>Your privacy matters to us. Please review our <Link href="/privacy" className="text-primary font-bold">Privacy Policy</Link> for details on how we collect, use, store, and protect your personal information.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">11. Account Deletion</h2>
                    <p>You may delete your account at any time from your profile settings. When you delete your account, your profile, messages, and associated data will be permanently removed from our systems. This action cannot be undone. Any active paid packages at the time of deletion will be forfeited.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">12. Changes to These Terms</h2>
                    <p>We may update these Terms and Conditions from time to time. When we make changes, we will update the &quot;Last updated&quot; date at the top of this page. Continued use of the Platform after changes are posted constitutes your acceptance of the updated Terms.</p>

                    <h2 className="text-base font-black text-text-primary pt-2">13. Contact Us</h2>
                    <p>If you have questions about these Terms, need support, or want to report a violation, reach out to us through the Support section in your profile or email us at <span className="text-primary font-bold">support@genuinesugarmummies.com</span>.</p>
                </div>
            </section>
        </main>
    );
}
