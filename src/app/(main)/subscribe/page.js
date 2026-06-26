'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Check, Star, Shield, Zap, MessageCircle, Heart, Eye, Send, ArrowLeft, Phone, Copy, Smartphone, Globe, Camera } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';

const PLANS = [
    {
        id: 'free', name: 'Free', price: 'KES 0', period: 'Starter access', color: '#6b7280', icon: Heart, popular: false,
        features: [
            { text: 'Browse mixed WP and member profiles', included: true },
            { text: '10 daily swipes and likes', included: true },
            { text: '3 messages per conversation', included: true },
            { text: 'Blurred phone numbers only', included: true },
            { text: 'Phone reveal', included: false },
            { text: 'Voice/video calls', included: false },
        ],
    },
    {
        id: 'basic', name: 'Basic', price: 'KES 650', period: 'Admin approved', color: '#10B981', icon: MessageCircle, popular: false,
        features: [
            { text: '10 messages per conversation/day', included: true },
            { text: '10 likes and 10 swipes', included: true },
            { text: 'Send gifts and emojis', included: true },
            { text: 'Browse member photos and details', included: true },
            { text: 'Phone reveal', included: false },
            { text: 'Voice/video calls', included: false },
        ],
    },
    {
        id: 'silver', name: 'Silver', price: 'KES 1,200', period: 'Admin approved', color: '#0EA5E9', icon: Star, popular: true,
        features: [
            { text: 'Lifetime phone number reveal', included: true },
            { text: 'Unlimited messages', included: true },
            { text: '50 likes and swipes', included: true },
            { text: 'Send images and files in chat', included: true },
            { text: 'Voice and video call requests', included: true },
            { text: 'Priority matching', included: true },
        ],
    },
    {
        id: 'gold', name: 'Gold International', price: 'KES 3,500', period: 'Admin approved', color: '#F59E0B', icon: Crown, popular: false,
        features: [
            { text: 'International and prominent users', included: true },
            { text: 'Unlimited messaging, likes and swipes', included: true },
            { text: 'Phone reveal for all profiles', included: true },
            { text: 'Premium gifts priority', included: true },
            { text: 'Top profile placement after approval', included: true },
            { text: 'Fast admin support', included: true },
        ],
    },
];

