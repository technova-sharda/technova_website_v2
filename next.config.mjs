/** @type {import('next').NextConfig} */
const nextConfig = {
    // Type errors now fail the build (there are 0 as of Oct 2026). The old
    // `ignoreBuildErrors: true` hid 15 errors, including a missing import that made
    // the "Force refresh leaderboard" button crash. Run `npm run typecheck` locally.
    experimental: {
        serverActions: {
            bodySizeLimit: '11mb', // position certificates can be up to 10MB
        },
    },
    // Certificate PDFs embed bundled fonts read from disk
    outputFileTracingIncludes: {
        '/api/certificate': ['./public/fonts/certificates/**'],
        '/api/certificate/bulk': ['./public/fonts/certificates/**'],
        '/admin/events/[id]/certificates': ['./public/fonts/certificates/**'],
    },
    images: {
        // Banners are uploaded with unique names, so optimised copies can be cached for a month.
        formats: ['image/avif', 'image/webp'],
        minimumCacheTTL: 2678400,
        remotePatterns: [
            {
                // Event banners and other public uploads in Supabase Storage
                protocol: 'https',
                hostname: '*.supabase.co',
                pathname: '/storage/v1/object/public/**',
            },
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: '*.googleusercontent.com',
                pathname: '/**',
            },
        ],
    },
    // Security headers
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(self), microphone=(), geolocation=()',
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
