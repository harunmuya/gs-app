/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'genuinesugarmummies.co.ke',
      },
      {
        protocol: 'https',
        hostname: 'i0.wp.com',
      },
      {
        protocol: 'https',
        hostname: 'secure.gravatar.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'tislsfajzqcctjcrmnlg.supabase.co',
      },
    ],
  },
};

module.exports = nextConfig;