export default function SubscribePage() {
    const router = useRouter();
    const { user, subscription, updateSubscription } = useAuth();
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [showPayment, setShowPayment] = useState(false);
    const currentPlan = subscription?.plan || 'free';

    // Payment States
    const [selectedNetwork, setSelectedNetwork] = useState('mpesa_kenya');
    const [transactionId, setTransactionId] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [paymentError, setPaymentError] = useState('');
    const [generatedTicketId, setGeneratedTicketId] = useState('');
    const [submittedCode, setSubmittedCode] = useState('');
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [copiedNum, setCopiedNum] = useState(false);
    const [copiedTicket, setCopiedTicket] = useState(false);

    // Screenshot Proof States
    const [proofFile, setProofFile] = useState(null);
    const [proofUploading, setProofUploading] = useState(false);
    const [paymentProofUrl, setPaymentProofUrl] = useState('');

    const handleSelectPlan = (plan) => {
        if (plan.id === currentPlan || plan.id === 'free') return;
        setSelectedPlan(plan);
        setTransactionId('');
        setPaymentError('');
        setGeneratedTicketId('');
        setSubmittedCode('');
        setPaymentSuccess(false);
        setSelectedNetwork('mpesa_kenya');
        setProofFile(null);
        setPaymentProofUrl('');
        setShowPayment(true);
    };

    const copyToClipboard = (text, type) => {
        navigator.clipboard.writeText(text);
        if (type === 'phone') {
            setCopiedNum(true);
            setTimeout(() => setCopiedNum(false), 2000);
        } else {
            setCopiedTicket(true);
            setTimeout(() => setCopiedTicket(false), 2000);
        }
    };

    // Helper: convert File to base64 string
    const fileToBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const handleSubmitPayment = async () => {
        if (!transactionId.trim()) {
            setPaymentError('Please enter a valid Transaction ID.');
            return;
        }
        setSubmitting(true);
        setPaymentError('');

        try {
            let uploadedUrl = '';
            let base64ProofData = null;

            if (proofFile) {
                setProofUploading(true);
                try {
                    // Strategy 1: Try signed URL upload
                    const filename = encodeURIComponent(proofFile.name);
                    const signedUrlRes = await fetch(`/api/admin/setup?userId=${user?.id || 'guest'}&filename=${filename}`);
                    const signedData = signedUrlRes.ok ? await signedUrlRes.json() : { fallbackMode: true };

                    if (signedData.signedUrl && !signedData.fallbackMode) {
                        // Signed URL available — upload directly
                        const uploadRes = await fetch(signedData.signedUrl, {
                            method: 'PUT',
                            body: proofFile,
                            headers: { 'Content-Type': proofFile.type }
                        });
                        if (uploadRes.ok) {
                            uploadedUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/payment-proofs/${signedData.path}`;
                            setPaymentProofUrl(uploadedUrl);
                        } else {
                            // Signed URL upload failed — fall through to base64
                            console.warn('[Payment] Signed URL upload failed, using base64 fallback');
                        }
                    }

                    // Strategy 2: If signed URL didn't work, try base64 PUT upload
                    if (!uploadedUrl) {
                        const base64 = await fileToBase64(proofFile);
                        try {
                            const b64Res = await fetch('/api/admin/setup', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    userId: user?.id || 'guest',
                                    filename: proofFile.name,
                                    base64Data: base64,
                                    mimeType: proofFile.type
                                })
                            });
                            const b64Data = await b64Res.json();
                            if (b64Data.url) {
                                uploadedUrl = b64Data.url;
                                setPaymentProofUrl(uploadedUrl);
                            } else {
                                // Strategy 3: Store base64 inline with the transaction
                                console.warn('[Payment] Base64 upload to storage also failed, embedding inline');
                                base64ProofData = base64;
                            }
                        } catch {
                            // Final fallback: embed base64 inline
                            console.warn('[Payment] All upload strategies failed, embedding base64 inline');
                            base64ProofData = base64;
                        }
                    }
                } catch (uploadErr) {
                    console.warn('[Payment] Screenshot processing error (non-blocking):', uploadErr.message);
                    // Do NOT block payment — proceed without screenshot
                } finally {
                    setProofUploading(false);
                }
            }

            const ticketId = 'GS-PAY-' + Math.random().toString(36).substr(2, 7).toUpperCase();
            const rawAmount = parseFloat(selectedPlan.price.replace(/[^\d]/g, ''));

            // Call server-side API to insert transaction bypassing standard user RLS
            const response = await fetch('/api/subscribe/transaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user?.id,
                    email: user?.email || 'guest@genuinesugarmummies.co.ke',
                    plan: selectedPlan.id,
                    amount: rawAmount,
                    method: PAYMENT_NETWORKS.find(n => n.id === selectedNetwork)?.name || 'M-Pesa Escrow',
                    code: transactionId.trim(),
                    ticketId: ticketId,
                    paymentProofUrl: uploadedUrl || null,
                    paymentProofBase64: base64ProofData || null
                })
            });

            const data = await response.json();

            if (!response.ok) {
                setPaymentError(data.error || 'Submission failed. Please try again.');
                return;
            }

            // Successfully submitted! Save states for success screen
            setGeneratedTicketId(ticketId);
            setSubmittedCode(transactionId.trim());
            setPaymentSuccess(true);
        } catch (err) {
            console.error('[Payment System] Unexpected error:', err);
            setPaymentError('An unexpected error occurred. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const TELEGRAM_URL = 'https://t.me/GSADMINMARYGAGENCY';
    const PHONE = '+254738871048';
    const PAYMENT_NUMBER = '+254738871048';

    return (
        <div className="px-4 pt-4 pb-24">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <button onClick={() => router.back()} className="p-1">
                    <ArrowLeft size={22} className="text-text-primary" />
                </button>
                <div className="flex items-center gap-2">
                    <Crown size={22} className="text-gold" />
                    <h1 className="text-xl font-bold text-text-primary">Membership Plans</h1>
                </div>
            </div>

            <p className="text-sm text-text-secondary mb-6">
                Upgrade your experience. Get unlimited likes, see who liked you, direct messaging, and more.
            </p>

            {/* Plan Cards */}
            <div className="space-y-4 mb-8">
                {PLANS.map((plan, idx) => {
                    const Icon = plan.icon;
                    const isCurrent = plan.id === currentPlan;
                    return (
                        <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.08 }}
                            onClick={() => handleSelectPlan(plan)}
                            className={`rounded-3xl p-5 relative transition-all cursor-pointer ${isCurrent ? 'ring-2 ring-primary' : ''} ${plan.popular ? 'ring-2 ring-gold' : ''}`}
                            style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}
                        >
                            {plan.popular && (
                                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white bg-gold rounded-full px-3 py-0.5 shadow">
                                    MOST POPULAR
                                </span>
                            )}
                            {isCurrent && (
                                <span className="absolute -top-2.5 right-4 text-[10px] font-bold text-white bg-primary rounded-full px-3 py-0.5 shadow">
                                    CURRENT
                                </span>
                            )}

                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${plan.color}15` }}>
                                        <Icon size={22} style={{ color: plan.color }} />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-text-primary">{plan.name}</h3>
                                        <p className="text-xs text-text-muted">{plan.period}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-xl font-extrabold text-text-primary">{plan.price}</span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                {plan.features.map((f, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${f.included ? 'bg-success/15' : 'bg-surface'}`}>
                                            {f.included ? <Check size={10} className="text-success" /> : <span className="text-[8px] text-text-muted">—</span>}
                                        </div>
                                        <span className={`text-xs ${f.included ? 'text-text-primary' : 'text-text-muted line-through'}`}>{f.text}</span>
                                    </div>
                                ))}
                            </div>

                            {!isCurrent && plan.id !== 'free' && (
                                <button
                                    className="w-full mt-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98]"
                                    style={{ background: plan.color }}
                                >
                                    Choose {plan.name}
                                </button>
                            )}
                        </motion.div>
                    );
                })}
            </div>

            {/* Payment Info */}
            <div className="rounded-3xl p-5 space-y-4" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <Shield size={14} className="text-success" /> Global Payment Support
                </h3>
                <p className="text-xs text-text-secondary">
                    We accept standard and cross-border mobile money transfers to our Airtel Kenya receiver number from any network in Kenya, Uganda, Tanzania, and globally.
                </p>
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="p-2.5 rounded-xl bg-bg-secondary border border-border">
                        <span className="block font-bold text-text-primary">Kenya (KE)</span>
                        <span className="text-[10px] text-text-muted">M-Pesa, Airtel Money</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-bg-secondary border border-border">
                        <span className="block font-bold text-text-primary">Uganda (UG)</span>
                        <span className="text-[10px] text-text-muted">MTN MoMo, Airtel Money</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-bg-secondary border border-border">
                        <span className="block font-bold text-text-primary">Tanzania (TZ)</span>
                        <span className="text-[10px] text-text-muted">Vodacom M-Pesa</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-bg-secondary border border-border">
                        <span className="block font-bold text-text-primary">International</span>
                        <span className="text-[10px] text-text-muted">Sendwave, WorldRemit</span>
                    </div>
                </div>
            </div>

            {/* Bottom info */}
            <p className="text-center text-[10px] text-text-muted mt-6 px-4">
                Payments are processed via Airtel Kenya (+254738871048) and verified by Admin Mary G.<br />
                Genuine Sugar Mummies Kenya · genuinesugarmummies.co.ke
            </p>

            {/* Payment confirmation modal */}
            <AnimatePresence>
                {showPayment && selectedPlan && (
                    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => { if (!submitting) setShowPayment(false); }}>
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-lg rounded-t-[2.5rem] p-6 space-y-4 max-h-[92vh] overflow-y-auto"
                            style={{ background: 'var(--color-bg-card)', borderTop: 'var(--card-border)' }}
                        >
                            <div className="w-12 h-1.5 rounded-full bg-border mx-auto mb-1" />

                            {!paymentSuccess ? (
                                <>
                                    <div className="text-center">
                                        <span className="text-xs font-bold uppercase tracking-widest text-primary px-3 py-1 rounded-full bg-primary/10">
                                            SECURE CHECKOUT
                                        </span>
                                        <h3 className="text-xl font-black text-text-primary mt-2">
                                            Subscribe to {selectedPlan.name}
                                        </h3>
                                        <p className="text-2xl font-black mt-1" style={{ color: selectedPlan.color }}>
                                            {selectedPlan.price}<span className="text-sm font-medium text-text-muted">{selectedPlan.period}</span>
                                        </p>
                                    </div>

                                    {/* Network Tabs */}
                                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-border">
                                        {[
                                            { id: 'mpesa_kenya', name: 'M-Pesa (KE)', color: '#37B24D' },
                                            { id: 'airtel_kenya', name: 'Airtel (KE)', color: '#FA5252' },
                                            { id: 'airtel_uganda', name: 'Airtel (UG)', color: '#D9393E' },
                                            { id: 'mtn_uganda', name: 'MTN (UG)', color: '#F59E0B' },
                                            { id: 'vodacom_tz', name: 'Vodacom', color: '#E60000' },
                                            { id: 'other_wallet', name: 'Sendwave/Other', color: '#7c3aed' }
                                        ].map(net => (
                                            <button
                                                key={net.id}
                                                onClick={() => { setSelectedNetwork(net.id); setPaymentError(''); }}
                                                className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition-all border ${
                                                    selectedNetwork === net.id
                                                        ? 'bg-text-primary text-bg border-text-primary shadow-sm'
                                                        : 'bg-bg-secondary text-text-secondary border-border hover:bg-surface'
                                                }`}
                                            >
                                                {net.name}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Payment Receiver Card */}
                                    <div className="p-4 rounded-2xl bg-bg-secondary border border-border space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Receiver Mobile Wallet</span>
                                            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Airtel Money Kenya</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-base font-black text-text-primary">{PAYMENT_NUMBER}</span>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(PAYMENT_NUMBER);
                                                    setCopiedNum(true);
                                                    setTimeout(() => setCopiedNum(false), 2000);
                                                }}
                                                className="flex items-center gap-1 text-[10px] font-bold text-primary hover:opacity-80 active:scale-95"
                                            >
                                                <Copy size={12} />
                                                {copiedNum ? 'Copied!' : 'Copy Number'}
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] text-text-secondary border-t border-border/60 pt-2 mt-1">
                                            <span>Recipient Name: <strong>Mary G</strong></span>
                                            {selectedNetwork.includes('uganda') && (
                                                <span className="text-primary font-bold">
                                                    Rate: UGX {getUgxPrice(selectedPlan.price)}
                                                </span>
                                            )}
                                            {selectedNetwork === 'vodacom_tz' && (
                                                <span className="text-primary font-bold">
                                                    Rate: TZS {getTzsPrice(selectedPlan.price)}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Step by Step Instructions */}
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Instructions:</h4>
                                        <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                                            {(() => {
                                                const net = selectedNetwork;
                                                const price = selectedPlan.price;
                                                const ugx = getUgxPrice(price);
                                                const tzs = getTzsPrice(price);
                                                
                                                let steps = [];
                                                if (net === 'mpesa_kenya') {
                                                    steps = [
                                                        'Go to M-Pesa menu or Dial *334#',
                                                        'Select Send Money -> To Other Network',
                                                        'Select Airtel Money',
                                                        `Enter Recipient Phone: ${PAYMENT_NUMBER}`,
                                                        `Enter Amount: ${price}`,
                                                        'Confirm recipient is Mary G and enter M-Pesa PIN',
                                                        'Wait for M-Pesa SMS and copy the Transaction ID below'
                                                    ];
                                                } else if (net === 'airtel_kenya') {
                                                    steps = [
                                                        'Dial *334# or open Airtel Money App',
                                                        'Select Send Money -> To Airtel Phone Number',
                                                        `Enter Phone Number: ${PAYMENT_NUMBER}`,
                                                        `Enter Amount: ${price}`,
                                                        'Confirm recipient details (Mary G) and enter Airtel PIN',
                                                        'Copy the Airtel Transaction ID from your SMS below'
                                                    ];
                                                } else if (net === 'airtel_uganda') {
                                                    steps = [
                                                        'Dial *185# on your Airtel Uganda line',
                                                        'Select Send Money -> International Transfer',
                                                        'Select To Kenya (Airtel)',
                                                        `Enter Recipient Phone: ${PAYMENT_NUMBER}`,
                                                        `Enter Amount in UGX: UGX ${ugx} (approximately ${price})`,
                                                        'Review conversion details, verify Mary G, and enter PIN',
                                                        'Copy the UGX Airtel Transaction Reference below'
                                                    ];
                                                } else if (net === 'mtn_uganda') {
                                                    steps = [
                                                        'Dial *165# on your MTN Uganda line',
                                                        'Select Send Money -> International Transfer',
                                                        'Select To Kenya (Airtel)',
                                                        `Enter Recipient Phone: ${PAYMENT_NUMBER}`,
                                                        `Enter Amount in UGX: UGX ${ugx} (approximately ${price})`,
                                                        'Confirm conversions, verify recipient Mary G, and enter PIN',
                                                        'Copy the MTN Transaction ID/Reference Code below'
                                                    ];
                                                } else if (net === 'vodacom_tz') {
                                                    steps = [
                                                        'Dial *150*00# on your Vodacom Tanzania line',
                                                        'Select Send Money -> To Kenya (Airtel)',
                                                        `Enter Recipient Phone: ${PAYMENT_NUMBER}`,
                                                        `Enter Amount in TZS: TZS ${tzs} (approximately ${price})`,
                                                        'Confirm details and enter your Vodacom M-Pesa PIN',
                                                        'Copy the Vodacom Transaction Code and paste it below'
                                                    ];
                                                } else {
                                                    steps = [
                                                        'Open Sendwave, WorldRemit, Remitly, or similar international wallet',
                                                        'Choose Send to Mobile Wallet in Kenya',
                                                        'Select Network Provider: Airtel Money Kenya',
                                                        `Enter Phone Number: ${PAYMENT_NUMBER}`,
                                                        'Enter Recipient Name: Mary G',
                                                        `Enter Amount: ${price}`,
                                                        'Complete transfer and copy the Remittance Reference Code below'
                                                    ];
                                                }

                                                return steps.map((step, sIdx) => (
                                                    <div key={sIdx} className="flex gap-2 text-xs text-text-secondary leading-relaxed">
                                                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-[10px]">
                                                            {sIdx + 1}
                                                        </span>
                                                        <p>{step}</p>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    </div>

                                    {/* Transaction ID Input */}
                                    <div className="space-y-1.5 pt-2">
                                        <label className="text-xs font-bold text-text-primary uppercase tracking-wider block">
                                            Enter Transaction ID / Reference Code:
                                        </label>
                                        <input
                                            type="text"
                                            value={transactionId}
                                            onChange={(e) => { setTransactionId(e.target.value); setPaymentError(''); }}
                                            placeholder="e.g. QET93821LK, Ref Code, or MTN ID"
                                            disabled={submitting}
                                            className="w-full py-3 px-4 rounded-xl text-sm text-text-primary bg-bg-secondary border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 uppercase placeholder:text-text-secondary/60"
                                        />
                                    </div>

                                    {/* Optional Screenshot Upload */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-text-primary uppercase tracking-wider block">
                                            Payment Screenshot <span className="text-text-muted font-normal">(Optional but speeds up approval)</span>
                                        </label>
                                        {proofFile ? (
                                            <div className="flex items-center gap-3 p-3 rounded-xl bg-success/10 border border-success/30">
                                                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-surface">
                                                    <img src={URL.createObjectURL(proofFile)} alt="proof" className="w-full h-full object-cover" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-success">Screenshot added</p>
                                                    <p className="text-[10px] text-text-muted truncate">{proofFile.name}</p>
                                                </div>
                                                <button onClick={() => setProofFile(null)} className="text-[10px] text-danger font-bold text-right shrink-0">Remove</button>
                                            </div>
                                        ) : (
                                            <label className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-border cursor-pointer hover:border-primary/40 transition-colors bg-bg-secondary">
                                                <Camera size={20} className="text-text-muted" />
                                                <span className="text-xs text-text-muted text-center">Tap to attach M-Pesa/Airtel screenshot<br/><span className="text-[10px]">JPG, PNG up to 5MB</span></span>
                                                <input type="file" accept="image/*" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f && f.size < 5 * 1024 * 1024) setProofFile(f); }} />
                                            </label>
                                        )}
                                    </div>

                                    {paymentError && (
                                        <div className="p-3 rounded-xl bg-danger/10 text-danger text-xs font-medium border border-danger/20">
                                            {paymentError}
                                        </div>
                                    )}

                                    {/* Submit Action */}
                                    <button
                                        onClick={handleSubmitPayment}
                                        disabled={submitting || !transactionId.trim() || proofUploading}
                                        className="w-full py-3.5 rounded-2xl font-extrabold text-white gradient-primary text-sm flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40 disabled:scale-100 transition-all cursor-pointer shadow-md shadow-primary/20"
                                    >
                                        {submitting ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                {proofUploading ? 'Uploading Screenshot...' : 'Verifying Submission...'}
                                            </>
                                        ) : (
                                            <>
                                                <Check size={16} strokeWidth={3} /> Submit Payment Verification
                                            </>
                                        )}
                                    </button>

                                    <button
                                        onClick={() => setShowPayment(false)}
                                        disabled={submitting}
                                        className="w-full py-2.5 rounded-xl text-xs font-medium text-text-muted hover:text-text-primary transition-colors disabled:opacity-30"
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                /* Success State — Showing Ticket ID and Telegram directions */
                                <div className="text-center py-4 space-y-5">
                                    <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mx-auto border border-success/30">
                                        <Crown size={32} className="text-success animate-pulse" />
                                    </div>

                                    <div className="space-y-1.5">
                                        <h3 className="text-xl font-black text-text-primary">
                                            Payment Logged Successfully!
                                        </h3>
                                        <p className="text-xs text-text-secondary max-w-xs mx-auto">
                                            Your transaction has been registered on our admin panel. Please message Mary G on Telegram to unlock your premium account instantly.
                                        </p>
                                    </div>

                                    {/* Ticket Details Summary Card */}
                                    <div className="p-5 rounded-3xl bg-bg-secondary border border-border text-left space-y-3.5">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-text-muted">Selected Plan:</span>
                                            <span className="font-bold text-text-primary">{selectedPlan.name} Plan</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs border-t border-border/40 pt-2">
                                            <span className="text-text-muted">Transaction ID:</span>
                                            <span className="font-mono font-bold text-text-primary uppercase">{submittedCode}</span>
                                        </div>
                                        <div className="flex flex-col gap-1 border-t border-border/40 pt-3">
                                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Your Verification Ticket ID:</span>
                                            <div className="flex items-center justify-between bg-bg-card p-3 rounded-xl border border-border mt-1">
                                                <span className="font-mono text-base font-black text-primary tracking-wider">{generatedTicketId}</span>
                                                <button
                                                    onClick={() => copyToClipboard(generatedTicketId, 'ticket')}
                                                    className="flex items-center gap-1 text-[10px] font-bold text-text-secondary hover:text-primary active:scale-95 transition-all"
                                                >
                                                    <Copy size={12} />
                                                    {copiedTicket ? 'Copied!' : 'Copy Ticket'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Telegram Message Trigger */}
                                    <div className="space-y-2 pt-2">
                                        <a
                                            href={`${TELEGRAM_URL}?text=${encodeURIComponent(
                                                `Hi Mary, I have paid for the ${selectedPlan.name} Package (${
                                                    selectedPlan.price
                                                }) using ${
                                                    PAYMENT_NETWORKS.find(n => n.id === selectedNetwork)?.name || 'Mobile Money'
                                                }. 

My transaction reference code is: ${submittedCode}
Here is my GS Ticket ID: ${generatedTicketId}
My account email is: ${user?.email || 'N/A'}

Please log in to your admin panel and unlock my membership! Thank you.`
                                            )}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-black text-white text-sm transition-all active:scale-[0.98] shadow-lg shadow-[#0088cc]/10 hover:opacity-90"
                                            style={{ background: '#0088cc' }}
                                        >
                                            <Send size={16} />
                                            Send Ticket to Admin Mary on Telegram
                                        </a>

                                        <button
                                            onClick={() => { setShowPayment(false); setPaymentSuccess(false); }}
                                            className="w-full py-3 rounded-xl text-xs font-semibold text-text-muted hover:text-text-primary transition-colors"
                                        >
                                            Close Checkout
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Helpers for Uganda and Tanzania currency conversions
function getUgxPrice(priceKes) {
    if (!priceKes) return '0';
    const num = parseInt(priceKes.replace(/[^\d]/g, ''));
    return (num * 30).toLocaleString(); // 1 KES = ~30 UGX
}

function getTzsPrice(priceKes) {
    if (!priceKes) return '0';
    const num = parseInt(priceKes.replace(/[^\d]/g, ''));
    return (num * 20).toLocaleString(); // 1 KES = ~20 TZS
}

// Global Payment Networks List
const PAYMENT_NETWORKS = [
    { id: 'mpesa_kenya', name: 'M-Pesa (Kenya)' },
    { id: 'airtel_kenya', name: 'Airtel Money (KE)' },
    { id: 'airtel_uganda', name: 'Airtel Money (UG)' },
    { id: 'mtn_uganda', name: 'MTN Uganda MoMo' },
    { id: 'vodacom_tz', name: 'Vodacom MoMo' },
    { id: 'other_wallet', name: 'Sendwave/Other' }
];

function copyToClipboard(text, type, setCopiedNum, setCopiedTicket) {
    navigator.clipboard.writeText(text);
}
