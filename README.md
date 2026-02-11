# Genuine Sugar Mummies App

> Kenya's leading Tinder-style dating app for genuine sugar mummy connections.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install --legacy-peer-deps
```

### 2. Set Up Supabase
1. Go to [supabase.com](https://supabase.com) and create a free project
2. Go to **SQL Editor** and paste the contents of `supabase/schema.sql` — run it
3. Go to **Settings → API** and copy your:
   - Project URL
   - `anon` public key

### 3. Configure Environment
Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_WP_API_URL=https://genuinesugarmummies.co.ke/wp-json/wp/v2
```
> [!IMPORTANT]
> When deploying to **Vercel**, make sure to add these exact keys in the **Environment Variables** section of your project settings.

### 4. Run the App
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## 🔐 Authentication Setup

### Email/Password
Works out of the box once Supabase is configured.

### Google Login
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
4. In Supabase Dashboard → Authentication → Providers → Google:
   - Enable Google
   - Paste Client ID and Client Secret

### Phone OTP
1. In Supabase Dashboard → Authentication → Providers → Phone
2. Enable Phone provider
3. Configure Twilio (or other SMS provider) credentials

---

## 📱 Features

- **Swipe System** — Tinder-style cards with right (like) / left (pass)
- **Smart Matching** — Location-based scoring with Haversine formula
- **Geolocation** — Browser GPS for proximity matching
- **Profile Dashboard** — Edit profile, set preferences, view stats
- **Messaging** — Send messages (WordPress comments) to profiles
- **PWA** — Install as mobile app, works offline
- **Dark Mode** — Premium dark UI with glassmorphism

## 📁 Project Structure

```
src/
├── app/
│   ├── (main)/           # Authenticated pages
│   │   ├── discover/     # Swipe cards
│   │   ├── matches/      # Match grid
│   │   └── profile/      # User dashboard
│   ├── auth/
│   │   ├── login/        # Login page
│   │   └── callback/     # OAuth redirect
│   └── api/
│       ├── profiles/     # WordPress profiles
│       ├── likes/        # Swipe right
│       ├── passes/       # Swipe left
│       ├── matches/      # User matches
│       └── comments/     # WordPress comments
├── components/           # Reusable UI
├── contexts/             # Auth context
├── hooks/                # Custom hooks
└── lib/                  # Utilities
```

## 🔧 Tech Stack

| Technology | Purpose |
|-----------|---------|
| Next.js 15 | Framework |
| React 19 | UI Library |
| Tailwind CSS 4 | Styling |
| Framer Motion | Animations |
| Supabase | Auth + Database |
| react-tinder-card | Swipe gestures |
| Lucide React | Icons |

## 🌐 Deployment

### Vercel (Recommended)
1. Push your latest changes to GitHub: `git push origin master`
2. Go to [vercel.com](https://vercel.com) and click **"Add New" → "Project"**
3. Import this repository
4. Expand **"Environment Variables"** and add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_WP_API_URL`
5. Click **"Deploy"**

### Replit
1. Upload project files
2. Set environment variables in Secrets
3. Run `npm run dev`
